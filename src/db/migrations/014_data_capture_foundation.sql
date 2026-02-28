-- =============================================================================
-- 014_data_capture_foundation.sql
-- Foundation for non-ephemeral protocol metadata capture.
--
-- Includes:
-- 1) SCITT continuity hardening via unique tree_size constraint
-- 2) SSF stream ownership columns for per-owner isolation
-- 3) event_journal append-only telemetry table
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) SCITT continuity hardening
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scitt_entries_tree_size_key'
      AND conrelid = 'scitt_entries'::regclass
  ) THEN
    ALTER TABLE scitt_entries
      ADD CONSTRAINT scitt_entries_tree_size_key UNIQUE (tree_size);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) SSF stream ownership
-- -----------------------------------------------------------------------------
ALTER TABLE ssf_streams
  ADD COLUMN IF NOT EXISTS owner_type TEXT;

ALTER TABLE ssf_streams
  ADD COLUMN IF NOT EXISTS owner_id TEXT;

UPDATE ssf_streams
SET owner_type = COALESCE(owner_type, 'legacy')
WHERE owner_type IS NULL;

UPDATE ssf_streams
SET owner_id = COALESCE(owner_id, '')
WHERE owner_id IS NULL;

ALTER TABLE ssf_streams
  ALTER COLUMN owner_type SET DEFAULT 'legacy';

ALTER TABLE ssf_streams
  ALTER COLUMN owner_id SET DEFAULT '';

ALTER TABLE ssf_streams
  ALTER COLUMN owner_type SET NOT NULL;

ALTER TABLE ssf_streams
  ALTER COLUMN owner_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ssf_streams_owner_type_check'
      AND conrelid = 'ssf_streams'::regclass
  ) THEN
    ALTER TABLE ssf_streams
      ADD CONSTRAINT ssf_streams_owner_type_check
      CHECK (owner_type IN ('api_key', 'oidc', 'legacy'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ssf_streams_owner
  ON ssf_streams(owner_type, owner_id)
  WHERE status != 'deleted';

-- -----------------------------------------------------------------------------
-- 3) Append-only event journal
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_journal (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1 CHECK (event_version > 0),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type TEXT NOT NULL DEFAULT 'anonymous' CHECK (actor_type IN ('api_key', 'oidc', 'anonymous', 'legacy')),
  actor_id_hash TEXT,
  target_type TEXT,
  target_id TEXT,
  request_path TEXT,
  request_method TEXT,
  request_id TEXT,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_journal_occurred_at
  ON event_journal(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_journal_event_type_time
  ON event_journal(event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_journal_actor
  ON event_journal(actor_type, actor_id_hash, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_journal_target
  ON event_journal(target_type, target_id, occurred_at DESC);

DROP RULE IF EXISTS event_journal_no_update ON event_journal;
CREATE RULE event_journal_no_update AS
  ON UPDATE TO event_journal
  DO INSTEAD NOTHING;

DROP RULE IF EXISTS event_journal_no_delete ON event_journal;
CREATE RULE event_journal_no_delete AS
  ON DELETE TO event_journal
  DO INSTEAD NOTHING;

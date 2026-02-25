-- =============================================================================
-- 013_hosted_trust_txt.sql
-- Hosted trust.txt storage for delegated DNS publishing
-- =============================================================================

CREATE TABLE IF NOT EXISTS hosted_trust_txt (
  domain TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  trust_txt TEXT NOT NULL,
  trust_txt_hash TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('api_key','oidc')),
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hosted_trust_txt_owner
  ON hosted_trust_txt(owner_type, owner_id);

CREATE INDEX IF NOT EXISTS idx_hosted_trust_txt_status
  ON hosted_trust_txt(status);

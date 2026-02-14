-- =============================================================================
-- 006_rollback_multi_tenancy.sql
-- Rollback tenant_id constraints from core tables
--
-- The 005_multi_tenancy migration was applied prematurely. This migration
-- makes tenant_id nullable on the 6 core protocol tables, disables RLS,
-- and restores the original signing_keys unique index. The SaaS tables
-- (tenants, users, api_keys, etc.) are left in place but unused.
--
-- Safe to run even if 005 was never applied (all operations are guarded).
-- =============================================================================

-- =============================================================================
-- SECTION 1: MAKE tenant_id NULLABLE ON CORE TABLES (if column exists)
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE signing_keys ALTER COLUMN tenant_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ssf_streams ALTER COLUMN tenant_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ssf_event_queue ALTER COLUMN tenant_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ssf_acknowledgments ALTER COLUMN tenant_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE scitt_entries ALTER COLUMN tenant_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE scitt_receipts ALTER COLUMN tenant_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- =============================================================================
-- SECTION 2: RESTORE ORIGINAL signing_keys UNIQUE INDEX
-- =============================================================================

-- Drop the per-tenant unique index from 005 (no-op if it doesn't exist)
DROP INDEX IF EXISTS idx_one_active_key_per_tenant;

-- Restore the original global unique index from 004
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_key
  ON signing_keys(status) WHERE status = 'active';

-- =============================================================================
-- SECTION 3: DISABLE RLS ON CORE TABLES (safe even if never enabled)
-- =============================================================================

ALTER TABLE signing_keys DISABLE ROW LEVEL SECURITY;
ALTER TABLE ssf_streams DISABLE ROW LEVEL SECURITY;
ALTER TABLE ssf_event_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE ssf_acknowledgments DISABLE ROW LEVEL SECURITY;
ALTER TABLE scitt_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE scitt_receipts DISABLE ROW LEVEL SECURITY;

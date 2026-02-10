-- =============================================================================
-- 006_rollback_multi_tenancy.sql
-- Rollback tenant_id constraints from core tables
--
-- The 005_multi_tenancy migration was applied prematurely. This migration
-- makes tenant_id nullable on the 6 core protocol tables, disables RLS,
-- and restores the original signing_keys unique index. The SaaS tables
-- (tenants, users, api_keys, etc.) are left in place but unused.
-- =============================================================================

-- =============================================================================
-- SECTION 1: MAKE tenant_id NULLABLE ON CORE TABLES
-- =============================================================================

-- signing_keys
ALTER TABLE signing_keys ALTER COLUMN tenant_id DROP NOT NULL;

-- ssf_streams
ALTER TABLE ssf_streams ALTER COLUMN tenant_id DROP NOT NULL;

-- ssf_event_queue
ALTER TABLE ssf_event_queue ALTER COLUMN tenant_id DROP NOT NULL;

-- ssf_acknowledgments
ALTER TABLE ssf_acknowledgments ALTER COLUMN tenant_id DROP NOT NULL;

-- scitt_entries
-- Note: scitt_entries has rules preventing UPDATE/DELETE, but ALTER TABLE
-- is a DDL operation that is not blocked by rewrite rules.
ALTER TABLE scitt_entries ALTER COLUMN tenant_id DROP NOT NULL;

-- scitt_receipts
ALTER TABLE scitt_receipts ALTER COLUMN tenant_id DROP NOT NULL;

-- =============================================================================
-- SECTION 2: RESTORE ORIGINAL signing_keys UNIQUE INDEX
-- =============================================================================

-- Drop the per-tenant unique index from 005
DROP INDEX IF EXISTS idx_one_active_key_per_tenant;

-- Restore the original global unique index from 004
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_key
  ON signing_keys(status) WHERE status = 'active';

-- =============================================================================
-- SECTION 3: DISABLE RLS ON CORE TABLES
-- =============================================================================
-- RLS requires setting app.current_tenant_id on every connection,
-- which the current server code does not do. Disable it so queries work.

ALTER TABLE signing_keys DISABLE ROW LEVEL SECURITY;
ALTER TABLE ssf_streams DISABLE ROW LEVEL SECURITY;
ALTER TABLE ssf_event_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE ssf_acknowledgments DISABLE ROW LEVEL SECURITY;
ALTER TABLE scitt_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE scitt_receipts DISABLE ROW LEVEL SECURITY;

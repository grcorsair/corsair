-- =============================================================================
-- 007_cleanup_saas_tables.sql
-- Drop SaaS tables created by the deleted 005_multi_tenancy migration.
--
-- Migration 006 rolled back tenant_id constraints on CORE protocol tables
-- but explicitly left SaaS tables (tenants, users, api_keys, subscriptions,
-- etc.) in place as "unused." Migrations 008+ recreate these tables with
-- the correct schema (org_id instead of tenant_id). This migration drops
-- the old versions so CREATE TABLE IF NOT EXISTS works cleanly.
--
-- Idempotent — DROP IF EXISTS is safe on both fresh and migrated databases.
-- =============================================================================

-- Drop in dependency order (children before parents)
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS usage_records CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

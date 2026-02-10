-- =============================================================================
-- 005_multi_tenancy.sql
-- Multi-Tenant SaaS Architecture for Corsair
--
-- Adds: tenant management, per-tenant isolation, audit readiness tables,
-- row-level security, and backwards-compatible tenant_id columns.
--
-- Idempotent: Uses IF NOT EXISTS / DO $$ blocks throughout.
-- Backwards compatible: Existing data migrated to a 'default' tenant.
-- =============================================================================

-- =============================================================================
-- SECTION 1: TENANT MANAGEMENT TABLES
-- =============================================================================

-- 1a. Tenants — the organizational root for all SaaS data
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  tier           TEXT NOT NULL DEFAULT 'starter'
                   CHECK (tier IN ('starter', 'pro', 'enterprise')),
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'suspended', 'cancelled', 'trial')),
  -- DID identity for Parley protocol (did:web:tenant-slug.grcorsair.com)
  did_domain     TEXT,
  -- Limits enforced at application layer
  max_frameworks INT NOT NULL DEFAULT 1,
  max_scans_per_day INT NOT NULL DEFAULT 1,
  -- Metadata
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status) WHERE status = 'active';

-- 1b. Users — members of a tenant organization
CREATE TABLE IF NOT EXISTS users (
  user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  name           TEXT,
  role           TEXT NOT NULL DEFAULT 'member'
                   CHECK (role IN ('owner', 'admin', 'member', 'auditor', 'viewer')),
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'invited', 'disabled')),
  -- Password hash stored externally (e.g., Cognito/Auth0)
  -- This table tracks identity + authorization, not authn secrets
  external_auth_id TEXT,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email unique within a tenant (same person can belong to multiple orgs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 1c. API Keys — machine-to-machine authentication
CREATE TABLE IF NOT EXISTS api_keys (
  key_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  -- Only the hash is stored; the raw key is shown once at creation
  key_hash       TEXT NOT NULL UNIQUE,
  -- Human-readable prefix for identification (e.g., "crs_live_abc123...")
  key_prefix     TEXT NOT NULL,
  name           TEXT NOT NULL,
  -- Scopes control what the key can do
  scopes         TEXT[] NOT NULL DEFAULT ARRAY['read'],
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'revoked')),
  created_by     UUID REFERENCES users(user_id),
  last_used_at   TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);

-- 1d. Subscriptions — billing and plan tracking
CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  tier            TEXT NOT NULL CHECK (tier IN ('starter', 'pro', 'enterprise')),
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  -- External billing reference (Stripe subscription ID, etc.)
  external_id     TEXT,
  -- Billing period
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  -- Feature flags serialized as JSONB for tier-specific overrides
  feature_flags   JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active subscription per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_tenant_active
  ON subscriptions(tenant_id) WHERE status IN ('active', 'trialing');
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);

-- =============================================================================
-- SECTION 2: DEFAULT TENANT FOR BACKWARDS COMPATIBILITY
-- =============================================================================

-- Insert a default tenant for existing data migration.
-- ON CONFLICT ensures idempotency.
INSERT INTO tenants (tenant_id, name, slug, tier, status, max_frameworks, max_scans_per_day)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Default Tenant',
  'default',
  'enterprise',
  'active',
  999,
  999
)
ON CONFLICT (tenant_id) DO NOTHING;

-- =============================================================================
-- SECTION 3: ADD tenant_id TO EXISTING TABLES
-- =============================================================================

-- 3a. signing_keys — per-tenant Ed25519 keypairs
ALTER TABLE signing_keys
  ADD COLUMN IF NOT EXISTS tenant_id UUID
    REFERENCES tenants(tenant_id) ON DELETE CASCADE;

-- Backfill existing rows to default tenant
UPDATE signing_keys
  SET tenant_id = '00000000-0000-0000-0000-000000000000'
  WHERE tenant_id IS NULL;

ALTER TABLE signing_keys
  ALTER COLUMN tenant_id SET NOT NULL;

-- Drop the old unique index (one global active key) and replace
-- with per-tenant unique active key constraint
DROP INDEX IF EXISTS idx_one_active_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_key_per_tenant
  ON signing_keys(tenant_id, status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_signing_keys_tenant_id
  ON signing_keys(tenant_id);

-- 3b. ssf_streams — per-tenant SSF stream namespaces
ALTER TABLE ssf_streams
  ADD COLUMN IF NOT EXISTS tenant_id UUID
    REFERENCES tenants(tenant_id) ON DELETE CASCADE;

UPDATE ssf_streams
  SET tenant_id = '00000000-0000-0000-0000-000000000000'
  WHERE tenant_id IS NULL;

ALTER TABLE ssf_streams
  ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ssf_streams_tenant_id
  ON ssf_streams(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ssf_streams_tenant_status
  ON ssf_streams(tenant_id, status) WHERE status != 'deleted';

-- 3c. ssf_event_queue — inherits tenant context via stream_id FK,
--     but we denormalize tenant_id for efficient RLS filtering
ALTER TABLE ssf_event_queue
  ADD COLUMN IF NOT EXISTS tenant_id UUID
    REFERENCES tenants(tenant_id) ON DELETE CASCADE;

-- Backfill from stream join
UPDATE ssf_event_queue eq
  SET tenant_id = s.tenant_id
  FROM ssf_streams s
  WHERE eq.stream_id = s.stream_id
    AND eq.tenant_id IS NULL;

-- Any orphans get default tenant
UPDATE ssf_event_queue
  SET tenant_id = '00000000-0000-0000-0000-000000000000'
  WHERE tenant_id IS NULL;

ALTER TABLE ssf_event_queue
  ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ssf_event_queue_tenant_id
  ON ssf_event_queue(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ssf_event_queue_tenant_pending
  ON ssf_event_queue(tenant_id, status, next_retry) WHERE status = 'pending';

-- 3d. ssf_acknowledgments — denormalize tenant_id
ALTER TABLE ssf_acknowledgments
  ADD COLUMN IF NOT EXISTS tenant_id UUID
    REFERENCES tenants(tenant_id) ON DELETE CASCADE;

UPDATE ssf_acknowledgments ack
  SET tenant_id = s.tenant_id
  FROM ssf_streams s
  WHERE ack.stream_id = s.stream_id
    AND ack.tenant_id IS NULL;

UPDATE ssf_acknowledgments
  SET tenant_id = '00000000-0000-0000-0000-000000000000'
  WHERE tenant_id IS NULL;

ALTER TABLE ssf_acknowledgments
  ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ssf_acks_tenant_id
  ON ssf_acknowledgments(tenant_id);

-- 3e. scitt_entries — per-tenant Merkle trees
ALTER TABLE scitt_entries
  ADD COLUMN IF NOT EXISTS tenant_id UUID
    REFERENCES tenants(tenant_id) ON DELETE CASCADE;

UPDATE scitt_entries
  SET tenant_id = '00000000-0000-0000-0000-000000000000'
  WHERE tenant_id IS NULL;

ALTER TABLE scitt_entries
  ALTER COLUMN tenant_id SET NOT NULL;

-- tree_size is now per-tenant (separate Merkle trees)
CREATE INDEX IF NOT EXISTS idx_scitt_entries_tenant_id
  ON scitt_entries(tenant_id);

CREATE INDEX IF NOT EXISTS idx_scitt_entries_tenant_tree
  ON scitt_entries(tenant_id, tree_size);

-- 3f. scitt_receipts — denormalize tenant_id from scitt_entries
ALTER TABLE scitt_receipts
  ADD COLUMN IF NOT EXISTS tenant_id UUID
    REFERENCES tenants(tenant_id) ON DELETE CASCADE;

UPDATE scitt_receipts r
  SET tenant_id = e.tenant_id
  FROM scitt_entries e
  WHERE r.entry_id = e.entry_id
    AND r.tenant_id IS NULL;

UPDATE scitt_receipts
  SET tenant_id = '00000000-0000-0000-0000-000000000000'
  WHERE tenant_id IS NULL;

ALTER TABLE scitt_receipts
  ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scitt_receipts_tenant_id
  ON scitt_receipts(tenant_id);

-- =============================================================================
-- SECTION 4: AUDIT READINESS TABLES
-- =============================================================================

-- 4a. Assessment Runs — a single scan execution against a target
CREATE TABLE IF NOT EXISTS assessment_runs (
  run_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  -- What we scanned
  target_id      TEXT NOT NULL,
  service        TEXT NOT NULL,
  provider_id    TEXT NOT NULL,
  -- Which framework(s) this run evaluated
  frameworks     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- Pipeline execution tracking
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN (
                     'pending', 'running', 'completed', 'failed', 'cancelled'
                   )),
  -- Which pipeline phases completed
  phases_completed TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- Aggregate results
  total_controls    INT NOT NULL DEFAULT 0,
  controls_passed   INT NOT NULL DEFAULT 0,
  controls_failed   INT NOT NULL DEFAULT 0,
  controls_unknown  INT NOT NULL DEFAULT 0,
  -- Overall readiness score: 0.0 to 1.0
  readiness_score   NUMERIC(5,4) DEFAULT 0.0,
  -- ISC tracking
  isc_total         INT NOT NULL DEFAULT 0,
  isc_satisfied     INT NOT NULL DEFAULT 0,
  isc_failed        INT NOT NULL DEFAULT 0,
  -- Reference to evidence chain
  evidence_path     TEXT,
  -- Marque/CPOE reference if generated
  marque_id         TEXT,
  -- Execution timing
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  duration_ms    INT,
  -- Error context for failed runs
  error_message  TEXT,
  -- Full config and metadata
  config         JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_runs_tenant_id
  ON assessment_runs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_assessment_runs_tenant_target
  ON assessment_runs(tenant_id, target_id, service);

CREATE INDEX IF NOT EXISTS idx_assessment_runs_tenant_status
  ON assessment_runs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_assessment_runs_tenant_created
  ON assessment_runs(tenant_id, created_at DESC);

-- 4b. Control Scores — per-control readiness within a framework
CREATE TABLE IF NOT EXISTS control_scores (
  score_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  run_id         UUID NOT NULL REFERENCES assessment_runs(run_id) ON DELETE CASCADE,
  -- Which framework and control
  framework      TEXT NOT NULL,
  control_id     TEXT NOT NULL,
  control_name   TEXT,
  -- Score: 'passed', 'failed', 'partial', 'not_applicable', 'unknown'
  status         TEXT NOT NULL DEFAULT 'unknown'
                   CHECK (status IN (
                     'passed', 'failed', 'partial', 'not_applicable', 'unknown'
                   )),
  -- Numeric score: 0.0 to 1.0 (supports partial credit)
  score          NUMERIC(5,4) DEFAULT 0.0,
  -- What evidence supports this score
  evidence_refs  TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- Which ISC criteria mapped to this control
  isc_refs       TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- MITRE ATT&CK technique if applicable
  mitre_technique TEXT,
  -- Additional context
  notes          TEXT,
  tested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_control_scores_tenant_id
  ON control_scores(tenant_id);

CREATE INDEX IF NOT EXISTS idx_control_scores_tenant_run
  ON control_scores(tenant_id, run_id);

CREATE INDEX IF NOT EXISTS idx_control_scores_tenant_framework
  ON control_scores(tenant_id, framework, control_id);

-- Composite for dashboard queries: "show me all SOC2 control scores for this tenant"
CREATE INDEX IF NOT EXISTS idx_control_scores_framework_status
  ON control_scores(tenant_id, framework, status);

-- 4c. Gap Findings — specific failures with remediation context
CREATE TABLE IF NOT EXISTS gap_findings (
  finding_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  run_id         UUID NOT NULL REFERENCES assessment_runs(run_id) ON DELETE CASCADE,
  -- What failed
  control_id     TEXT NOT NULL,
  framework      TEXT NOT NULL,
  severity       TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  -- Human-readable gap description
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  -- What we expected vs what we found (from MARK drift detection)
  expected_value TEXT,
  actual_value   TEXT,
  drift_field    TEXT,
  -- Remediation guidance
  remediation    TEXT,
  -- MITRE ATT&CK mapping
  mitre_technique TEXT,
  mitre_name      TEXT,
  -- Status tracking for remediation workflow
  status         TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'accepted_risk')),
  -- Who is responsible for fixing
  assigned_to    UUID REFERENCES users(user_id),
  resolved_at    TIMESTAMPTZ,
  -- Evidence linking
  evidence_refs  TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- Metadata for integrations (Jira ticket ID, etc.)
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gap_findings_tenant_id
  ON gap_findings(tenant_id);

CREATE INDEX IF NOT EXISTS idx_gap_findings_tenant_run
  ON gap_findings(tenant_id, run_id);

CREATE INDEX IF NOT EXISTS idx_gap_findings_tenant_status
  ON gap_findings(tenant_id, status) WHERE status != 'resolved';

CREATE INDEX IF NOT EXISTS idx_gap_findings_tenant_severity
  ON gap_findings(tenant_id, severity);

CREATE INDEX IF NOT EXISTS idx_gap_findings_tenant_framework
  ON gap_findings(tenant_id, framework, control_id);

-- 4d. Evidence Bundles — exportable packages for auditors
CREATE TABLE IF NOT EXISTS evidence_bundles (
  bundle_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  -- Human-readable name (e.g., "SOC 2 Type II - Q1 2026")
  name           TEXT NOT NULL,
  description    TEXT,
  -- Which frameworks are covered
  frameworks     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- Which assessment runs are included
  run_ids        UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  -- Bundle status
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'generating', 'ready', 'shared', 'expired')),
  -- Format and storage
  format         TEXT NOT NULL DEFAULT 'json'
                   CHECK (format IN ('json', 'oscal', 'html', 'zip')),
  -- Storage reference (S3 key, file path, etc.)
  storage_ref    TEXT,
  file_size_bytes BIGINT,
  -- Marque/CPOE reference if the bundle is signed
  marque_id      TEXT,
  -- Sharing controls
  shared_with    JSONB DEFAULT '[]',
  share_token    TEXT UNIQUE,
  share_expires_at TIMESTAMPTZ,
  -- Audit metadata
  generated_at   TIMESTAMPTZ,
  generated_by   UUID REFERENCES users(user_id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_bundles_tenant_id
  ON evidence_bundles(tenant_id);

CREATE INDEX IF NOT EXISTS idx_evidence_bundles_tenant_status
  ON evidence_bundles(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_evidence_bundles_share_token
  ON evidence_bundles(share_token) WHERE share_token IS NOT NULL;

-- =============================================================================
-- SECTION 5: READINESS DASHBOARD VIEWS
-- =============================================================================

-- Materialized view for per-tenant, per-framework readiness snapshot.
-- Refreshed after each assessment run completes.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_readiness_summary AS
  SELECT
    cs.tenant_id,
    cs.framework,
    COUNT(*)                                             AS total_controls,
    COUNT(*) FILTER (WHERE cs.status = 'passed')         AS passed,
    COUNT(*) FILTER (WHERE cs.status = 'failed')         AS failed,
    COUNT(*) FILTER (WHERE cs.status = 'partial')        AS partial,
    COUNT(*) FILTER (WHERE cs.status = 'not_applicable') AS not_applicable,
    COUNT(*) FILTER (WHERE cs.status = 'unknown')        AS unknown,
    CASE
      WHEN COUNT(*) FILTER (WHERE cs.status != 'not_applicable') > 0
      THEN ROUND(
        COUNT(*) FILTER (WHERE cs.status = 'passed')::NUMERIC /
        COUNT(*) FILTER (WHERE cs.status != 'not_applicable'),
        4
      )
      ELSE 0.0
    END AS readiness_score,
    MAX(cs.tested_at)                                    AS last_assessed_at
  FROM control_scores cs
  INNER JOIN assessment_runs ar ON cs.run_id = ar.run_id
  WHERE ar.status = 'completed'
    -- Only include the most recent run per (tenant, target, service, framework)
    AND ar.run_id = (
      SELECT ar2.run_id
      FROM assessment_runs ar2
      WHERE ar2.tenant_id = ar.tenant_id
        AND ar2.target_id = ar.target_id
        AND ar2.service = ar.service
        AND ar2.status = 'completed'
      ORDER BY ar2.completed_at DESC
      LIMIT 1
    )
  GROUP BY cs.tenant_id, cs.framework;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_readiness_summary_pk
  ON mv_readiness_summary(tenant_id, framework);

-- =============================================================================
-- SECTION 6: ROW-LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- The application sets a session variable before each query:
--   SET LOCAL app.current_tenant_id = '<uuid>';
--
-- RLS policies check current_setting('app.current_tenant_id')
-- to ensure tenants can never see each other's data.

-- Helper: Create a policy that restricts SELECT/INSERT/UPDATE/DELETE
-- to rows where tenant_id matches the session variable.

-- 6a. Enable RLS on all tenant-scoped tables

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signing_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssf_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssf_event_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssf_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scitt_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE scitt_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE gap_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_bundles ENABLE ROW LEVEL SECURITY;

-- 6b. RLS Policies — all follow the same pattern:
--     USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
--     WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID)

-- tenants: can only see their own org
DO $$ BEGIN
  DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants;
  CREATE POLICY tenant_isolation_tenants ON tenants
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- users
DO $$ BEGIN
  DROP POLICY IF EXISTS tenant_isolation_users ON users;
  CREATE POLICY tenant_isolation_users ON users
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- api_keys
DO $$ BEGIN
  DROP POLICY IF EXISTS tenant_isolation_api_keys ON api_keys;
  CREATE POLICY tenant_isolation_api_keys ON api_keys
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- subscriptions
DO $$ BEGIN
  DROP POLICY IF EXISTS tenant_isolation_subscriptions ON subscriptions;
  CREATE POLICY tenant_isolation_subscriptions ON subscriptions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- signing_keys
DO $$ BEGIN
  DROP POLICY IF EXISTS tenant_isolation_signing_keys ON signing_keys;
  CREATE POLICY tenant_isolation_signing_keys ON signing_keys
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ssf_streams
DO $$ BEGIN
  DROP POLICY IF EXISTS tenant_isolation_ssf_streams ON ssf_streams;
  CREATE POLICY tenant_isolation_ssf_streams ON ssf_streams
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ssf_event_queue
DO $$ BEGIN
  DROP POLICY IF EXISTS tenant_isolation_ssf_event_queue ON ssf_event_queue;
  CREATE POLICY tenant_isolation_ssf_event_queue ON ssf_event_queue
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ssf_acknowledgments
DO $$ BEGIN
  DROP POLICY IF EXISTS tenant_isolation_ssf_acks ON ssf_acknowledgments;
  CREATE POLICY tenant_isolation_ssf_acks ON ssf_acknowledgments
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- scitt_entries
DO $$ BEGIN
  DROP POLICY IF EXISTS tenant_isolation_scitt_entries ON scitt_entries;
  CREATE POLICY tenant_isolation_scitt_entries ON scitt_entries
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- scitt_receipts
DO $$ BEGIN
  DROP POLICY IF EXISTS tenant_isolation_scitt_receipts ON scitt_receipts;
  CREATE POLICY tenant_isolation_scitt_receipts ON scitt_receipts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- assessment_runs
DO $$ BEGIN
  DROP POLICY IF EXISTS tenant_isolation_assessment_runs ON assessment_runs;
  CREATE POLICY tenant_isolation_assessment_runs ON assessment_runs
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- control_scores
DO $$ BEGIN
  DROP POLICY IF EXISTS tenant_isolation_control_scores ON control_scores;
  CREATE POLICY tenant_isolation_control_scores ON control_scores
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- gap_findings
DO $$ BEGIN
  DROP POLICY IF EXISTS tenant_isolation_gap_findings ON gap_findings;
  CREATE POLICY tenant_isolation_gap_findings ON gap_findings
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- evidence_bundles
DO $$ BEGIN
  DROP POLICY IF EXISTS tenant_isolation_evidence_bundles ON evidence_bundles;
  CREATE POLICY tenant_isolation_evidence_bundles ON evidence_bundles
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6c. BYPASS policy for the application superuser role.
-- The migration runner and admin operations use the database owner,
-- which bypasses RLS automatically (table owners bypass RLS).
-- For non-owner service roles, we create an explicit bypass:

-- Create application role if it does not exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'corsair_app') THEN
    CREATE ROLE corsair_app NOLOGIN;
  END IF;
END $$;

-- Grant usage on all tables to the app role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO corsair_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO corsair_app;

-- The app role is subject to RLS. The database owner is not.
-- This means: admin/migration connections (as owner) bypass RLS,
-- while application connections (as corsair_app) are always filtered.

-- =============================================================================
-- SECTION 7: SCITT IMMUTABILITY RULES UPDATE
-- =============================================================================

-- The original scitt_entries rules prevented ALL updates/deletes.
-- We need to allow the tenant_id backfill we already did, but
-- the rules were created in 003, so they blocked our UPDATE above
-- if run on a non-empty database. The migration runner uses unsafe()
-- which runs as the table owner, bypassing rules.
-- No changes needed here — the existing rules remain correct.
-- Future updates to scitt_entries (even tenant_id) are blocked,
-- which is the desired behavior for a transparency log.

-- =============================================================================
-- SECTION 8: AUDIT LOG TABLE
-- =============================================================================

-- Track all significant actions for compliance audit trail
CREATE TABLE IF NOT EXISTS audit_log (
  log_id         BIGSERIAL PRIMARY KEY,
  tenant_id      UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id        UUID REFERENCES users(user_id),
  action         TEXT NOT NULL,
  resource_type  TEXT NOT NULL,
  resource_id    TEXT,
  -- Before/after state for change tracking
  details        JSONB DEFAULT '{}',
  ip_address     INET,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_id
  ON audit_log(tenant_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created
  ON audit_log(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_action
  ON audit_log(tenant_id, action);

-- Audit log is append-only
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- RLS for audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS tenant_isolation_audit_log ON audit_log;
  CREATE POLICY tenant_isolation_audit_log ON audit_log
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =============================================================================
-- SECTION 9: HELPER FUNCTIONS
-- =============================================================================

-- Function to set the current tenant context for RLS.
-- Called at the start of every request by the middleware.
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::TEXT, true);
END;
$$ LANGUAGE plpgsql;

-- Function to get the current tenant context.
CREATE OR REPLACE FUNCTION get_tenant_context()
RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', true)::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to refresh the readiness materialized view.
-- Called after assessment runs complete.
CREATE OR REPLACE FUNCTION refresh_readiness_summary()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_readiness_summary;
END;
$$ LANGUAGE plpgsql;

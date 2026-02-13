-- =============================================================================
-- 009_certifications.sql
-- Continuous compliance certification: policies, certifications, status tracking.
-- Idempotent — safe to run multiple times.
-- =============================================================================

-- Certifications (ongoing compliance certification records)
CREATE TABLE IF NOT EXISTS certifications (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','warning','degraded','suspended','expired','revoked')),
  current_score REAL NOT NULL DEFAULT 0,
  current_grade TEXT NOT NULL DEFAULT 'F',
  last_audit_at TIMESTAMPTZ,
  last_audit_result JSONB,
  next_audit_at TIMESTAMPTZ,
  status_history JSONB NOT NULL DEFAULT '[]',
  certified_since TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  cpoe_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certifications_org ON certifications(org_id);
CREATE INDEX IF NOT EXISTS idx_certifications_status ON certifications(status);

-- Certification policies (define what "certified" means)
CREATE TABLE IF NOT EXISTS certification_policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scope JSONB NOT NULL,
  minimum_score REAL NOT NULL DEFAULT 70,
  warning_threshold REAL NOT NULL DEFAULT 80,
  audit_interval_days INTEGER NOT NULL DEFAULT 90,
  freshness_max_days INTEGER NOT NULL DEFAULT 7,
  grace_period_days INTEGER NOT NULL DEFAULT 14,
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  auto_suspend BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_change BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

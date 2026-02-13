-- =============================================================================
-- 010_tprm.sql
-- Third-Party Risk Management: vendors, assessment requests/results, monitoring.
-- Idempotent — safe to run multiple times.
-- =============================================================================

-- Vendors (third-party vendor profiles)
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  did TEXT NOT NULL,
  risk_tier TEXT NOT NULL DEFAULT 'medium' CHECK (risk_tier IN ('critical','high','medium','low','minimal')),
  tags JSONB NOT NULL DEFAULT '[]',
  contacts JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_risk_tier ON vendors(risk_tier);

-- Assessment requests (inbound assessment requests for vendors)
CREATE TABLE IF NOT EXISTS assessment_requests (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  frameworks JSONB NOT NULL DEFAULT '[]',
  minimum_score REAL NOT NULL DEFAULT 70,
  minimum_assurance INTEGER NOT NULL DEFAULT 0,
  deadline TIMESTAMPTZ,
  notes TEXT
);

-- Assessment results (completed assessments with scoring + decision)
CREATE TABLE IF NOT EXISTS assessment_results (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES assessment_requests(id),
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cpoe_count INTEGER NOT NULL DEFAULT 0,
  latest_cpoe_date TIMESTAMPTZ,
  composite_score REAL NOT NULL,
  score_breakdown JSONB NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved','conditional','review_required','rejected')),
  decision_reason TEXT NOT NULL,
  conditions JSONB DEFAULT '[]',
  risk_tier TEXT NOT NULL,
  findings JSONB NOT NULL DEFAULT '[]',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  automated BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_assessments_vendor ON assessment_results(vendor_id);
CREATE INDEX IF NOT EXISTS idx_assessments_decision ON assessment_results(decision);

-- Vendor monitoring configuration
CREATE TABLE IF NOT EXISTS vendor_monitoring (
  vendor_id TEXT PRIMARY KEY REFERENCES vendors(id),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  check_interval_days INTEGER NOT NULL DEFAULT 7,
  alert_on_score_drop REAL NOT NULL DEFAULT 10,
  alert_on_status_change BOOLEAN NOT NULL DEFAULT TRUE,
  alert_on_expiry BOOLEAN NOT NULL DEFAULT TRUE,
  expiry_warning_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

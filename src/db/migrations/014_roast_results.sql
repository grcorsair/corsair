-- =============================================================================
-- 014_roast_results.sql
-- Persistent storage for roast scan results
-- =============================================================================

CREATE TABLE IF NOT EXISTS roast_results (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  composite_score NUMERIC(4,2) NOT NULL,
  verdict TEXT NOT NULL,
  result_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_roast_results_domain_created
  ON roast_results(domain, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_roast_results_expires_at
  ON roast_results(expires_at);

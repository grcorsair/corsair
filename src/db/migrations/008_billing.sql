-- =============================================================================
-- 008_billing.sql
-- Billing infrastructure: plans catalog, subscriptions, usage tracking.
-- Idempotent — safe to run multiple times.
-- =============================================================================

-- Plans table (catalog of available plan tiers)
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'platform')),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  interval TEXT NOT NULL DEFAULT 'monthly',
  limits JSONB NOT NULL DEFAULT '{}',
  features JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions (one active subscription per org)
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','trialing','past_due','canceled','expired')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  trial_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(org_id) WHERE status IN ('active','trialing');

-- Usage tracking (per org per billing period)
CREATE TABLE IF NOT EXISTS usage_records (
  org_id TEXT NOT NULL,
  period TEXT NOT NULL,  -- '2026-02' format
  cpoes_issued INTEGER NOT NULL DEFAULT 0,
  api_calls INTEGER NOT NULL DEFAULT 0,
  webhooks_delivered INTEGER NOT NULL DEFAULT 0,
  scitt_entries INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, period)
);

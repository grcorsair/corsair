-- Certifications & policies
CREATE TABLE IF NOT EXISTS certifications (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'revoked', 'pending')),
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certifications_org_id
  ON certifications (org_id);

CREATE INDEX IF NOT EXISTS idx_certifications_status
  ON certifications (status);

CREATE TABLE IF NOT EXISTS certification_policies (
  id TEXT PRIMARY KEY,
  certification_id TEXT NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  min_score INT NOT NULL DEFAULT 70,
  max_score INT NOT NULL DEFAULT 100,
  grace_period_days INT NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

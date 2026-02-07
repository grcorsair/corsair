CREATE TABLE signing_keys (
  key_id       TEXT PRIMARY KEY,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired','revoked')),
  public_key   TEXT NOT NULL,
  private_key_encrypted BYTEA NOT NULL,
  algorithm    TEXT NOT NULL DEFAULT 'Ed25519',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  retired_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_one_active_key ON signing_keys(status) WHERE status = 'active';

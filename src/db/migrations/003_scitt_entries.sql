CREATE TABLE scitt_entries (
  entry_id          TEXT PRIMARY KEY,
  statement         TEXT NOT NULL,
  statement_hash    TEXT NOT NULL,
  tree_size         BIGINT NOT NULL,
  tree_hash         TEXT NOT NULL,
  parent_hash       TEXT,
  registration_time TIMESTAMPTZ DEFAULT NOW()
);

CREATE RULE scitt_no_update AS ON UPDATE TO scitt_entries DO INSTEAD NOTHING;
CREATE RULE scitt_no_delete AS ON DELETE TO scitt_entries DO INSTEAD NOTHING;

CREATE TABLE scitt_receipts (
  entry_id     TEXT PRIMARY KEY REFERENCES scitt_entries(entry_id),
  log_id       TEXT NOT NULL,
  proof        TEXT NOT NULL,
  issued_at    TIMESTAMPTZ DEFAULT NOW()
);

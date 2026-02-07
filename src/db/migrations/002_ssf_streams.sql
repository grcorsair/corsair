CREATE TABLE ssf_streams (
  stream_id    TEXT PRIMARY KEY,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','deleted')),
  config       JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ssf_event_queue (
  id           BIGSERIAL PRIMARY KEY,
  stream_id    TEXT REFERENCES ssf_streams(stream_id),
  set_token    TEXT NOT NULL,
  jti          TEXT NOT NULL,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','expired')),
  attempts     INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  next_retry   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_event_queue_pending ON ssf_event_queue(status, next_retry) WHERE status = 'pending';

CREATE TABLE ssf_acknowledgments (
  stream_id    TEXT REFERENCES ssf_streams(stream_id),
  jti          TEXT NOT NULL,
  acked_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (stream_id, jti)
);

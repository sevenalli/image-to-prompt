CREATE TABLE IF NOT EXISTS users (
  id                      TEXT PRIMARY KEY,
  polar_customer_id       TEXT,
  polar_subscription_id   TEXT,
  tier                    TEXT NOT NULL DEFAULT 'starter',
  analyses_used           INTEGER NOT NULL DEFAULT 0,
  analyses_reset_at       TEXT NOT NULL,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analyses (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  prompt_length INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  key_hash   TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used  TEXT
);

CREATE INDEX IF NOT EXISTS idx_analyses_user_created ON analyses(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Migration: rename ls_* columns to polar_* (run once on existing databases)
-- wrangler d1 execute image-to-prompt-db --command "ALTER TABLE users RENAME COLUMN ls_customer_id TO polar_customer_id"
-- wrangler d1 execute image-to-prompt-db --command "ALTER TABLE users RENAME COLUMN ls_subscription_id TO polar_subscription_id"

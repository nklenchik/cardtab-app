CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,          -- JustTCG card id
  game TEXT, name TEXT, set_name TEXT, number TEXT, rarity TEXT,
  tcgplayer_id TEXT,
  fetched_at INTEGER
);
CREATE TABLE IF NOT EXISTS lookups (  -- cached search -> candidate ids
  key TEXT PRIMARY KEY, ids TEXT, fetched_at INTEGER
);
CREATE TABLE IF NOT EXISTS picks (    -- "which one is your card?" answers, per entry text
  entry TEXT PRIMARY KEY, card_id TEXT, picked_at INTEGER
);
-- accounts (v41.1). No passwords: Google or an emailed link/code.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, google_sub TEXT,
  plan TEXT DEFAULT 'free', created_at INTEGER, last_seen_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (      -- id = SHA-256 of the cookie token
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER, expires_at INTEGER, ua TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS login_tokens (  -- id = SHA-256 of the link token; code stored as SHA-256 of email:code
  id TEXT PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT, mode TEXT, ip TEXT,
  created_at INTEGER, expires_at INTEGER, used_at INTEGER, attempts INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS login_tokens_email ON login_tokens(email, created_at);
CREATE INDEX IF NOT EXISTS login_tokens_ip ON login_tokens(ip, created_at);
-- sync (v42): each entry and synced setting, per account. seq orders changes so devices can ask "what's new since N".
CREATE TABLE IF NOT EXISTS entries (
  user_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, deleted INTEGER DEFAULT 0, seq INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS entries_seq ON entries(user_id, seq);
CREATE TABLE IF NOT EXISTS user_meta (
  user_id TEXT NOT NULL, k TEXT NOT NULL, v TEXT, updated_at TEXT NOT NULL, seq INTEGER NOT NULL,
  PRIMARY KEY (user_id, k)
);
CREATE TABLE IF NOT EXISTS sync_state ( user_id TEXT PRIMARY KEY, seq INTEGER NOT NULL DEFAULT 0 );
-- card data budget (v42.6): requests made to JustTCG per day, by why (type | fill) and plan, plus lookups answered (reqs)
CREATE TABLE IF NOT EXISTS usage ( day TEXT NOT NULL, src TEXT NOT NULL, plan TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0, reqs INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, src, plan) );
CREATE TABLE IF NOT EXISTS usage_user ( day TEXT NOT NULL, user_id TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, user_id) );
CREATE INDEX IF NOT EXISTS cards_name ON cards(name);

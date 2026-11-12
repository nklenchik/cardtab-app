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
-- Ask (v45): questions asked per account per month, and the month's tokens (for the spending cap)
CREATE TABLE IF NOT EXISTS ask_usage ( user_id TEXT NOT NULL, month TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, month) );
CREATE TABLE IF NOT EXISTS ask_spend ( month TEXT PRIMARY KEY, tin INTEGER NOT NULL DEFAULT 0, tout INTEGER NOT NULL DEFAULT 0, n INTEGER NOT NULL DEFAULT 0 );

-- v50 analytics: one row per day per count (totals only), and who was active each day (for active people, time in the app
-- and coming-back numbers). Rows older than two years are removed nightly.
CREATE TABLE IF NOT EXISTS an_day ( day TEXT NOT NULL, ev TEXT NOT NULL, dim TEXT NOT NULL DEFAULT '', plan TEXT NOT NULL, dev TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, v REAL NOT NULL DEFAULT 0, PRIMARY KEY (day, ev, dim, plan, dev) );
CREATE TABLE IF NOT EXISTS an_active ( day TEXT NOT NULL, uid TEXT NOT NULL, plan TEXT NOT NULL, dev TEXT NOT NULL, secs INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, uid) );
CREATE INDEX IF NOT EXISTS an_active_uid ON an_active (uid);
-- v50.1 website visits (cardtab.app): no cookies; a visitor is a code that changes every day (an_salt is deleted nightly)
CREATE TABLE IF NOT EXISTS an_site ( day TEXT NOT NULL, ev TEXT NOT NULL, dim TEXT NOT NULL DEFAULT '', dev TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, ev, dim, dev) );
CREATE TABLE IF NOT EXISTS an_site_vis ( day TEXT NOT NULL, vh TEXT NOT NULL, dev TEXT NOT NULL, src TEXT NOT NULL, cc TEXT NOT NULL, br TEXT DEFAULT '', os TEXT DEFAULT '', PRIMARY KEY (day, vh) );
CREATE TABLE IF NOT EXISTS an_salt ( day TEXT PRIMARY KEY, salt TEXT NOT NULL );
-- v50.4 features and upgrades: which features each person touched each day (no content, just the feature's name), and one
-- small row per person: first day seen, plan then and now, the last Premium screen they saw, the day they went Premium,
-- and what the website showed them before they opened the app. Removed with the account; feature days kept two years.
CREATE TABLE IF NOT EXISTS an_feat ( day TEXT NOT NULL, uid TEXT NOT NULL, feat TEXT NOT NULL, plan TEXT NOT NULL, dev TEXT NOT NULL, PRIMARY KEY (day, uid, feat) );
CREATE INDEX IF NOT EXISTS an_feat_uid ON an_feat (uid);
CREATE TABLE IF NOT EXISTS an_user ( uid TEXT PRIMARY KEY, first_day TEXT NOT NULL, plan0 TEXT NOT NULL, plan TEXT NOT NULL, up_day TEXT, up_ctx TEXT, last_prem TEXT, src TEXT, sec TEXT, demo TEXT, camp TEXT, ad TEXT );
-- v52.43 what each ad campaign cost (typed in the admin dashboard)
CREATE TABLE IF NOT EXISTS ad_spend ( camp TEXT PRIMARY KEY, usd REAL NOT NULL, at INTEGER );
-- v50.95 Premium copy test: each person's last-shown Premium sheet copy ("b2:1.4.6.7.9.16" = headline b2 with bullets 1,4,6,7,9,16),
-- and the copy that was showing when they bought Premium (the day and which plan). Removed with the account.
CREATE TABLE IF NOT EXISTS an_copy ( uid TEXT PRIMARY KEY, last TEXT, last_day TEXT, buy_day TEXT, buy TEXT, buy_iv TEXT );
-- v50.5 shared Card Boards: one link per account; the board as visitors see it (amounts / names already hidden if chosen)
CREATE TABLE IF NOT EXISTS shares ( id TEXT PRIMARY KEY, uid TEXT NOT NULL UNIQUE, html TEXT NOT NULL, meta TEXT, live INTEGER NOT NULL DEFAULT 1, exp_opt TEXT NOT NULL DEFAULT 'never', exp INTEGER, created INTEGER NOT NULL, updated INTEGER NOT NULL, views INTEGER NOT NULL DEFAULT 0, invites INTEGER NOT NULL DEFAULT 0, inv_day TEXT );
CREATE TABLE IF NOT EXISTS share_open ( id TEXT PRIMARY KEY, last INTEGER NOT NULL );
-- v50.12 daily check: one row per day with each check's result (kept 90 days)
CREATE TABLE IF NOT EXISTS health ( day TEXT PRIMARY KEY, at INTEGER NOT NULL, ok INTEGER NOT NULL, n_bad INTEGER NOT NULL DEFAULT 0, n_warn INTEGER NOT NULL DEFAULT 0, checks TEXT );

-- v50.46: card photos people upload (their own entries), and shared default art waiting for review
-- status: private (only on the uploader's entry) | pending (shared, waiting for an admin) | approved (the card's default) | rejected
CREATE TABLE IF NOT EXISTS art_uploads ( id TEXT PRIMARY KEY, user_id TEXT NOT NULL, card_id TEXT, name TEXT, w INTEGER, h INTEGER, status TEXT NOT NULL, reason TEXT, seen TEXT, created INTEGER NOT NULL );
CREATE INDEX IF NOT EXISTS art_uploads_user ON art_uploads (user_id, created);
CREATE INDEX IF NOT EXISTS art_uploads_status ON art_uploads (status, created);

-- v50.63 Premium billing (also made automatically on first use)
CREATE TABLE IF NOT EXISTS billing ( user_id TEXT PRIMARY KEY, customer TEXT, sub TEXT, status TEXT, price_key TEXT, interval TEXT, amount INTEGER, founder INTEGER DEFAULT 0, period_end INTEGER, cancel_at_end INTEGER DEFAULT 0, grace_until INTEGER, card_brand TEXT, card_last4 TEXT, pending_key TEXT, schedule TEXT, gift INTEGER DEFAULT 0, updated INTEGER );
CREATE INDEX IF NOT EXISTS billing_customer ON billing (customer);

-- v51.3 catalog fill: in the last week before JustTCG's monthly reset, leftover requests save whole sets (newest first)
CREATE TABLE IF NOT EXISTS cat_sets ( id TEXT PRIMARY KEY, game TEXT, name TEXT, released TEXT, total INTEGER, next_offset INTEGER NOT NULL DEFAULT 0, done INTEGER NOT NULL DEFAULT 0, cards INTEGER NOT NULL DEFAULT 0, listed TEXT );
CREATE TABLE IF NOT EXISTS cat_cards ( id TEXT PRIMARY KEY, art INTEGER NOT NULL DEFAULT 0, at INTEGER );
CREATE TABLE IF NOT EXISTS cat_day ( day TEXT PRIMARY KEY, calls INTEGER NOT NULL DEFAULT 0, sets INTEGER NOT NULL DEFAULT 0, cards INTEGER NOT NULL DEFAULT 0, art INTEGER NOT NULL DEFAULT 0 );

-- v51.5 plan changes, for the daily check's "upgrades / back to Free" (paid only, gifts aren't counted)
CREATE TABLE IF NOT EXISTS plan_ev ( at INTEGER NOT NULL, uid TEXT NOT NULL, kind TEXT NOT NULL );
CREATE INDEX IF NOT EXISTS plan_ev_at ON plan_ev (at);
-- v52.8 admin account tools: per-account flags (gift end date, extra Free entries, paused, uploads off) and a log of admin actions
CREATE TABLE IF NOT EXISTS acct ( user_id TEXT PRIMARY KEY, gift_until INTEGER, bonus_month TEXT, bonus_entries INTEGER NOT NULL DEFAULT 0, suspended INTEGER NOT NULL DEFAULT 0, no_upload INTEGER NOT NULL DEFAULT 0, updated INTEGER, ask_month TEXT, ask_bonus INTEGER NOT NULL DEFAULT 0 );
CREATE TABLE IF NOT EXISTS acct_log ( at INTEGER NOT NULL, uid TEXT NOT NULL, act TEXT NOT NULL, note TEXT );
CREATE INDEX IF NOT EXISTS acct_log_uid ON acct_log (uid, at);
-- v52.10 messages for a person from admin changes (gift, extras, resets), picked up by their app once
CREATE TABLE IF NOT EXISTS acct_note ( id TEXT PRIMARY KEY, uid TEXT NOT NULL, at INTEGER NOT NULL, title TEXT NOT NULL, body TEXT, seen INTEGER NOT NULL DEFAULT 0 );
CREATE INDEX IF NOT EXISTS acct_note_uid ON acct_note (uid, seen);
-- v52.49 first-two-weeks emails for Free members: one row per email (its id goes in the email's links), with opens, clicks
-- and "stop these emails". Rows starting with x are steps that were skipped (nothing sent). Removed with the account.
CREATE TABLE IF NOT EXISTS email_log ( id TEXT PRIMARY KEY, uid TEXT NOT NULL, flow TEXT NOT NULL, step TEXT NOT NULL, variant TEXT, sent_at INTEGER NOT NULL, opened_at INTEGER, opens INTEGER NOT NULL DEFAULT 0, clicked_at INTEGER, clicks INTEGER NOT NULL DEFAULT 0, unsub_at INTEGER );
CREATE INDEX IF NOT EXISTS email_log_uid ON email_log (uid, sent_at);
CREATE INDEX IF NOT EXISTS email_log_sent ON email_log (sent_at);

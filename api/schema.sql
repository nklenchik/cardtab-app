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

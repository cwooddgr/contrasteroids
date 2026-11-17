-- One row per game started. A session can submit one score.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  created INTEGER NOT NULL,   -- ms, server time
  ip TEXT NOT NULL,           -- salted hash, for rate limits only
  used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX sessions_ip ON sessions (ip, created);
CREATE INDEX sessions_created ON sessions (created);

CREATE TABLE scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,
  day TEXT NOT NULL,          -- UTC YYYY-MM-DD
  initials TEXT NOT NULL,
  score INTEGER NOT NULL,
  wave INTEGER NOT NULL,
  kills TEXT NOT NULL,        -- JSON, kept for spotting cheats later
  secs INTEGER NOT NULL,      -- wall-clock length of the game
  created INTEGER NOT NULL,
  ip TEXT NOT NULL,
  session TEXT NOT NULL UNIQUE
);
CREATE INDEX scores_all ON scores (mode, score DESC, created);
CREATE INDEX scores_day ON scores (mode, day, score DESC, created);

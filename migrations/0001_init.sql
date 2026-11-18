CREATE TABLE income (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('active', 'passive')),
  description TEXT NOT NULL DEFAULT '',
  occurred_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  counterparty TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('owe', 'owed')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  paid INTEGER NOT NULL DEFAULT 0 CHECK (paid >= 0 AND paid <= amount),
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  target_value INTEGER CHECK (target_value IS NULL OR target_value >= 0),
  current_value INTEGER NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'reading' CHECK (status IN ('planned', 'reading', 'finished', 'paused')),
  pages_total INTEGER CHECK (pages_total IS NULL OR pages_total >= 0),
  pages_read INTEGER NOT NULL DEFAULT 0 CHECK (pages_read >= 0),
  created_at TEXT NOT NULL,
  finished_at TEXT,
  CHECK (pages_total IS NULL OR pages_read <= pages_total)
);

CREATE TABLE workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  duration_min INTEGER NOT NULL CHECK (duration_min > 0 AND duration_min <= 1440),
  occurred_on TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE xp_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_income_date ON income (occurred_on, id);
CREATE INDEX idx_workouts_date ON workouts (occurred_on, id);
CREATE INDEX idx_xp_source ON xp_events (source_type, source_id);
CREATE INDEX idx_xp_created ON xp_events (created_at, id);

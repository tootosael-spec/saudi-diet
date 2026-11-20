CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','suspended')),
  plan TEXT NOT NULL DEFAULT 'trial',
  trial_used INTEGER NOT NULL DEFAULT 0 CHECK (trial_used IN (0,1)),
  trial_started_at TEXT,
  trial_ends_at TEXT,
  starts_at TEXT,
  ends_at TEXT,
  notified_7d_for_end TEXT,
  notified_1d_for_end TEXT,
  notified_expired_for_end TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The free trial is granted once when this project's subscription table is first installed.
INSERT OR IGNORE INTO subscriptions
  (id,status,plan,trial_used,trial_started_at,trial_ends_at,starts_at,ends_at)
VALUES
  (1,'trial','trial',1,CURRENT_TIMESTAMP,datetime('now','+2 months'),CURRENT_TIMESTAMP,datetime('now','+2 months'));

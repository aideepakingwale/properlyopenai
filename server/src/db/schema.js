export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  interests TEXT NOT NULL DEFAULT '[]',
  phase INTEGER NOT NULL DEFAULT 2,
  avatar_url TEXT,
  acorns INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  phase INTEGER NOT NULL,
  theme TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  illustration_url TEXT,
  pdf_path TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  story_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  jaccard_score REAL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  expected TEXT NOT NULL,
  recognized TEXT NOT NULL,
  phoneme_scores TEXT NOT NULL DEFAULT '{}',
  jaccard_words REAL,
  jaccard_phonemes REAL,
  path TEXT NOT NULL DEFAULT 'whisper',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_child ON sessions(child_id);
CREATE INDEX IF NOT EXISTS idx_assessments_session ON assessments(session_id);
CREATE INDEX IF NOT EXISTS idx_rewards_child ON rewards(child_id);
`;

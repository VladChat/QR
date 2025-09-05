-- Users (passwordless via magic link)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL
);

-- QR codes
CREATE TABLE IF NOT EXISTS qr_codes (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('unclaimed','pending','active','locked')) DEFAULT 'unclaimed',
  batch_id TEXT,
  created_at INTEGER NOT NULL,
  last_scan_at INTEGER
);

-- Ownership / settings (one owner for now)
CREATE TABLE IF NOT EXISTS qr_claims (
  id TEXT PRIMARY KEY,
  qr_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  pin_hash TEXT,
  editable_by_public INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (qr_id) REFERENCES qr_codes(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Note content
CREATE TABLE IF NOT EXISTS qr_notes (
  id TEXT PRIMARY KEY,
  qr_id TEXT NOT NULL,
  title TEXT,
  body TEXT,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (qr_id) REFERENCES qr_codes(id)
);

-- Audit
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  qr_id TEXT,
  actor_user_id TEXT,
  ip TEXT,
  kind TEXT,        -- SCAN, VIEW, EDIT, CLAIM, PIN_SET, PIN_FAIL
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_qr_slug ON qr_codes(slug);
CREATE INDEX IF NOT EXISTS idx_claims_qr ON qr_claims(qr_id);
CREATE INDEX IF NOT EXISTS idx_notes_qr ON qr_notes(qr_id);

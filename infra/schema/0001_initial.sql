PRAGMA foreign_keys = ON;
CREATE TABLE members (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
 english_name TEXT NOT NULL DEFAULT '', passport TEXT NOT NULL DEFAULT '', identity_number TEXT NOT NULL DEFAULT '', expiry TEXT NOT NULL DEFAULT '',
 password_hash TEXT NOT NULL, salt TEXT NOT NULL, recovery_hash TEXT NOT NULL, avatar_key TEXT, avatar_mime TEXT, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE trips (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES members(id),
 start_date TEXT NOT NULL, end_date TEXT NOT NULL, timezone TEXT NOT NULL, home_timezone TEXT NOT NULL,
 currency TEXT NOT NULL, home_currency TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE trip_members (trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, member_id TEXT NOT NULL REFERENCES members(id), joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(trip_id,member_id));
CREATE INDEX memberships_user ON trip_members(member_id);
CREATE TABLE trip_invites (token_hash TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE events (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE INDEX events_trip ON events(trip_id);
CREATE TABLE documents (id TEXT PRIMARY KEY, trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE, name TEXT NOT NULL, category TEXT NOT NULL, owner_id TEXT REFERENCES members(id), r2_key TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, uploaded_by TEXT NOT NULL REFERENCES members(id));
CREATE INDEX documents_trip ON documents(trip_id);
CREATE TABLE pending_costs (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, title TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount >= 0), currency TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', document_id TEXT REFERENCES documents(id) ON DELETE SET NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE expenses (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, payer_id TEXT NOT NULL REFERENCES members(id), created_by TEXT NOT NULL REFERENCES members(id), title TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0), currency TEXT NOT NULL, category TEXT NOT NULL DEFAULT '其他', date TEXT NOT NULL, participants TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, version INTEGER NOT NULL DEFAULT 1, pending_id TEXT REFERENCES pending_costs(id), write_token TEXT);
CREATE INDEX expenses_trip ON expenses(trip_id,date);
CREATE UNIQUE INDEX expenses_pending_once ON expenses(pending_id) WHERE pending_id IS NOT NULL;
CREATE TABLE receipts (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, uploaded_by TEXT NOT NULL REFERENCES members(id), expense_id TEXT REFERENCES expenses(id) ON DELETE SET NULL, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, r2_key TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX receipts_trip ON receipts(trip_id);
CREATE TABLE preparation_items (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, group_name TEXT NOT NULL, title TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE packing (trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, member_id TEXT NOT NULL REFERENCES members(id), item_id TEXT NOT NULL REFERENCES preparation_items(id) ON DELETE CASCADE, checked INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(trip_id,member_id,item_id));

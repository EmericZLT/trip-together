ALTER TABLE members RENAME COLUMN username TO email;
ALTER TABLE members DROP COLUMN recovery_hash;
ALTER TABLE members ADD COLUMN email_verified_at INTEGER;
CREATE TABLE email_verifications (
  email TEXT NOT NULL COLLATE NOCASE,
  purpose TEXT NOT NULL CHECK(purpose IN ('register','login','recover','migrate')),
  nonce TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  ready INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(email,purpose)
);

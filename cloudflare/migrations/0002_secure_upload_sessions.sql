PRAGMA foreign_keys = ON;

ALTER TABLE properties ADD COLUMN syncVersion INTEGER NOT NULL DEFAULT 0;

CREATE TABLE upload_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  ownerType TEXT NOT NULL CHECK (ownerType IN ('property', 'source', 'import')),
  ownerId TEXT NOT NULL,
  folder TEXT NOT NULL,
  expectedFiles TEXT NOT NULL DEFAULT '[]',
  maxFiles INTEGER NOT NULL CHECK (maxFiles BETWEEN 1 AND 100),
  usedFiles INTEGER NOT NULL DEFAULT 0 CHECK (usedFiles >= 0 AND usedFiles <= maxFiles),
  createdAt INTEGER NOT NULL,
  expiresAt INTEGER NOT NULL,
  completedAt INTEGER
);

CREATE TABLE cloudinary_cleanup_queue (
  publicId TEXT PRIMARY KEY NOT NULL,
  owners TEXT NOT NULL,
  notBefore INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  lastError TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE property_sync_commits (
  propertyId TEXT NOT NULL,
  version INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  PRIMARY KEY (propertyId, version),
  FOREIGN KEY (propertyId) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX upload_sessions_expiry_idx
  ON upload_sessions (expiresAt, completedAt);
CREATE INDEX cloudinary_cleanup_due_idx
  ON cloudinary_cleanup_queue (notBefore, attempts);

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY NOT NULL,
  sourceId TEXT UNIQUE,
  syncSource TEXT,
  sourceUpdatedAt TEXT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  operation TEXT NOT NULL,
  type TEXT NOT NULL,
  price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  bedrooms INTEGER,
  bathrooms REAL,
  area REAL,
  lotArea REAL,
  parking INTEGER,
  yearBuilt INTEGER,
  city TEXT NOT NULL COLLATE NOCASE,
  state TEXT NOT NULL DEFAULT 'Veracruz',
  country TEXT NOT NULL DEFAULT 'México',
  address TEXT,
  lat REAL,
  lng REAL,
  features TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0, 1)),
  views INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY NOT NULL,
  url TEXT NOT NULL,
  publicId TEXT,
  alt TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  isMain INTEGER NOT NULL DEFAULT 0 CHECK (isMain IN (0, 1)),
  sourceFilename TEXT,
  checksum TEXT,
  originalBytes INTEGER,
  optimizedBytes INTEGER,
  width INTEGER,
  height INTEGER,
  duration REAL,
  codec TEXT,
  qualityPreset TEXT,
  propertyId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (propertyId) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  propertyId TEXT,
  honeypot TEXT,
  isRead INTEGER NOT NULL DEFAULT 0 CHECK (isRead IN (0, 1)),
  createdAt TEXT NOT NULL,
  FOREIGN KEY (propertyId) REFERENCES properties(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS properties_catalog_idx
  ON properties (published, featured, createdAt DESC);
CREATE INDEX IF NOT EXISTS properties_location_idx
  ON properties (city, operation, type);
CREATE INDEX IF NOT EXISTS photos_property_order_idx
  ON photos (propertyId, "order");
CREATE INDEX IF NOT EXISTS photos_source_idx
  ON photos (propertyId, sourceFilename);
CREATE INDEX IF NOT EXISTS inquiries_created_idx
  ON inquiries (createdAt DESC);

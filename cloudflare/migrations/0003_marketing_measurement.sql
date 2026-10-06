CREATE TABLE IF NOT EXISTS marketing_settings (id INTEGER PRIMARY KEY CHECK(id=1), config TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS marketing_events (
 id TEXT PRIMARY KEY, sessionId TEXT NOT NULL, event TEXT NOT NULL, path TEXT NOT NULL,
 propertyId TEXT, source TEXT NOT NULL, medium TEXT, campaign TEXT, content TEXT,
 experiment TEXT, variant TEXT, createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS marketing_events_date ON marketing_events(createdAt,event);
CREATE INDEX IF NOT EXISTS marketing_events_session ON marketing_events(sessionId,createdAt);
CREATE TABLE IF NOT EXISTS inquiry_marketing (
 inquiryId TEXT PRIMARY KEY REFERENCES inquiries(id) ON DELETE CASCADE,
 requestId TEXT UNIQUE NOT NULL, attribution TEXT NOT NULL, stage TEXT NOT NULL DEFAULT 'nuevo',
 updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS crm_outbox (
 inquiryId TEXT PRIMARY KEY REFERENCES inquiries(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 contactId TEXT, lastError TEXT, updatedAt TEXT NOT NULL
);

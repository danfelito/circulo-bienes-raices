-- Extend property records so folder imports are idempotent and traceable.
ALTER TABLE "properties"
  ADD COLUMN "referenceCode" TEXT,
  ADD COLUMN "shortDescription" TEXT,
  ADD COLUMN "neighborhood" TEXT,
  ADD COLUMN "contactName" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "whatsapp" TEXT,
  ADD COLUMN "sourceType" TEXT,
  ADD COLUMN "sourceFolder" TEXT,
  ADD COLUMN "sourceHash" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "properties_referenceCode_key" ON "properties"("referenceCode");
CREATE INDEX "properties_published_createdAt_idx" ON "properties"("published", "createdAt");
CREATE INDEX "properties_city_idx" ON "properties"("city");
CREATE INDEX "photos_propertyId_order_idx" ON "photos"("propertyId", "order");

CREATE TABLE "import_jobs" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "sourceType" TEXT NOT NULL DEFAULT 'ADMIN_FOLDER',
  "originalFilename" TEXT,
  "totalProperties" INTEGER NOT NULL DEFAULT 0,
  "successfulProperties" INTEGER NOT NULL DEFAULT 0,
  "failedProperties" INTEGER NOT NULL DEFAULT 0,
  "skippedProperties" INTEGER NOT NULL DEFAULT 0,
  "errors" TEXT,
  "createdById" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_jobs_createdAt_idx" ON "import_jobs"("createdAt");

ALTER TABLE "import_jobs"
  ADD CONSTRAINT "import_jobs_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

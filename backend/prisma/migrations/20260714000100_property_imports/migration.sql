-- Extend properties for idempotent folder imports and archiving
ALTER TABLE "properties"
  ADD COLUMN "referenceCode" TEXT,
  ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "sourceFolder" TEXT,
  ADD COLUMN "sourceHash" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "properties_referenceCode_key" ON "properties"("referenceCode");
CREATE INDEX "properties_published_createdAt_idx" ON "properties"("published", "createdAt");
CREATE INDEX "properties_city_idx" ON "properties"("city");
CREATE INDEX "photos_propertyId_order_idx" ON "photos"("propertyId", "order");
CREATE INDEX "inquiries_isRead_createdAt_idx" ON "inquiries"("isRead", "createdAt");

CREATE TABLE "import_jobs" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "sourceType" TEXT NOT NULL DEFAULT 'ADMIN_FOLDER',
  "originalFilename" TEXT,
  "totalProperties" INTEGER NOT NULL DEFAULT 0,
  "successfulProperties" INTEGER NOT NULL DEFAULT 0,
  "failedProperties" INTEGER NOT NULL DEFAULT 0,
  "errors" TEXT,
  "createdById" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_jobs_createdAt_idx" ON "import_jobs"("createdAt");

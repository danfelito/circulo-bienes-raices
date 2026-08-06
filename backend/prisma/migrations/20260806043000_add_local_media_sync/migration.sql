ALTER TABLE "properties"
  ADD COLUMN "sourceId" TEXT,
  ADD COLUMN "syncSource" TEXT,
  ADD COLUMN "sourceUpdatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "properties_sourceId_key" ON "properties"("sourceId");

ALTER TABLE "photos"
  ADD COLUMN "sourceFilename" TEXT,
  ADD COLUMN "checksum" TEXT,
  ADD COLUMN "originalBytes" INTEGER,
  ADD COLUMN "optimizedBytes" INTEGER,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "duration" DOUBLE PRECISION,
  ADD COLUMN "codec" TEXT,
  ADD COLUMN "qualityPreset" TEXT;

CREATE INDEX "photos_propertyId_sourceFilename_idx" ON "photos"("propertyId", "sourceFilename");

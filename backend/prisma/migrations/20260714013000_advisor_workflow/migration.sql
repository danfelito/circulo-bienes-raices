-- Advisor approval workflow and property ownership
ALTER TABLE "users"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN "approvalTokenHash" TEXT,
  ADD COLUMN "approvalTokenExpires" TIMESTAMP(3);

ALTER TABLE "properties"
  ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN "createdById" TEXT;

ALTER TABLE "photos"
  ADD COLUMN "mediaType" TEXT NOT NULL DEFAULT 'image',
  ADD COLUMN "resourceType" TEXT NOT NULL DEFAULT 'image';

CREATE INDEX "properties_createdById_idx" ON "properties"("createdById");

ALTER TABLE "properties"
  ADD CONSTRAINT "properties_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

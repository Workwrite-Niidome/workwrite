-- Add URL import fields to WorkImport
ALTER TABLE "WorkImport" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;
ALTER TABLE "WorkImport" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Index for duplicate detection
CREATE INDEX IF NOT EXISTS "WorkImport_sourceUrl_idx" ON "WorkImport"("sourceUrl");

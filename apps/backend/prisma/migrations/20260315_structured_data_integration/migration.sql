-- AlterTable: WorkEmbedding - add structured data fields
ALTER TABLE "WorkEmbedding" ADD COLUMN IF NOT EXISTS "characters" JSONB;
ALTER TABLE "WorkEmbedding" ADD COLUMN IF NOT EXISTS "worldType" TEXT;
ALTER TABLE "WorkEmbedding" ADD COLUMN IF NOT EXISTS "emotionProfile" JSONB;
ALTER TABLE "WorkEmbedding" ADD COLUMN IF NOT EXISTS "subGenre" TEXT;

-- AlterTable: WorkCreationPlan - add reader visibility flags
ALTER TABLE "WorkCreationPlan" ADD COLUMN IF NOT EXISTS "isWorldPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkCreationPlan" ADD COLUMN IF NOT EXISTS "isEmotionPublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: QualityScore - add new sub-axes
ALTER TABLE "QualityScore" ADD COLUMN IF NOT EXISTS "characterDepth" DOUBLE PRECISION;
ALTER TABLE "QualityScore" ADD COLUMN IF NOT EXISTS "structuralScore" DOUBLE PRECISION;

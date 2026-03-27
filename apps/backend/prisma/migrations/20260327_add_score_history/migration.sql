-- CreateTable
CREATE TABLE "ScoreHistory" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "immersion" DOUBLE PRECISION NOT NULL,
    "transformation" DOUBLE PRECISION NOT NULL,
    "virality" DOUBLE PRECISION NOT NULL,
    "worldBuilding" DOUBLE PRECISION NOT NULL,
    "characterDepth" DOUBLE PRECISION,
    "structuralScore" DOUBLE PRECISION,
    "overall" DOUBLE PRECISION NOT NULL,
    "analysisJson" JSONB,
    "improvementTips" JSONB,
    "emotionTags" JSONB,
    "model" TEXT NOT NULL,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoreHistory_workId_scoredAt_idx" ON "ScoreHistory"("workId", "scoredAt" DESC);

-- AddForeignKey
ALTER TABLE "ScoreHistory" ADD CONSTRAINT "ScoreHistory_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

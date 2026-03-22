-- Add new CreditTxType values
ALTER TYPE "CreditTxType" ADD VALUE IF NOT EXISTS 'REVIEW_REWARD';
ALTER TYPE "CreditTxType" ADD VALUE IF NOT EXISTS 'REFERRAL_REWARD';

-- Create EpisodeReaction table
CREATE TABLE "EpisodeReaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "claps" INTEGER NOT NULL DEFAULT 1,
    "emotion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EpisodeReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EpisodeReaction_userId_episodeId_key" ON "EpisodeReaction"("userId", "episodeId");
CREATE INDEX "EpisodeReaction_workId_idx" ON "EpisodeReaction"("workId");
CREATE INDEX "EpisodeReaction_episodeId_idx" ON "EpisodeReaction"("episodeId");
CREATE INDEX "EpisodeReaction_createdAt_idx" ON "EpisodeReaction"("createdAt");

ALTER TABLE "EpisodeReaction" ADD CONSTRAINT "EpisodeReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EpisodeReaction" ADD CONSTRAINT "EpisodeReaction_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EpisodeReaction" ADD CONSTRAINT "EpisodeReaction_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add character talk columns to AiConversation
ALTER TABLE "AiConversation" ADD COLUMN "characterId" TEXT;
ALTER TABLE "AiConversation" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'companion';
ALTER TABLE "AiConversation" ADD COLUMN "messageCount" INTEGER NOT NULL DEFAULT 0;

-- DropIndex
DROP INDEX IF EXISTS "AiConversation_userId_workId_key";

-- CreateIndex
CREATE UNIQUE INDEX "AiConversation_userId_workId_mode_characterId_key" ON "AiConversation"("userId", "workId", "mode", COALESCE("characterId", '__none__'));
CREATE INDEX IF NOT EXISTS "AiConversation_userId_workId_idx" ON "AiConversation"("userId", "workId");

-- CreateTable: CharacterTalkRevenue
CREATE TABLE "CharacterTalkRevenue" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "readerId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "characterId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'character',
    "creditAmount" INTEGER NOT NULL,
    "revenueYen" INTEGER NOT NULL,
    "creditTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CharacterTalkRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CharacterTalkRevenue_authorId_createdAt_idx" ON "CharacterTalkRevenue"("authorId", "createdAt");
CREATE INDEX "CharacterTalkRevenue_workId_idx" ON "CharacterTalkRevenue"("workId");

-- CreateTable
CREATE TABLE "EditorModeJob" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'designing',
    "aiMode" TEXT NOT NULL DEFAULT 'normal',
    "generationMode" TEXT NOT NULL DEFAULT 'batch',
    "totalEpisodes" INTEGER NOT NULL DEFAULT 0,
    "completedEpisodes" INTEGER NOT NULL DEFAULT 0,
    "creditsConsumed" INTEGER NOT NULL DEFAULT 0,
    "designChatHistory" JSONB,
    "episodePlan" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorModeJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EditorModeJob_workId_key" ON "EditorModeJob"("workId");

-- CreateIndex
CREATE INDEX "EditorModeJob_userId_idx" ON "EditorModeJob"("userId");

-- CreateIndex (composite on Work for AI-generated queries)
CREATE INDEX "Work_status_isAiGenerated_idx" ON "Work"("status", "isAiGenerated");

-- AddForeignKey
ALTER TABLE "EditorModeJob" ADD CONSTRAINT "EditorModeJob_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorModeJob" ADD CONSTRAINT "EditorModeJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

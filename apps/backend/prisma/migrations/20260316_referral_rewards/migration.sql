-- CreateTable
CREATE TABLE IF NOT EXISTS "ReferralReward" (
    "id" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "creditAmount" INTEGER NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralReward_inviterId_inviteeId_triggerEvent_key"
    ON "ReferralReward"("inviterId", "inviteeId", "triggerEvent");
CREATE INDEX IF NOT EXISTS "ReferralReward_inviterId_idx" ON "ReferralReward"("inviterId");
CREATE INDEX IF NOT EXISTS "ReferralReward_inviteeId_idx" ON "ReferralReward"("inviteeId");

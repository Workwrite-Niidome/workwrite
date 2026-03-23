-- AlterTable: Add rewardBalance and rewardExpiresAt to CreditBalance
-- These are additive columns with defaults, no existing data is affected.
ALTER TABLE "CreditBalance" ADD COLUMN IF NOT EXISTS "rewardBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CreditBalance" ADD COLUMN IF NOT EXISTS "rewardExpiresAt" TIMESTAMP(3);

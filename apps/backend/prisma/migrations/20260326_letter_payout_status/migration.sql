-- AlterTable: Add payout tracking to Letter
ALTER TABLE "Letter" ADD COLUMN "payoutStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Letter" ADD COLUMN "payoutTransferId" TEXT;

-- CreateIndex
CREATE INDEX "Letter_payoutStatus_idx" ON "Letter"("payoutStatus");

-- Backfill: Mark existing letters (which used destination charges) as already transferred
UPDATE "Letter" SET "payoutStatus" = 'transferred' WHERE "paymentId" IS NOT NULL;

-- Fix: Letters created via webhook with pending moderationStatus should be approved
UPDATE "Letter" SET "moderationStatus" = 'approved' WHERE "paymentId" IS NOT NULL AND "moderationStatus" = 'pending';

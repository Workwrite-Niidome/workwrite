-- AlterTable
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN "referralCredits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "referredBy" TEXT;
ALTER TABLE "User" ADD COLUMN "referralCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateEnum
CREATE TYPE "CompletionStatus" AS ENUM ('ONGOING', 'COMPLETED', 'HIATUS');

-- AlterTable
ALTER TABLE "Work" ADD COLUMN "completionStatus" "CompletionStatus" NOT NULL DEFAULT 'ONGOING';

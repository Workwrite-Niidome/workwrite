-- Add onDelete: Cascade to User relations that were missing it
-- This ensures account deletion properly cascades to all related data

-- Work.authorId -> User.id
ALTER TABLE "Work" DROP CONSTRAINT IF EXISTS "Work_authorId_fkey";
ALTER TABLE "Work" ADD CONSTRAINT "Work_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Episode.authorId -> User.id
ALTER TABLE "Episode" DROP CONSTRAINT IF EXISTS "Episode_authorId_fkey";
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Letter.senderId -> User.id
ALTER TABLE "Letter" DROP CONSTRAINT IF EXISTS "Letter_senderId_fkey";
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Letter.recipientId -> User.id
ALTER TABLE "Letter" DROP CONSTRAINT IF EXISTS "Letter_recipientId_fkey";
ALTER TABLE "Letter" ADD CONSTRAINT "Letter_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PendingLetter.senderId -> User.id
ALTER TABLE "PendingLetter" DROP CONSTRAINT IF EXISTS "PendingLetter_senderId_fkey";
ALTER TABLE "PendingLetter" ADD CONSTRAINT "PendingLetter_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PendingLetter.recipientId -> User.id
ALTER TABLE "PendingLetter" DROP CONSTRAINT IF EXISTS "PendingLetter_recipientId_fkey";
ALTER TABLE "PendingLetter" ADD CONSTRAINT "PendingLetter_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EditorModeJob.userId -> User.id
ALTER TABLE "EditorModeJob" DROP CONSTRAINT IF EXISTS "EditorModeJob_userId_fkey";
ALTER TABLE "EditorModeJob" ADD CONSTRAINT "EditorModeJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

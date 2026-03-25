-- Revenue system + PendingLetter for Stripe Checkout letter flow
-- Safe: all operations are additive (CREATE TABLE, ADD COLUMN). No data loss risk.

-- ============================================================
-- 1. AuthorPayout table (for monthly character talk payouts)
-- ============================================================
CREATE TABLE IF NOT EXISTS "AuthorPayout" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "stripeTransferId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorPayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthorPayout_stripeTransferId_key" ON "AuthorPayout"("stripeTransferId");
CREATE INDEX IF NOT EXISTS "AuthorPayout_authorId_createdAt_idx" ON "AuthorPayout"("authorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuthorPayout_status_idx" ON "AuthorPayout"("status");

-- ============================================================
-- 2. Add payoutId to CharacterTalkRevenue (link to AuthorPayout)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'CharacterTalkRevenue' AND column_name = 'payoutId'
    ) THEN
        ALTER TABLE "CharacterTalkRevenue" ADD COLUMN "payoutId" TEXT;
    END IF;
END $$;

-- FK: CharacterTalkRevenue.payoutId -> AuthorPayout.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'CharacterTalkRevenue_payoutId_fkey'
    ) THEN
        ALTER TABLE "CharacterTalkRevenue"
            ADD CONSTRAINT "CharacterTalkRevenue_payoutId_fkey"
            FOREIGN KEY ("payoutId") REFERENCES "AuthorPayout"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CharacterTalkRevenue_payoutId_idx" ON "CharacterTalkRevenue"("payoutId");

-- ============================================================
-- 3. PendingLetter table (for Stripe Checkout letter flow)
-- ============================================================
CREATE TABLE IF NOT EXISTS "PendingLetter" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "type" "LetterType" NOT NULL,
    "content" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "stampId" TEXT,
    "giftAmount" INTEGER,
    "moderationStatus" TEXT NOT NULL DEFAULT 'approved',
    "moderationReason" TEXT,
    "stripeSessionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingLetter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PendingLetter_stripeSessionId_key" ON "PendingLetter"("stripeSessionId");
CREATE INDEX IF NOT EXISTS "PendingLetter_senderId_idx" ON "PendingLetter"("senderId");
CREATE INDEX IF NOT EXISTS "PendingLetter_recipientId_idx" ON "PendingLetter"("recipientId");
CREATE INDEX IF NOT EXISTS "PendingLetter_stripeSessionId_idx" ON "PendingLetter"("stripeSessionId");
CREATE INDEX IF NOT EXISTS "PendingLetter_expiresAt_idx" ON "PendingLetter"("expiresAt");

-- FK: PendingLetter.senderId -> User.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'PendingLetter_senderId_fkey'
    ) THEN
        ALTER TABLE "PendingLetter"
            ADD CONSTRAINT "PendingLetter_senderId_fkey"
            FOREIGN KEY ("senderId") REFERENCES "User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- FK: PendingLetter.recipientId -> User.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'PendingLetter_recipientId_fkey'
    ) THEN
        ALTER TABLE "PendingLetter"
            ADD CONSTRAINT "PendingLetter_recipientId_fkey"
            FOREIGN KEY ("recipientId") REFERENCES "User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- FK: PendingLetter.episodeId -> Episode.id (CASCADE on delete)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'PendingLetter_episodeId_fkey'
    ) THEN
        ALTER TABLE "PendingLetter"
            ADD CONSTRAINT "PendingLetter_episodeId_fkey"
            FOREIGN KEY ("episodeId") REFERENCES "Episode"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

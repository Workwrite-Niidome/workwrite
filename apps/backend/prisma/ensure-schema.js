/**
 * Startup schema safety net.
 * Runs idempotent ALTER TABLE statements to ensure critical columns exist,
 * even if `prisma db push` fails or is skipped.
 *
 * IMPORTANT: Each DDL statement must be a separate $executeRawUnsafe call.
 * Batching multiple statements in one call may silently skip some.
 */
const { PrismaClient } = require('@prisma/client');

async function ensureSchema() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.log('[ensure-schema] Connected to database');

    // Referral columns (added 2026-03-22)
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCredits" INTEGER NOT NULL DEFAULT 0`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredBy" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCount" INTEGER NOT NULL DEFAULT 0`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode")`);

    // Character Talk columns on AiConversation (added 2026-03-23)
    await prisma.$executeRawUnsafe(`ALTER TABLE "AiConversation" ADD COLUMN IF NOT EXISTS "characterId" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "AiConversation" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'companion'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "AiConversation" ADD COLUMN IF NOT EXISTS "messageCount" INTEGER NOT NULL DEFAULT 0`);
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "AiConversation_userId_workId_key"`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "AiConversation_userId_workId_mode_characterId_key" ON "AiConversation"("userId", "workId", "mode", COALESCE("characterId", '__none__'))`);

    // CharacterTalkRevenue table (added 2026-03-23)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CharacterTalkRevenue" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
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
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CharacterTalkRevenue_authorId_createdAt_idx" ON "CharacterTalkRevenue"("authorId", "createdAt")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CharacterTalkRevenue_workId_idx" ON "CharacterTalkRevenue"("workId")`);

    // Episode extractedCharacters column (added 2026-03-23)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Episode" ADD COLUMN IF NOT EXISTS "extractedCharacters" JSONB`);

    // One-time clear: re-extract with improved matching (2026-03-23 v3)
    const cleared = await prisma.$executeRawUnsafe(
      `UPDATE "Episode" SET "extractedCharacters" = NULL WHERE "extractedCharacters" IS NOT NULL AND "updatedAt" < '2026-03-25'`
    );
    if (cleared > 0) console.log(`[ensure-schema] Cleared ${cleared} old extractedCharacters for re-extraction`);

    // Work enableCharacterTalk column (added 2026-03-23)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "enableCharacterTalk" BOOLEAN NOT NULL DEFAULT true`);

    console.log('[ensure-schema] Schema verified successfully');
  } catch (error) {
    console.error('[ensure-schema] ERROR:', error.message, error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

ensureSchema();

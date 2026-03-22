/**
 * Startup schema safety net.
 * Runs idempotent ALTER TABLE statements to ensure critical columns exist,
 * even if `prisma db push` fails or is skipped.
 */
const { PrismaClient } = require('@prisma/client');

async function ensureSchema() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.log('[ensure-schema] Connected to database');

    // Referral columns (added 2026-03-22)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCredits" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredBy" TEXT;
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCount" INTEGER NOT NULL DEFAULT 0;
    `);

    // Unique index (idempotent)
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");
    `);

    console.log('[ensure-schema] Schema verified successfully');
  } catch (error) {
    console.error('[ensure-schema] ERROR:', error.message);
    // Don't crash the server - log and continue
  } finally {
    await prisma.$disconnect();
  }
}

ensureSchema();

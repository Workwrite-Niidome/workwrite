#!/usr/bin/env node
/**
 * Avatar Backup Script
 *
 * Run LOCALLY before adding Railway Volume.
 * Downloads all uploaded avatar files from the production backend.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." BACKEND_URL="https://backend-production-db434.up.railway.app" node scripts/avatar-backup.mjs
 *
 * Output:
 *   ./avatar-backup/
 *     manifest.json   — mapping of userId -> filename -> original URL
 *     <uuid>.jpg      — avatar image files
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

// Prisma requires generate step; use raw pg query instead for portability
import { createRequire } from 'node:module';

const DATABASE_URL = process.env.DATABASE_URL;
const BACKEND_URL = process.env.BACKEND_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is required');
  console.error('  export DATABASE_URL="postgresql://user:pass@host:5432/db"');
  process.exit(1);
}
if (!BACKEND_URL) {
  console.error('ERROR: BACKEND_URL is required');
  console.error('  export BACKEND_URL="https://backend-production-db434.up.railway.app"');
  process.exit(1);
}

const BACKUP_DIR = join(process.cwd(), 'avatar-backup');

async function queryUsers() {
  // Dynamic import pg (install if needed: npm i pg)
  let pg;
  try {
    pg = await import('pg');
  } catch {
    console.error('ERROR: "pg" package not found. Install it first:');
    console.error('  npm i --no-save pg');
    process.exit(1);
  }

  const client = new pg.default.Client({ connectionString: DATABASE_URL });
  await client.connect();

  const result = await client.query(
    `SELECT id, "avatarUrl" FROM "User" WHERE "avatarUrl" IS NOT NULL AND "avatarUrl" LIKE '%/uploads/avatars/%'`
  );

  await client.end();
  return result.rows;
}

async function main() {
  console.log('=== Avatar Backup ===\n');

  const users = await queryUsers();
  console.log(`Found ${users.length} users with uploaded avatars\n`);

  if (users.length === 0) {
    console.log('Nothing to back up.');
    return;
  }

  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

  const manifest = [];
  let success = 0;
  let failed = 0;

  for (const user of users) {
    const url = user.avatarUrl;
    const filename = basename(new URL(url).pathname);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`  SKIP ${user.id}: HTTP ${res.status} (file already missing)`);
        manifest.push({ userId: user.id, filename, originalUrl: url, status: 'missing' });
        failed++;
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      writeFileSync(join(BACKUP_DIR, filename), buffer);
      manifest.push({ userId: user.id, filename, originalUrl: url, status: 'backed_up' });
      console.log(`  OK   ${user.id}: ${filename} (${(buffer.length / 1024).toFixed(1)}KB)`);
      success++;
    } catch (err) {
      console.warn(`  FAIL ${user.id}: ${err.message}`);
      manifest.push({ userId: user.id, filename, originalUrl: url, status: 'error', error: err.message });
      failed++;
    }
  }

  writeFileSync(join(BACKUP_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\n=== Summary ===`);
  console.log(`  Backed up: ${success}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Output:    ${BACKUP_DIR}/`);
  console.log(`\nNext steps:`);
  console.log(`  1. Add Railway Volume (mount path: /data)`);
  console.log(`  2. Wait for redeploy to complete`);
  console.log(`  3. Run restore: railway run node scripts/avatar-restore.mjs`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

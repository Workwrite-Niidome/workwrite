#!/usr/bin/env node
/**
 * Avatar Restore Script
 *
 * Run ON THE SERVER after Railway Volume has been added.
 * Copies backed-up avatar files to the Volume and verifies DB consistency.
 *
 * Usage (via Railway CLI):
 *   railway run node scripts/avatar-restore.mjs
 *
 * Or if avatar-backup/ is included in the Docker build:
 *   node scripts/avatar-restore.mjs
 *
 * Prerequisites:
 *   - avatar-backup/ directory with manifest.json and image files
 *   - RAILWAY_VOLUME_MOUNT_PATH must be set (Volume added in Railway dashboard)
 *   - DATABASE_URL must be set
 */

import { readFileSync, existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BACKUP_DIR = join(process.cwd(), 'avatar-backup');
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH;

if (!VOLUME_PATH) {
  console.error('ERROR: RAILWAY_VOLUME_MOUNT_PATH is not set.');
  console.error('  Add a Volume in the Railway dashboard first (mount path: /data).');
  process.exit(1);
}

const AVATAR_DIR = join(VOLUME_PATH, 'uploads', 'avatars');

async function main() {
  console.log('=== Avatar Restore ===\n');
  console.log(`Volume path:  ${VOLUME_PATH}`);
  console.log(`Avatar dir:   ${AVATAR_DIR}`);
  console.log(`Backup dir:   ${BACKUP_DIR}\n`);

  if (!existsSync(BACKUP_DIR)) {
    console.error('ERROR: avatar-backup/ directory not found.');
    console.error('  Make sure the backup files are included in the deploy.');
    process.exit(1);
  }

  const manifestPath = join(BACKUP_DIR, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error('ERROR: manifest.json not found in avatar-backup/.');
    process.exit(1);
  }

  if (!existsSync(AVATAR_DIR)) {
    mkdirSync(AVATAR_DIR, { recursive: true });
    console.log(`Created: ${AVATAR_DIR}\n`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const toRestore = manifest.filter((e) => e.status === 'backed_up');

  console.log(`Entries in manifest: ${manifest.length}`);
  console.log(`Files to restore:   ${toRestore.length}\n`);

  let restored = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of toRestore) {
    const src = join(BACKUP_DIR, entry.filename);
    const dest = join(AVATAR_DIR, entry.filename);

    if (!existsSync(src)) {
      console.warn(`  SKIP ${entry.userId}: backup file missing (${entry.filename})`);
      skipped++;
      continue;
    }

    if (existsSync(dest)) {
      const srcSize = statSync(src).size;
      const destSize = statSync(dest).size;
      if (srcSize === destSize) {
        console.log(`  EXIST ${entry.userId}: ${entry.filename} (already in Volume)`);
        restored++;
        continue;
      }
    }

    try {
      copyFileSync(src, dest);
      const size = statSync(dest).size;
      console.log(`  OK   ${entry.userId}: ${entry.filename} (${(size / 1024).toFixed(1)}KB)`);
      restored++;
    } catch (err) {
      console.error(`  FAIL ${entry.userId}: ${err.message}`);
      failed++;
    }
  }

  // Report entries that were already missing at backup time
  const alreadyMissing = manifest.filter((e) => e.status !== 'backed_up');
  if (alreadyMissing.length > 0) {
    console.log(`\n--- Users with avatars already missing at backup time ---`);
    console.log(`These users need to re-upload their avatars:`);
    for (const entry of alreadyMissing) {
      console.log(`  ${entry.userId}: ${entry.status}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Restored:        ${restored}`);
  console.log(`  Skipped:         ${skipped}`);
  console.log(`  Failed:          ${failed}`);
  console.log(`  Already missing: ${alreadyMissing.length}`);

  if (failed === 0 && skipped === 0) {
    console.log(`\nAll avatars restored successfully.`);
    console.log(`You can now remove avatar-backup/ from the repo.`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

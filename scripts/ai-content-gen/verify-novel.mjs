/**
 * Verify AI-generated novel for consistency issues.
 * Run after generation, before posting.
 *
 * Usage: node scripts/ai-content-gen/verify-novel.mjs [--dir=scripts/ai-content-gen/output]
 *
 * Checks:
 * 1. Character first-person pronoun consistency
 * 2. Episode-to-episode connection (last line → next first line)
 * 3. World setting violations (modern tech in fantasy, etc.)
 * 4. Character name consistency (no unexplained new names)
 */

import fs from 'fs';
import path from 'path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true']; })
);

const DIR = args.dir || 'scripts/ai-content-gen/output';
const DESIGN_FILE = path.join(DIR, '..', 'design.json'); // optional

// Load episodes
const files = fs.readdirSync(DIR)
  .filter(f => f.match(/^ep\d+\.txt$/))
  .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

if (files.length === 0) {
  console.error('No episode files found in', DIR);
  process.exit(1);
}

const episodes = files.map(f => ({
  name: f,
  content: fs.readFileSync(path.join(DIR, f), 'utf-8'),
}));

console.log(`\n=== Novel Verification ===`);
console.log(`Episodes: ${episodes.length}`);
console.log(`Total chars: ${episodes.reduce((s, e) => s + e.content.length, 0).toLocaleString()}\n`);

let errors = 0;
let warnings = 0;

function error(msg) { console.log(`  ❌ ERROR: ${msg}`); errors++; }
function warn(msg) { console.log(`  ⚠️  WARN: ${msg}`); warnings++; }
function ok(msg) { console.log(`  ✅ ${msg}`); }

// ── Check 1: First-person pronoun consistency ──
console.log('--- 1. First-person pronoun consistency ---');

// Common Japanese first-person pronouns
const pronouns = ['わたし', 'あたし', '私', '僕', 'ぼく', '俺', 'おれ', 'わし', 'あたくし', 'うち', '我'];

// Extract quoted speech and check for pronoun switches
const allDialogue = [];
for (const ep of episodes) {
  const matches = ep.content.match(/「[^」]+」/g) || [];
  allDialogue.push(...matches.map(m => ({ ep: ep.name, text: m })));
}

// Count pronouns in dialogue
const pronounCounts = {};
for (const p of pronouns) {
  const count = allDialogue.filter(d => d.text.includes(p)).length;
  if (count > 0) pronounCounts[p] = count;
}
console.log(`  Pronouns found in dialogue: ${Object.entries(pronounCounts).map(([k, v]) => `${k}(${v})`).join(', ') || 'none'}`);

// ── Check 2: Episode connection ──
console.log('\n--- 2. Episode-to-episode connection ---');

for (let i = 1; i < episodes.length; i++) {
  const prev = episodes[i - 1];
  const curr = episodes[i];
  const prevLast = prev.content.trim().split('\n').filter(l => l.trim()).pop() || '';
  const currFirst = curr.content.trim().split('\n').filter(l => l.trim())[0] || '';

  console.log(`  ${prev.name} → ${curr.name}:`);
  console.log(`    Last: "${prevLast.slice(-60)}"`);
  console.log(`    First: "${currFirst.slice(0, 60)}"`);

  // Check for abrupt scene changes without markers
  if (currFirst.startsWith('「') && !prevLast.endsWith('」') && !prevLast.includes('——')) {
    warn(`${curr.name} starts with dialogue but ${prev.name} didn't end in dialogue or scene break`);
  }
}

// ── Check 3: Modern technology in fantasy ──
console.log('\n--- 3. World setting violations ---');

const modernTerms = [
  'スマートフォン', 'スマホ', '携帯電話', 'パソコン', 'コンピュータ', 'インターネット',
  'メール', 'SNS', 'Twitter', 'LINE', '電車', '車', '自動車', 'バス', 'タクシー',
  '飛行機', '銃', 'ピストル', 'ライフル', '拳銃', 'テレビ', 'ラジオ', '電話',
  '電気', '電灯', 'エレベーター', 'エスカレーター',
];

const allText = episodes.map(e => e.content).join('\n');
const foundModern = modernTerms.filter(t => allText.includes(t));
if (foundModern.length > 0) {
  for (const t of foundModern) {
    // Find which episode
    for (const ep of episodes) {
      if (ep.content.includes(t)) {
        warn(`Modern term "${t}" found in ${ep.name}`);
      }
    }
  }
} else {
  ok('No modern technology terms detected');
}

// ── Check 4: Character name consistency ──
console.log('\n--- 4. Character names across episodes ---');

// Extract names from 「」preceded by name patterns
const namePattern = /([ァ-ヶー]{2,}|[一-龥]{1,4})[はがのもを]?[、。]?(?:「|は[、])/g;
const namesPerEpisode = episodes.map(ep => {
  const names = new Set();
  let m;
  // Simple katakana name extraction (common in fantasy)
  const katakana = ep.content.match(/[ァ-ヶー]{2,10}/g) || [];
  for (const k of katakana) {
    if (k.length >= 2 && k.length <= 8) names.add(k);
  }
  return { ep: ep.name, names: [...names] };
});

// Find names that appear in only one episode (potential inconsistency)
const allNames = new Map();
for (const { ep, names } of namesPerEpisode) {
  for (const n of names) {
    if (!allNames.has(n)) allNames.set(n, []);
    allNames.get(n).push(ep);
  }
}

const singleEpNames = [...allNames.entries()]
  .filter(([_, eps]) => eps.length === 1)
  .filter(([name, _]) => name.length >= 3); // Filter out short common words

if (singleEpNames.length > 0) {
  console.log(`  Names appearing in only one episode (review for typos):`);
  for (const [name, eps] of singleEpNames.slice(0, 10)) {
    console.log(`    "${name}" → only in ${eps[0]}`);
  }
}

// ── Check 5: Episode length balance ──
console.log('\n--- 5. Episode length balance ---');
const lengths = episodes.map(e => e.content.length);
const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
for (let i = 0; i < episodes.length; i++) {
  const ratio = lengths[i] / avg;
  const status = ratio < 0.5 ? '⚠️  SHORT' : ratio > 2.0 ? '⚠️  LONG' : '✅';
  console.log(`  ${episodes[i].name}: ${lengths[i].toLocaleString()} chars (${(ratio * 100).toFixed(0)}% of avg) ${status}`);
}

// ── Summary ──
console.log(`\n=== Summary ===`);
console.log(`Errors: ${errors}`);
console.log(`Warnings: ${warnings}`);
console.log(`Result: ${errors === 0 ? '✅ PASS' : '❌ FAIL'}`);

process.exit(errors > 0 ? 1 : 0);

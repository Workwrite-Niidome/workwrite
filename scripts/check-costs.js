const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Recent editor mode transactions
  const editor = await p.creditTransaction.findMany({
    where: { relatedFeature: { contains: 'editor' } },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: { amount: true, relatedFeature: true, relatedModel: true, description: true, createdAt: true, type: true, status: true },
  });

  console.log(`=== Editor Mode Transactions (${editor.length}) ===`);
  let totalEditor = 0;
  for (const t of editor) {
    totalEditor += Math.abs(t.amount);
    console.log(`${t.amount}cr | ${t.relatedFeature} | ${t.relatedModel || '?'} | ${t.status} | ${new Date(t.createdAt).toISOString().slice(0, 16)}`);
  }
  console.log(`Total: ${totalEditor}cr`);

  // All CONSUME transactions
  const all = await p.creditTransaction.findMany({
    where: { type: 'CONSUME' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { amount: true, relatedFeature: true, relatedModel: true, status: true, createdAt: true },
  });

  console.log(`\n=== All CONSUME Transactions (${all.length}) ===`);
  const byFeature = {};
  for (const t of all) {
    const f = t.relatedFeature || '(none)';
    if (!byFeature[f]) byFeature[f] = { count: 0, total: 0 };
    byFeature[f].count++;
    byFeature[f].total += Math.abs(t.amount);
  }
  for (const [f, v] of Object.entries(byFeature)) {
    console.log(`${f}: ${v.total}cr (${v.count} txns)`);
  }

  await p.$disconnect();
}

main().catch((e) => { console.error(e.message); process.exit(1); });

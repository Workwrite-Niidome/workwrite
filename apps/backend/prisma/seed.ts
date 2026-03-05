import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMOTION_TAGS = [
  { name: 'courage', nameJa: '勇気が出る', category: 'positive' },
  { name: 'tears', nameJa: '泣ける', category: 'emotional' },
  { name: 'worldview', nameJa: '世界観が変わる', category: 'transformative' },
  { name: 'healing', nameJa: '癒される', category: 'positive' },
  { name: 'excitement', nameJa: 'ワクワクする', category: 'positive' },
  { name: 'thinking', nameJa: '考えさせられる', category: 'reflective' },
  { name: 'laughter', nameJa: '笑える', category: 'positive' },
  { name: 'empathy', nameJa: '共感する', category: 'emotional' },
  { name: 'awe', nameJa: '畏敬の念', category: 'transformative' },
  { name: 'nostalgia', nameJa: '懐かしい', category: 'emotional' },
  { name: 'suspense', nameJa: 'ハラハラする', category: 'exciting' },
  { name: 'mystery', nameJa: '謎が深まる', category: 'reflective' },
  { name: 'hope', nameJa: '希望が持てる', category: 'positive' },
  { name: 'beauty', nameJa: '美しい', category: 'aesthetic' },
  { name: 'growth', nameJa: '成長を感じる', category: 'transformative' },
];

async function main() {
  console.log('Seeding emotion tag master...');

  for (const tag of EMOTION_TAGS) {
    await prisma.emotionTagMaster.upsert({
      where: { name: tag.name },
      update: { nameJa: tag.nameJa, category: tag.category },
      create: tag,
    });
  }

  console.log(`Seeded ${EMOTION_TAGS.length} emotion tags.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

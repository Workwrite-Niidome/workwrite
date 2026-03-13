import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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

  // Seed prompt templates
  console.log('Seeding prompt templates...');
  const TEMPLATES = [
    {
      slug: 'continue-writing', name: '続きを書く', category: 'writing',
      description: '現在の文体とトーンを維持しながら、物語の続きを生成します',
      prompt: 'あなたは小説の執筆アシスタントです。以下の文章の続きを、同じ文体・トーン・視点を維持しながら自然に書き続けてください。\n\n【これまでの文章】\n{{content}}\n\n【指示】\n- 既存の文体、語り口、テンポを忠実に再現してください\n- キャラクターの性格や口調の一貫性を保ってください\n- 自然な流れで500〜1000文字程度の続きを書いてください',
      variables: ['content'], sortOrder: 0,
    },
    {
      slug: 'character-dev', name: 'キャラクター深掘り', category: 'writing',
      description: 'キャラクターの内面、背景、動機を深掘りした描写を提案します',
      prompt: 'あなたは小説の執筆アシスタントです。以下のテキストに登場する「{{character_name}}」というキャラクターについて、より深みのある描写を提案してください。\n\n【テキスト】\n{{content}}\n\n【指示】\n- このキャラクターの内面を掘り下げてください\n- 過去の経験や背景が現在の行動にどう影響しているかを示してください\n- 500〜800文字程度で描写を書いてください',
      variables: ['content', 'character_name'], sortOrder: 1,
    },
    {
      slug: 'scene-enhance', name: 'シーン描写の強化', category: 'editing',
      description: '五感を活用した、より没入感のあるシーン描写に強化します',
      prompt: 'あなたは小説の編集アシスタントです。以下のシーンの描写を、五感を活用してより没入感のあるものに書き直してください。\n\n【元のテキスト】\n{{content}}\n\n【指示】\n- 視覚だけでなく、音、匂い、温度、質感など多感覚的な描写を加えてください\n- 元のテキストの意図やプロットは変えずに、描写の質を向上させてください',
      variables: ['content'], sortOrder: 2,
    },
    {
      slug: 'dialogue-improve', name: '会話の改善', category: 'editing',
      description: 'より自然で、キャラクターの個性が際立つ会話に改善します',
      prompt: 'あなたは小説の編集アシスタントです。以下の会話シーンを、より自然で個性的なものに改善してください。\n\n【元のテキスト】\n{{content}}\n\n【指示】\n- 各キャラクターが固有の話し方を持つようにしてください\n- 言葉の裏にある感情や意図が感じられるようにしてください\n- 適切な間や仕草の描写を織り交ぜてください',
      variables: ['content'], sortOrder: 3,
    },
    {
      slug: 'plot-ideas', name: 'プロット展開のアイデア', category: 'writing',
      description: '物語の続きとして考えられる3つの展開パターンを提案します',
      prompt: 'あなたは小説のプロットコンサルタントです。以下の物語の続きとして考えられる展開を3つ提案してください。\n\n【ジャンル】{{genre}}\n\n【これまでの物語】\n{{content}}\n\n【指示】\n各アイデアについて、タイトル・概要（100字程度）・物語への影響を書いてください。',
      variables: ['content', 'genre'], sortOrder: 4,
    },
    {
      slug: 'style-adjust', name: '文体の調整', category: 'editing',
      description: '指定された文体に合わせてテキストを調整します',
      prompt: 'あなたは小説の編集アシスタントです。以下のテキストを「{{target_style}}」の文体に調整してください。\n\n【元のテキスト】\n{{content}}\n\n【目標の文体】{{target_style}}\n\n【指示】\n- 元のテキストの内容は保持しながら、文体のみを調整してください',
      variables: ['content', 'target_style'], sortOrder: 5,
    },
    {
      slug: 'proofread', name: '校正・推敲', category: 'editing',
      description: '誤字脱字・文法・表現の改善点を指摘し、修正案を提示します',
      prompt: 'あなたは日本語の校正・推敲の専門家です。以下のテキストを校正・推敲してください。\n\n【テキスト】\n{{content}}\n\n【指示】\n1. 誤字・脱字\n2. 文法的な誤り\n3. 不自然な表現や冗長な表現\n4. 表記の統一性\n5. 句読点の適切さ\n\n各修正箇所について、元の表現→修正案と修正理由を示し、最後に全文を出力してください。',
      variables: ['content'], sortOrder: 6,
    },
    {
      slug: 'synopsis-gen', name: 'あらすじ生成', category: 'generation',
      description: '作品のあらすじを200〜400字で自動生成します',
      prompt: 'あなたは小説のあらすじを書く専門家です。以下の小説本文から、魅力的なあらすじを生成してください。\n\n【本文】\n{{content}}\n\n【指示】\n- 200〜400字のあらすじを書いてください\n- ネタバレは避けつつ、読者の興味を引く内容にしてください\n- 結末は明かさず、期待感を持たせてください',
      variables: ['content'], sortOrder: 7,
    },
  ];

  for (const t of TEMPLATES) {
    await prisma.promptTemplate.upsert({
      where: { slug: t.slug },
      update: { prompt: t.prompt, name: t.name, description: t.description, category: t.category, variables: t.variables },
      create: { ...t, isBuiltIn: true, isActive: true },
    });
  }
  console.log(`Seeded ${TEMPLATES.length} prompt templates.`);

  // Seed CreditBalance for all users that don't have one
  console.log('Seeding credit balances...');
  const usersWithoutBalance = await prisma.user.findMany({
    where: { creditBalance: null },
    select: { id: true },
  });

  let creditCount = 0;
  for (const user of usersWithoutBalance) {
    // Check if user has active subscription
    const sub = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    const plan = sub?.status === 'active' ? sub.plan : 'free';
    const monthlyCredits = plan === 'pro' ? 600 : plan === 'standard' ? 200 : 20;

    await prisma.creditBalance.create({
      data: {
        userId: user.id,
        balance: monthlyCredits,
        monthlyBalance: monthlyCredits,
        purchasedBalance: 0,
        monthlyGranted: monthlyCredits,
        lastGrantedAt: new Date(),
      },
    });

    // Create initial grant transaction
    await prisma.creditTransaction.create({
      data: {
        userId: user.id,
        amount: monthlyCredits,
        type: 'MONTHLY_GRANT',
        status: 'confirmed',
        balance: monthlyCredits,
        description: `Initial credit grant (${plan}: ${monthlyCredits}cr)`,
      },
    });

    creditCount++;
  }
  console.log(`Seeded credit balances for ${creditCount} users.`);

  // Migrate legacy 'premium' subscriptions to 'pro'
  const premiumMigrated = await prisma.subscription.updateMany({
    where: { plan: 'premium' },
    data: { plan: 'pro' },
  });
  if (premiumMigrated.count > 0) {
    console.log(`Migrated ${premiumMigrated.count} 'premium' subscriptions to 'pro'.`);
  }

  // Admin user setup
  const adminEmail = 'niidome@workwrite.co.jp';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existingAdmin) {
    // Always ensure ADMIN role and reset password if env ADMIN_RESET_PASSWORD is set
    const resetPw = process.env.ADMIN_RESET_PASSWORD;
    const updates: Record<string, unknown> = {};
    if (existingAdmin.role !== 'ADMIN') updates.role = 'ADMIN';
    if (resetPw) {
      updates.passwordHash = await bcrypt.hash(resetPw, 12);
      console.log(`Password reset for ${adminEmail}.`);
    }
    if (Object.keys(updates).length > 0) {
      await prisma.user.update({
        where: { email: adminEmail },
        data: updates,
      });
      console.log(`Updated ${adminEmail}: ${Object.keys(updates).join(', ')}`);
    } else {
      console.log(`${adminEmail} is already ADMIN, no changes.`);
    }
  } else {
    const passwordHash = await bcrypt.hash('admin-change-me-immediately', 12);
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin',
        displayName: 'Admin',
        passwordHash,
        role: 'ADMIN',
        emailVerified: true,
      },
    });
    await prisma.pointAccount.create({ data: { userId: adminUser.id } });
    console.log(`Created ADMIN: ${adminEmail} (password: admin-change-me-immediately)`);
    console.log('IMPORTANT: Change this password immediately after first login!');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

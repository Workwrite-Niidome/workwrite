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
      prompt: 'あなたは小説の執筆アシスタントです。system promptに提供された作品構造データ（キャラクター設定、プロット、前話の原文末尾、世界設定など）を参照しながら、以下の文章の続きを書いてください。\n\n【これまでの文章】\n{{content}}\n\n【執筆ルール】\n- system promptの構造データに忠実に従うこと。特にキャラクターの性格・口調・一人称を厳守すること\n- 「直前エピソードの原文末尾」から自然に繋がる続きを書くこと。場所・時間帯・キャラの感情状態が前の場面と矛盾しないこと\n- 「この話で達成すべきこと」が提供されている場合、その目標に向かって物語を進めること\n- 既存の文体、語り口、テンポを忠実に再現すること\n- 新しい場面に転換する場合は、場面転換を明示すること\n- {{char_count}}文字程度の続きを書くこと\n\n【絶対禁止事項】\n- 提供されたテキスト・構造データに記述されていない過去のイベント、会話、約束、決定を「あった」として書かないこと\n- 「〇〇と約束した」「〇〇を決意した」「〇〇を思い出した」等は、提供テキストに明確な根拠がある場合のみ許可\n- キャラクターに設定にない行動・発言をさせないこと\n- 原文に存在しない人物の関係性や過去の出来事を創作しないこと',
      variables: ['content', 'char_count'], sortOrder: 0,
    },
    {
      slug: 'character-dev', name: 'キャラクター深掘り', category: 'writing',
      description: 'キャラクターの内面、背景、動機を深掘りした描写を提案します',
      prompt: 'あなたは小説の執筆アシスタントです。system promptに提供されたキャラクター設定と作品構造データを参照しながら、「{{character_name}}」というキャラクターの描写を深掘りしてください。\n\n【テキスト】\n{{content}}\n\n【指示】\n- system promptのキャラクター設定（性格・口調・一人称・背景・動機）に厳密に従うこと\n- このキャラクターの内面を、設定に基づいて掘り下げてください\n- 過去の経験や背景が現在の行動にどう影響しているかを示してください\n- 500〜800文字程度で描写を書いてください\n\n【絶対禁止事項】\n- 提供されたテキスト・設定データに存在しない過去のエピソードや出来事を捏造しないこと\n- キャラクター設定にない性格特性や背景を創作しないこと',
      variables: ['content', 'character_name'], sortOrder: 1,
    },
    {
      slug: 'scene-enhance', name: 'シーン描写の強化', category: 'editing',
      description: '五感を活用した、より没入感のあるシーン描写に強化します',
      prompt: 'あなたは小説の編集アシスタントです。system promptに提供された世界設定・キャラクター設定を参照しながら、以下のシーンの描写を強化してください。\n\n【元のテキスト】\n{{content}}\n\n【指示】\n- 視覚だけでなく、音、匂い、温度、質感など多感覚的な描写を加えてください\n- 元のテキストの意図やプロットは変えずに、描写の質を向上させてください\n- 世界設定に存在しない技術・概念・物品を追加しないこと\n\n【絶対禁止事項】\n- 元のテキストに存在しないイベントや会話を追加しないこと\n- キャラクターの行動や台詞の意味を変えないこと',
      variables: ['content'], sortOrder: 2,
    },
    {
      slug: 'dialogue-improve', name: '会話の改善', category: 'editing',
      description: 'より自然で、キャラクターの個性が際立つ会話に改善します',
      prompt: 'あなたは小説の編集アシスタントです。system promptに提供されたキャラクター設定（口調・一人称・性格）を厳守しながら、以下の会話シーンを改善してください。\n\n【元のテキスト】\n{{content}}\n\n【指示】\n- 各キャラクターの口調設定・一人称を厳密に守ること\n- 言葉の裏にある感情や意図が感じられるようにしてください\n- 適切な間や仕草の描写を織り交ぜてください\n- 関係性が近いキャラクター同士（幼馴染・家族等）は、口調設定よりも関係性に応じた自然な話し方を優先すること\n\n【絶対禁止事項】\n- 元のテキストにない会話を追加しないこと（改善のみ行う）\n- キャラクター設定にない口調や一人称を使わないこと',
      variables: ['content'], sortOrder: 3,
    },
    {
      slug: 'plot-ideas', name: 'プロット展開のアイデア', category: 'writing',
      description: '物語の続きとして考えられる3つの展開パターンを提案します',
      prompt: 'あなたは小説のプロットコンサルタントです。system promptに提供されたプロット構成・キャラクター設定・伏線情報を参照しながら、以下の物語の続きとして考えられる展開を3つ提案してください。\n\n【ジャンル】{{genre}}\n\n【これまでの物語】\n{{content}}\n\n【指示】\n- 各アイデアについて、タイトル・概要（100字程度）・物語への影響を書いてください\n- 既存のプロット構成や伏線と整合する展開を優先すること\n- キャラクターの性格・動機に基づいた自然な展開にすること\n\n【絶対禁止事項】\n- 提供テキストに存在しない過去の出来事を前提にした展開を提案しないこと',
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

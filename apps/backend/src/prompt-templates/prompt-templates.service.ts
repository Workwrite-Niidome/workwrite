import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePromptTemplateDto, UpdatePromptTemplateDto } from './dto/prompt-template.dto';

@Injectable()
export class PromptTemplatesService {
  constructor(private prisma: PrismaService) {}

  async findActive() {
    return this.prisma.promptTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async findAll() {
    return this.prisma.promptTemplate.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async findBySlug(slug: string) {
    const template = await this.prisma.promptTemplate.findUnique({ where: { slug } });
    if (!template) throw new NotFoundException(`Template '${slug}' not found`);
    return template;
  }

  async create(dto: CreatePromptTemplateDto) {
    return this.prisma.promptTemplate.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        prompt: dto.prompt,
        variables: dto.variables || [],
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdatePromptTemplateDto) {
    const existing = await this.prisma.promptTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Template not found');
    return this.prisma.promptTemplate.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    const existing = await this.prisma.promptTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Template not found');
    await this.prisma.promptTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  async seedBuiltInTemplates() {
    const templates = getBuiltInTemplates();
    let seeded = 0;
    for (const t of templates) {
      await this.prisma.promptTemplate.upsert({
        where: { slug: t.slug },
        update: { prompt: t.prompt, name: t.name, description: t.description, category: t.category, variables: t.variables, isBuiltIn: true },
        create: { ...t, isBuiltIn: true, isActive: true },
      });
      seeded++;
    }
    return { seeded };
  }
}

function getBuiltInTemplates() {
  return [
    {
      slug: 'chapter-opening',
      name: '章の書き出し',
      description: '作品設定とこれまでの展開を踏まえ、章の冒頭を生成します',
      category: 'writing',
      prompt: `あなたは小説の執筆アシスタントです。以下の作品情報を踏まえ、章の冒頭（書き出し）を生成してください。

{{#episodeOrder}}
【現在の執筆位置】
これから書くのは第{{episodeOrder}}話です。
{{/episodeOrder}}

{{#context}}
【作品設定・キャラクター設定】
{{context}}
{{/context}}

{{#structural_context}}
{{structural_context}}
{{/structural_context}}

{{#content}}
【現在の原稿】
{{content}}
{{/content}}

【絶対遵守ルール】
- これから書くのは第{{episodeOrder}}話です。話数を正確に認識し、その話数にふさわしい内容を書いてください。第1話なら物語の始まり、続きなら前話からの自然な接続を心がけてください。
- 上記のキャラクター設定に記載された性別・性格・口調・一人称を厳密に守ってください。設定と矛盾する描写は絶対に行わないでください。
- 「まだ物語に登場していないキャラクター」が初めて登場する場合、読者にとって未知の人物です。名前だけで登場させず、外見・雰囲気・状況など読者が初めてその人物に出会う描写を必ず入れてください。
- キャラクター間の関係性（幼馴染・家族・親友等）に応じて口調を自然に調整してください。丁寧語設定のキャラクターでも、幼馴染や家族との会話ではくだけた話し方が自然です。
- 世界設定がある場合、その時代・世界観に存在しない語彙や概念は使用しないでください（例: ファンタジー世界に現代技術、中世に「台所」ではなく「厨房」）。
- 「この章の目的」がある場合、その目的と感情目標に沿った展開にしてください。
- プロットや章立てがある場合、その展開に沿った内容にしてください。

【指示】
- 読者を引き込む魅力的な書き出しを{{char_count}}文字程度で書いてください
- これまでの物語の流れを自然に受け継ぎつつ、新しい章の始まりにふさわしい導入にしてください
- 情景描写、キャラクターの行動、内面描写のいずれかから始めてください
- 読者が「続きを読みたい」と思える展開を心がけてください`,
      variables: ['content', 'context', 'char_count', 'episodeOrder'],
      sortOrder: 0,
    },
    {
      slug: 'continue-writing',
      name: '続きを書く',
      description: '現在の文体とトーンを維持しながら、物語の続きを生成します',
      category: 'writing',
      prompt: `あなたは小説の執筆アシスタントです。以下の文章の続きを、同じ文体・トーン・視点を維持しながら自然に書き続けてください。

{{#context}}
【作品設定・キャラクター設定】
{{context}}
{{/context}}

{{#structural_context}}
{{structural_context}}
{{/structural_context}}

【これまでの文章】
{{content}}
===ここまでが既存の文章===

【絶対遵守ルール】
- 「===ここまでが既存の文章===」マーカーの直前の文の直後から、新しい文章のみを生成してください。既存の文章を一切繰り返したり言い換えたりしないでください。
- 上記のキャラクター設定に記載された性別・性格・口調・一人称を厳密に守ってください。生成の途中でキャラクターの性別や口調が変わることは絶対にあってはなりません。
- 「まだ物語に登場していないキャラクター」が初めて登場する場合、読者にとって未知の人物です。名前だけで登場させず、外見・雰囲気・状況など読者が初めてその人物に出会う描写を必ず入れてください。
- キャラクター間の関係性（幼馴染・家族・親友等）に応じて口調を自然に調整してください。丁寧語設定のキャラクターでも、幼馴染や家族との会話ではくだけた話し方が自然です。
- 世界設定がある場合、その時代・世界観に存在しない語彙や概念は使用しないでください（例: ファンタジー世界に現代技術、中世に「台所」ではなく「厨房」）。
- 「この章の目的」がある場合、その目的と感情目標に沿った展開にしてください。
- 既存の文体、語り口、テンポを忠実に再現してください。原稿内のキャラクターの話し方をそのまま引き継いでください。

【指示】
- 上記の文章の最後の一文の直後から、自然な流れで{{char_count}}文字程度の続きを書いてください
- 既存の文章は絶対に出力しないでください。続きの新しい文章のみを出力してください
- 新しい展開や転換点を含めても構いませんが、作品の世界観やトーンから逸脱しないでください`,
      variables: ['content', 'context', 'char_count'],
      sortOrder: 1,
    },
    {
      slug: 'character-dev',
      name: 'キャラクター深掘り',
      description: 'キャラクターの内面、背景、動機を深掘りした描写を提案します',
      category: 'writing',
      prompt: `あなたは小説の執筆アシスタントです。以下のテキストに登場する「{{character_name}}」というキャラクターについて、より深みのある描写を提案してください。

{{#context}}
【作品設定・キャラクター設定】
{{context}}
{{/context}}

【テキスト】
{{content}}

【絶対遵守ルール】
- 上記のキャラクター設定に記載された「{{character_name}}」の性別・性格・口調・背景を厳密に守ってください。
- キャラクター設定と矛盾する描写は絶対に行わないでください。

【指示】
- このキャラクターの内面（感情、葛藤、欲望）を掘り下げてください
- 過去の経験や背景が現在の行動にどう影響しているかを示す描写を提案してください
- キャラクター固有の癖、言い回し、思考パターンを提案してください
- 500〜800文字程度で、物語に組み込めるような具体的な描写を書いてください`,
      variables: ['content', 'character_name', 'context'],
      sortOrder: 2,
    },
    {
      slug: 'scene-enhance',
      name: 'シーン描写の強化',
      description: '五感を活用した、より没入感のあるシーン描写に強化します',
      category: 'editing',
      prompt: `あなたは小説の編集アシスタントです。以下のシーンの描写を、五感（視覚・聴覚・触覚・嗅覚・味覚）を活用してより没入感のあるものに書き直してください。

{{#context}}
【作品設定・キャラクター設定】
{{context}}
{{/context}}

【元のテキスト】
{{content}}

【絶対遵守ルール】
- キャラクター設定がある場合、性別・性格・口調を厳密に維持してください。
- 元のテキストに登場するキャラクターの属性を変更しないでください。
- 世界設定がある場合、その時代・世界観に合った語彙で描写してください。現代語や世界観に存在しない概念は使用しないでください。
- キャラクター間の関係性に応じて口調を自然に調整してください。

【指示】
- 視覚だけでなく、音、匂い、温度、質感など多感覚的な描写を加えてください
- 「見た」「聞いた」等の直接的な感覚動詞ではなく、読者が体験できる描写にしてください
- 情景の雰囲気や空気感が伝わるようにしてください
- 元のテキストの意図やプロットは変えずに、描写の質を向上させてください`,
      variables: ['content', 'context'],
      sortOrder: 3,
    },
    {
      slug: 'dialogue-improve',
      name: '会話の改善',
      description: 'より自然で、キャラクターの個性が際立つ会話に改善します',
      category: 'editing',
      prompt: `あなたは小説の編集アシスタントです。以下の会話シーンを、より自然で個性的なものに改善してください。

{{#context}}
【作品設定・キャラクター設定】
{{context}}
{{/context}}

【元のテキスト】
{{content}}

【絶対遵守ルール】
- 上記のキャラクター設定に記載された各キャラクターの口調・性格・一人称を厳密に守ってください。
- 男性キャラクターを女性的な口調にしたり、その逆を行ってはいけません。
- ただし、関係性が近いキャラクター同士（幼馴染・家族・親友等）の会話では、設定の口調に縛られず関係性に応じた自然な話し方にしてください。丁寧語設定でも家族にはくだけるのが自然です。
- 世界設定がある場合、その時代・世界観に合った語彙で会話を構成してください。

【指示】
- 各キャラクターが固有の話し方・口調を持つようにしてください（設定がある場合はそれに従う）
- 説明的すぎるセリフを、より自然な会話に変えてください
- 言葉の裏にある感情や意図が感じられるようにしてください
- 適切な間（沈黙）や仕草の描写を会話に織り交ぜてください
- 会話のテンポとリズムを意識してください`,
      variables: ['content', 'context'],
      sortOrder: 4,
    },
    {
      slug: 'plot-ideas',
      name: 'プロット展開のアイデア',
      description: '物語の続きとして考えられる3つの展開パターンを提案します',
      category: 'writing',
      prompt: `あなたは小説のプロットコンサルタントです。以下の物語の続きとして考えられる展開のアイデアを3つ提案してください。

{{#context}}
【作品設定・キャラクター設定】
{{context}}
{{/context}}

【ジャンル】{{genre}}

【これまでの物語】
{{content}}

【絶対遵守ルール】
- キャラクター設定がある場合、その性格・動機・関係性と整合する展開にしてください。
- プロットや章立てがある場合、その方向性に沿った提案にしてください。

【指示】
各アイデアについて以下の形式で提案してください：

1. 【展開タイトル】
   概要（100字程度）
   この展開の魅力と物語全体への影響

2. 【展開タイトル】
   概要（100字程度）
   この展開の魅力と物語全体への影響

3. 【展開タイトル】
   概要（100字程度）
   この展開の魅力と物語全体への影響

- 王道の展開、意外性のある展開、読者の感情を揺さぶる展開をバランスよく提案してください
- ジャンルの特性を活かした提案にしてください`,
      variables: ['content', 'genre', 'context'],
      sortOrder: 5,
    },
    {
      slug: 'style-adjust',
      name: '文体の調整',
      description: '指定された文体に合わせてテキストを調整します',
      category: 'editing',
      prompt: `あなたは小説の編集アシスタントです。以下のテキストを「{{target_style}}」の文体に調整してください。

【元のテキスト】
{{content}}

【目標の文体】{{target_style}}

【指示】
- 元のテキストの内容・意味は保持しながら、文体のみを調整してください
- 語彙、文の長さ、リズム、比喩表現などを目標の文体に合わせてください
- 文体の変更が自然で、読んでいて違和感がないようにしてください`,
      variables: ['content', 'target_style'],
      sortOrder: 6,
    },
    {
      slug: 'proofread',
      name: '校正・推敲',
      description: '誤字脱字・文法・表現の改善点を指摘し、修正案を提示します',
      category: 'editing',
      prompt: `あなたは日本語の校正・推敲の専門家です。以下のテキストを校正・推敲してください。

【テキスト】
{{content}}

【指示】
以下の観点でチェックし、問題があれば修正案を提示してください：

1. 誤字・脱字
2. 文法的な誤り
3. 不自然な表現や冗長な表現
4. 表記の統一性（漢字/ひらがなの使い分け等）
5. 句読点の適切さ

各修正箇所について：
- 元の表現 → 修正案
- 修正理由（簡潔に）

最後に、修正を反映した全文を出力してください。`,
      variables: ['content'],
      sortOrder: 7,
    },
    {
      slug: 'synopsis-gen',
      name: 'あらすじ生成',
      description: '作品のあらすじを200〜400字で自動生成します',
      category: 'generation',
      prompt: `あなたは小説のあらすじを書く専門家です。以下の小説本文から、魅力的なあらすじを生成してください。

【本文】
{{content}}

【指示】
- 200〜400字のあらすじを書いてください
- 物語の核心的なネタバレは避けつつ、読者の興味を引く内容にしてください
- 主人公とその状況、物語の核となる問題や葛藤を含めてください
- 読者が「読んでみたい」と思える魅力的な文章にしてください
- 結末は明かさず、期待感を持たせる形で終えてください`,
      variables: ['content'],
      sortOrder: 8,
    },
    {
      slug: 'free-prompt',
      name: '自由プロンプト',
      description: '自由にプロンプトを入力してAIに指示できます',
      category: 'writing',
      prompt: `あなたは小説の執筆を支援するAIアシスタントです。

{{#context}}
【作品設定・キャラクター設定】
{{context}}
{{/context}}

{{#structural_context}}
{{structural_context}}
{{/structural_context}}

{{#content}}
【現在の原稿】
{{content}}
{{/content}}

【絶対遵守ルール】
- キャラクター設定がある場合、性別・性格・口調・一人称を厳密に守ってください。
- 「まだ物語に登場していないキャラクター」が初めて登場する場合、読者にとって未知の人物として導入描写を行ってください。
- キャラクター間の関係性に応じて口調を自然に調整してください。丁寧語設定でも幼馴染や家族とはくだけた会話が自然です。
- 世界設定がある場合、その時代・世界観に存在しない語彙や概念は使用しないでください。
- 「この章の目的」がある場合、その目的に沿った内容にしてください。
- 原稿内のキャラクターの話し方や属性を途中で変更しないでください。

【ユーザーからの指示】
{{user_prompt}}`,
      variables: ['content', 'context', 'user_prompt'],
      sortOrder: 9,
    },
  ];
}

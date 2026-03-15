import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { AiTierService } from '../ai-settings/ai-tier.service';
import { CreditService } from '../billing/credit.service';
import {
  GenerateCharactersDto,
  GeneratePlotDto,
  GenerateEmotionBlueprintDto,
  GenerateChapterOutlineDto,
  GenerateEpisodesForActDto,
  GenerateWorldBuildingDto,
  GenerateSynopsisDto,
  SaveCreationPlanDto,
  AiFeedbackDto,
} from './dto/creation-wizard.dto';

@Injectable()
export class CreationWizardService {
  private readonly logger = new Logger(CreationWizardService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
    private aiTier: AiTierService,
    private creditService: CreditService,
  ) {}

  // ─── Streaming helpers ───────────────────────────────────────

  private async getApiConfig(userId: string) {
    const enabled = await this.aiSettings.isAiEnabled();
    if (!enabled) throw new ServiceUnavailableException('AI is currently disabled');

    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    // Check user's AI tier
    await this.aiTier.assertCanUseAi(userId);

    const model = await this.aiSettings.getModel();
    return { apiKey, model };
  }

  private async *streamFromClaude(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    userId: string,
    feature: string,
  ): AsyncGenerator<string> {
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;

    // Credit consumption: 1cr for creation wizard features
    const creditCost = this.aiTier.getCreditCost(feature, false, false);
    let transactionId: string | null = null;
    let contentDelivered = false;

    try {
      if (creditCost > 0) {
        const result = await this.creditService.consumeCredits(
          userId, creditCost, feature, model,
        );
        transactionId = result.transactionId;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31',
        },
        body: JSON.stringify({
          model,
          max_tokens: 8000,
          stream: true,
          system: [
            {
              type: 'text' as const,
              text: systemPrompt,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Claude API error: ${response.status} ${errorText}`);
        if (transactionId) {
          await this.creditService.refundTransaction(transactionId);
          transactionId = null;
        }
        throw new ServiceUnavailableException('AI service error');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        if (transactionId) {
          await this.creditService.refundTransaction(transactionId);
          transactionId = null;
        }
        throw new ServiceUnavailableException('No response stream');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;

            try {
              const event = JSON.parse(data);
              if (event.type === 'content_block_delta' && event.delta?.text) {
                contentDelivered = true;
                yield event.delta.text;
              }
              if (event.type === 'message_start' && event.message?.usage) {
                inputTokens = event.message.usage.input_tokens || 0;
              }
              if (event.type === 'message_delta' && event.usage) {
                outputTokens = event.usage.output_tokens || 0;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } finally {
        reader.releaseLock();

        const durationMs = Date.now() - startTime;
        await this.prisma.aiUsageLog
          .create({
            data: {
              userId,
              feature,
              inputTokens,
              outputTokens,
              model,
              durationMs,
            },
          })
          .catch((e) => this.logger.error('Failed to log AI usage', e));

        // Confirm transaction on successful delivery
        if (transactionId && contentDelivered) {
          await this.creditService.confirmTransaction(transactionId).catch((e) => this.logger.error(`Credit confirm failed: ${transactionId}`, e));
          transactionId = null; // prevent double-confirm in catch
        }
      }
    } catch (error) {
      if (transactionId && !contentDelivered) {
        await this.creditService.refundTransaction(transactionId).catch((e) => this.logger.error(`Credit refund failed: ${transactionId}`, e));
      } else if (transactionId && contentDelivered) {
        await this.creditService.confirmTransaction(transactionId).catch((e) => this.logger.error(`Credit confirm failed: ${transactionId}`, e));
      }
      throw error;
    }
  }

  // ─── Generation methods ──────────────────────────────────────

  async *generateCharacters(
    userId: string,
    workId: string,
    dto: GenerateCharactersDto,
  ): AsyncGenerator<string> {
    const { apiKey, model } = await this.getApiConfig(userId);

    const systemPrompt = `あなたは小説の創作支援AIです。作者のビジョンを尊重しながら、キャラクターデザインの「提案」を行います。
最終的な決定権は常に作者にあります。AIはあくまで発想の触媒です。

【絶対遵守ルール】
- 各キャラクターの性別・一人称・口調・性格は設定内で必ず一貫させること
- 一人称は日本語の小説で自然なもの（僕/私/俺/あたし/わたくし等）を選ぶこと
- 口調の例文を必ず含めること（そのキャラクターらしいセリフ）
- キャラクター同士の関係性を明確にすること

以下の形式でキャラクター提案をJSON形式で出力してください:
{
  "characters": [
    {
      "name": "提案する名前",
      "role": "主人公/ヒロイン/ライバル/メンター/敵役/脇役等",
      "gender": "男性/女性/その他/不明",
      "age": "年齢や年代（例: 17歳、20代後半）",
      "firstPerson": "一人称（僕/私/俺/あたし等）",
      "personality": "性格の説明",
      "speechStyle": "口調の特徴と例文（例: 丁寧語。「〜だと思います」「〜ですね」）",
      "appearance": "外見の特徴",
      "background": "背景設定",
      "motivation": "動機・目的",
      "relationships": "他キャラとの関係性",
      "uniqueTrait": "際立つ特徴"
    }
  ],
  "suggestions": "キャラクター構成に関する補足アドバイス"
}`;

    const userPrompt = `作品のビジョン: ${dto.vision}
${dto.genre ? `ジャンル: ${dto.genre}` : ''}
${dto.themes ? `テーマ: ${dto.themes}` : ''}

このビジョンに合ったキャラクターを3〜5人提案してください。作者が自由にカスタマイズできる土台として提供してください。`;

    let fullOutput = '';
    for await (const chunk of this.streamFromClaude(
      apiKey, model, systemPrompt, userPrompt, userId, 'creation_wizard',
    )) {
      fullOutput += chunk;
      yield chunk;
    }

    // Log the generation
    await this.logCreationAction(workId, userId, 'character_design', 'generated', dto.vision.length, fullOutput.length);
  }

  async *generatePlot(
    userId: string,
    workId: string,
    dto: GeneratePlotDto,
  ): AsyncGenerator<string> {
    const { apiKey, model } = await this.getApiConfig(userId);

    const systemPrompt = `あなたは小説のプロット設計を支援するAIです。作者のテーマとメッセージを深く理解し、物語の骨格を提案します。
最終的な決定権は常に作者にあります。AIは構造的な視点から提案を行うツールです。

【絶対遵守ルール】
- キャラクター情報が提供されている場合、各キャラの性別・一人称・口調・性格を厳守すること
- プロットはキャラクターの性格・動機・アークに基づいて駆動させること
- キャラクターの行動は性格設定から自然に導かれるものにすること
- 設定と矛盾する展開を提案しないこと

以下のJSON形式で出力してください:
{
  "premise": "物語の前提",
  "threeActStructure": {
    "act1": { "title": "序章", "summary": "...", "keyEvents": ["..."] },
    "act2": { "title": "展開", "summary": "...", "keyEvents": ["..."] },
    "act3": { "title": "結末", "summary": "...", "keyEvents": ["..."] }
  },
  "centralConflict": "中心的な葛藤",
  "themes": ["テーマ1", "テーマ2"],
  "turningPoints": ["転換点1", "転換点2"],
  "suggestions": "プロット構成への補足アドバイス"
}`;

    const charInfo = dto.characters ? this.formatCharactersForPrompt(dto.characters) : '';
    const userPrompt = `テーマ: ${dto.themes}
${dto.message ? `伝えたいメッセージ: ${dto.message}` : ''}
${dto.emotionGoals ? `読者に与えたい感情: ${dto.emotionGoals}` : ''}${charInfo ? `\n\n${charInfo}` : ''}

このテーマとキャラクター設定に沿った物語のプロット構造を提案してください。キャラクターの性格・動機・関係性を活かした展開にしてください。`;

    let fullOutput = '';
    for await (const chunk of this.streamFromClaude(
      apiKey, model, systemPrompt, userPrompt, userId, 'creation_wizard',
    )) {
      fullOutput += chunk;
      yield chunk;
    }

    await this.logCreationAction(workId, userId, 'plot_architect', 'generated', dto.themes.length, fullOutput.length);
  }

  async *generateEmotionBlueprint(
    userId: string,
    workId: string,
    dto: GenerateEmotionBlueprintDto,
  ): AsyncGenerator<string> {
    const { apiKey, model } = await this.getApiConfig(userId);

    const systemPrompt = `あなたは読者の感情体験を設計する支援AIです。作者が意図する感情の流れを可視化し、各場面でどんな感情を読者に届けたいかを整理する手助けをします。
最終的な感情設計は作者の感性に委ねられます。AIは感情の地図を描く補助ツールです。

【重要】
- 感情の強度は1〜10で設計すること（1=微かに、10=圧倒的に）
- 感情の対比（例: 絶望→希望、孤独→つながり）を意識すること
- 読者がキャラクターに感情移入できるポイントを明示すること

以下のJSON形式で出力してください:
{
  "coreEmotion": "作品の核となる感情",
  "emotionArc": [
    { "phase": "導入", "emotion": "好奇心", "intensity": 3, "description": "..." },
    { "phase": "展開", "emotion": "緊張", "intensity": 7, "description": "..." },
    { "phase": "クライマックス", "emotion": "感動", "intensity": 10, "description": "..." },
    { "phase": "余韻", "emotion": "希望", "intensity": 6, "description": "..." }
  ],
  "readerJourney": "読者が辿る感情の旅の説明",
  "emotionContrasts": ["対比する感情ペア"],
  "suggestions": "感情設計への補足アドバイス"
}`;

    const userPrompt = `核となるメッセージ: ${dto.coreMessage}
${dto.targetEmotions ? `届けたい感情: ${dto.targetEmotions}` : ''}
${dto.readerJourney ? `読者に辿ってほしい旅: ${dto.readerJourney}` : ''}

この作品の感情ブループリントを設計してください。`;

    let fullOutput = '';
    for await (const chunk of this.streamFromClaude(
      apiKey, model, systemPrompt, userPrompt, userId, 'creation_wizard',
    )) {
      fullOutput += chunk;
      yield chunk;
    }

    await this.logCreationAction(workId, userId, 'emotion_blueprint', 'generated', dto.coreMessage.length, fullOutput.length);
  }

  async *generateChapterOutline(
    userId: string,
    workId: string,
    dto: GenerateChapterOutlineDto,
  ): AsyncGenerator<string> {
    const { apiKey, model } = await this.getApiConfig(userId);

    const systemPrompt = `あなたは小説の章立て構成を支援するAIです。プロット、キャラクター、感情設計を統合し、具体的な章立てを提案します。
各章は作者が自由に変更・並べ替え・削除できる「叩き台」です。AIは構成の一貫性を保つ視点を提供します。

【絶対遵守ルール】
- キャラクター情報が提供されている場合、各キャラの性別・一人称・口調・性格を厳守すること
- 各章に登場するキャラクターを明示し、そのキャラの動機や性格に基づくシーンにすること
- 感情設計が提供されている場合、各章の感情目標と強度を感情ブループリントと整合させること
- プロット構成と矛盾する章展開を提案しないこと

重要: 出力はJSON形式のみにしてください。前置きや説明は不要です。JSONの前後にテキストを含めないでください。

以下の形式で出力してください:
{
  "chapters": [
    {
      "number": 1,
      "title": "章タイトル案",
      "summary": "章の概要（2-3文）",
      "keyScenes": ["シーン1", "シーン2"],
      "characters": ["登場するキャラ名1", "登場するキャラ名2"],
      "emotionTarget": "この章で狙う感情",
      "emotionIntensity": 5,
      "wordCountEstimate": 3000
    }
  ],
  "suggestions": "章構成への補足アドバイス"
}`;

    const parts: string[] = [];
    if (dto.plotOutline) {
      const plotText = typeof dto.plotOutline === 'string'
        ? dto.plotOutline
        : dto.plotOutline.text || JSON.stringify(dto.plotOutline);
      parts.push(`【プロット構成】\n${plotText}`);
    }
    if (dto.characters) {
      parts.push(this.formatCharactersForPrompt(dto.characters));
    }
    if (dto.emotionBlueprint) {
      const eb = dto.emotionBlueprint;
      const emotionParts = [
        eb.coreMessage && `核となるメッセージ: ${eb.coreMessage}`,
        eb.targetEmotions && `届けたい感情: ${eb.targetEmotions}`,
        eb.readerJourney && `読者の旅路: ${eb.readerJourney}`,
      ].filter(Boolean);
      if (emotionParts.length > 0) {
        parts.push(`【感情ブループリント】\n${emotionParts.join('\n')}`);
      }
    }
    if (dto.additionalNotes) parts.push(`【追加メモ】\n${dto.additionalNotes}`);

    const userPrompt = `${parts.join('\n\n')}

これらの情報を統合して、章立て構成を提案してください。各章に登場キャラクターと感情目標を明示してください。`;

    let fullOutput = '';
    const inputLen = parts.join('').length;
    for await (const chunk of this.streamFromClaude(
      apiKey, model, systemPrompt, userPrompt, userId, 'creation_wizard',
    )) {
      fullOutput += chunk;
      yield chunk;
    }

    await this.logCreationAction(workId, userId, 'chapter_outline', 'generated', inputLen, fullOutput.length);
  }

  // ─── Character formatting ───────────────────────────────────

  private formatCharactersForPrompt(characters: any): string {
    if (!characters) return '';
    const chars = Array.isArray(characters) ? characters : [];
    if (chars.length === 0) return '';

    const sheets = chars.map((c: any) => {
      const lines = [`■ ${c.name || '名前未定'}（${c.role || '役割未定'}）`];
      if (c.gender) lines.push(`  性別: ${c.gender}`);
      if (c.age) lines.push(`  年齢: ${c.age}`);
      if (c.firstPerson) lines.push(`  一人称: ${c.firstPerson}`);
      if (c.personality) lines.push(`  性格: ${c.personality}`);
      if (c.speechStyle) lines.push(`  口調: ${c.speechStyle}`);
      if (c.appearance) lines.push(`  外見: ${c.appearance}`);
      if (c.background) lines.push(`  背景: ${c.background}`);
      if (c.motivation) lines.push(`  動機: ${c.motivation}`);
      if (c.relationships) lines.push(`  関係: ${c.relationships}`);
      if (c.uniqueTrait) lines.push(`  特徴: ${c.uniqueTrait}`);
      if (c.arc) lines.push(`  成長アーク: ${c.arc}`);
      // Custom fields (from StoryCharacter table or wizard JSON)
      const cf = c.customFields || c.customFieldValues;
      if (cf && typeof cf === 'object') {
        for (const [key, val] of Object.entries(cf as Record<string, string>)) {
          if (val) lines.push(`  ${key}: ${val}`);
        }
      }
      // Fallback: description field from wizard format
      if (c.description && !c.personality && !c.speechStyle) {
        lines.push(`  詳細: ${c.description}`);
      }
      return lines.join('\n');
    });

    return `【キャラクター設定（厳守）】\n${sheets.join('\n\n')}`;
  }

  // ─── Episodes for Act (new structured plot) ────────────────

  async *generateEpisodesForAct(
    userId: string,
    workId: string,
    dto: GenerateEpisodesForActDto,
  ): AsyncGenerator<string> {
    const { apiKey, model } = await this.getApiConfig(userId);

    const systemPrompt = `あなたは小説のプロット設計を支援するAIです。物語の特定のセクション（幕/パート）に対するエピソード案を提案します。
最終的な決定権は常に作者にあります。

【重要】
- 各エピソードは物語の中で独立した「話」として成立すること
- エピソードカード間に自然な因果関係があること
- キャラクター情報が提供されている場合、そのキャラの性格・動機に基づく行動にすること

以下のJSON形式で出力してください（JSONのみ、前置き不要）:
{
  "episodes": [
    {
      "title": "エピソードタイトル",
      "whatHappens": "何が起きるか（2-3文）",
      "whyItHappens": "なぜ起きるか（動機・因果）",
      "characters": ["登場キャラ名"],
      "emotionTarget": "このエピソードの感情目標"
    }
  ]
}`;

    const userPrompt = `${dto.context || ''}

セクション「${dto.actLabel}」（${dto.actDescription || ''}）に適したエピソードを2〜4つ提案してください。
構成テンプレート: ${dto.structureTemplate || 'kishotenketsu'}`;

    let fullOutput = '';
    for await (const chunk of this.streamFromClaude(
      apiKey, model, systemPrompt, userPrompt, userId, 'creation_wizard',
    )) {
      fullOutput += chunk;
      yield chunk;
    }

    await this.logCreationAction(workId, userId, 'episodes_for_act', 'generated', userPrompt.length, fullOutput.length);
  }

  // ─── World Building ───────────────────────────────────────

  async *generateWorldBuilding(
    userId: string,
    workId: string,
    dto: GenerateWorldBuildingDto,
  ): AsyncGenerator<string> {
    const { apiKey, model } = await this.getApiConfig(userId);

    const sectionPrompts: Record<string, string> = {
      basics: '世界の基本設定（時代・舞台・文明レベル）を提案してください。JSON: { "basics": { "era": "...", "setting": "...", "civilizationLevel": "..." } }',
      rules: '世界のルール・法則・魔法体系を2-3個提案してください。JSON: { "rules": [{ "name": "...", "description": "...", "constraints": "..." }] }',
      terminology: '世界の固有名詞・専門用語を3-5個提案してください。JSON: { "terminology": [{ "term": "...", "reading": "...", "definition": "..." }] }',
      history: '世界の歴史的背景を200字程度で提案してください。JSON: { "history": "..." }',
      items: '物語の鍵となるアイテムを2-3個提案してください。JSON: { "items": [{ "name": "...", "appearance": "...", "ability": "...", "constraints": "...", "owner": "...", "narrativeMeaning": "..." }] }',
    };

    const systemPrompt = `あなたは小説の世界観設計を支援するAIです。作者のジャンル・テーマ・キャラクター設定を尊重しながら、世界観の提案を行います。
最終的な決定権は常に作者にあります。出力はJSON形式のみにしてください。`;

    const userPrompt = `${dto.context || ''}

${dto.existingData ? `【既存の世界観設定】\n${JSON.stringify(dto.existingData, null, 0)}\n\n` : ''}${sectionPrompts[dto.section] || `セクション「${dto.section}」の設定を提案してください。`}`;

    let fullOutput = '';
    for await (const chunk of this.streamFromClaude(
      apiKey, model, systemPrompt, userPrompt, userId, 'creation_wizard',
    )) {
      fullOutput += chunk;
      yield chunk;
    }

    await this.logCreationAction(workId, userId, 'world_building', 'generated', userPrompt.length, fullOutput.length);
  }

  // ─── Synopsis generation ──────────────────────────────────

  async *generateSynopsis(
    userId: string,
    workId: string,
    dto: GenerateSynopsisDto,
  ): AsyncGenerator<string> {
    const { apiKey, model } = await this.getApiConfig(userId);

    const systemPrompt = `あなたは小説のあらすじライターです。作品の設定情報をもとに、読者を引き込む魅力的なあらすじを200-400字で書いてください。
プロットの全容を明かさず、読者の興味を引く「入口」として書くこと。JSONではなくプレーンテキストで出力してください。`;

    const userPrompt = dto.context;

    let fullOutput = '';
    for await (const chunk of this.streamFromClaude(
      apiKey, model, systemPrompt, userPrompt, userId, 'creation_wizard',
    )) {
      fullOutput += chunk;
      yield chunk;
    }

    await this.logCreationAction(workId, userId, 'synopsis', 'generated', userPrompt.length, fullOutput.length);
  }

  // ─── AI Consistency Check ─────────────────────────────────

  async aiConsistencyCheck(userId: string, workId: string, episodeId: string, content?: string) {
    const { apiKey, model } = await this.getApiConfig(userId);

    // Get episode content
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      select: { content: true, title: true, orderIndex: true },
    });
    if (!episode) throw new Error('Episode not found');

    const episodeContent = content || episode.content;
    if (!episodeContent?.trim()) {
      return { typos: [], characterIssues: [], plotIssues: [] };
    }

    // Get creation plan for context
    const plan = await this.prisma.workCreationPlan.findUnique({
      where: { workId },
    });

    // Get characters (all fields needed for context)
    const characters = await this.prisma.storyCharacter.findMany({
      where: { workId },
      select: {
        name: true, role: true, personality: true, speechStyle: true,
        firstPerson: true, gender: true, age: true, appearance: true,
        background: true, motivation: true, arc: true, customFields: true,
      },
    });

    const contextParts: string[] = [];
    if (characters.length > 0) {
      contextParts.push(this.formatCharactersForPrompt(characters));
    }
    if (plan?.plotOutline) {
      const po = plan.plotOutline as any;
      let plotText = '';
      if (typeof po === 'string') {
        plotText = po;
      } else if (po?.type === 'structured' && po.actGroups?.length > 0) {
        plotText = po.actGroups.map((group: any) => {
          const header = `【${group.label}】${group.description ? ` ${group.description}` : ''}`;
          const episodes = (group.episodes || []).map((ep: any, i: number) => {
            const parts = [`  ${i + 1}. ${ep.title || '（無題）'}`];
            if (ep.whatHappens) parts.push(`     何が起きるか: ${ep.whatHappens}`);
            if (ep.whyItHappens) parts.push(`     なぜ起きるか: ${ep.whyItHappens}`);
            if (ep.characters?.length > 0) parts.push(`     登場: ${ep.characters.join('、')}`);
            if (ep.emotionTarget) parts.push(`     感情目標: ${ep.emotionTarget}`);
            return parts.join('\n');
          }).join('\n');
          return episodes ? `${header}\n${episodes}` : header;
        }).join('\n\n');
      } else {
        plotText = po?.text || '';
      }
      if (plotText) contextParts.push(`【プロット】\n${plotText}`);
    }

    // World building context
    if (plan?.worldBuildingData) {
      const wb = plan.worldBuildingData as any;
      const wbParts: string[] = [];
      if (wb.basics?.era) wbParts.push(`時代: ${wb.basics.era}`);
      if (wb.basics?.setting) wbParts.push(`舞台: ${wb.basics.setting}`);
      for (const rule of wb.rules || []) {
        if (rule.name) wbParts.push(`ルール「${rule.name}」: ${rule.description}${rule.constraints ? `（制約: ${rule.constraints}）` : ''}`);
      }
      for (const term of wb.terminology || []) {
        if (term.term) wbParts.push(`${term.term}${term.reading ? `（${term.reading}）` : ''}: ${term.definition}`);
      }
      if (wbParts.length > 0) contextParts.push(`【世界観設定】\n${wbParts.join('\n')}`);
    }

    const systemPrompt = `あなたは小説の校正・整合性チェックの専門家です。本文と設定情報を照合し、問題点を指摘してください。

以下のJSON形式で出力してください（JSONのみ）:
{
  "typos": [{ "location": "該当箇所", "issue": "問題", "suggestion": "修正案" }],
  "characterIssues": [{ "character": "キャラ名", "issue": "問題", "detail": "詳細" }],
  "plotIssues": [{ "issue": "問題", "detail": "詳細" }]
}

問題がない場合は空配列を返してください。`;

    const userPrompt = `${contextParts.join('\n\n')}

【チェック対象: 第${episode.orderIndex + 1}話「${episode.title}」】
${episodeContent.slice(0, 5000)}`;

    // Use non-streaming call for consistency check
    const creditCost = this.aiTier.getCreditCost('ai_check', false, false);
    let transactionId: string | null = null;
    try {
      if (creditCost > 0) {
        const result = await this.creditService.consumeCredits(
          userId, creditCost, 'ai_check', model,
        );
        transactionId = result.transactionId;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        if (transactionId) await this.creditService.refundTransaction(transactionId);
        throw new Error('AI service error');
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (transactionId) await this.creditService.confirmTransaction(transactionId);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { typos: [], characterIssues: [], plotIssues: [] };
    } catch (error) {
      if (transactionId) await this.creditService.refundTransaction(transactionId).catch((e) => this.logger.error(`Credit refund failed: ${transactionId}`, e));
      throw error;
    }
  }

  // ─── Plan CRUD ───────────────────────────────────────────────

  async saveCreationPlan(workId: string, dto: SaveCreationPlanDto) {
    const result = await this.prisma.workCreationPlan.upsert({
      where: { workId },
      update: {
        characters: dto.characters ?? undefined,
        plotOutline: dto.plotOutline ?? undefined,
        emotionBlueprint: dto.emotionBlueprint ?? undefined,
        chapterOutline: dto.chapterOutline ?? undefined,
        customFieldDefinitions: dto.customFieldDefinitions ?? undefined,
        worldBuildingData: dto.worldBuildingData ?? undefined,
      },
      create: {
        workId,
        characters: dto.characters ?? undefined,
        plotOutline: dto.plotOutline ?? undefined,
        emotionBlueprint: dto.emotionBlueprint ?? undefined,
        chapterOutline: dto.chapterOutline ?? undefined,
        customFieldDefinitions: dto.customFieldDefinitions ?? undefined,
        worldBuildingData: dto.worldBuildingData ?? undefined,
      },
    });

    // Sync worldBuildingData to WorldSetting table
    if (dto.worldBuildingData) {
      await this.syncWorldSettings(workId, dto.worldBuildingData as any);
    }

    return result;
  }

  /** Sync worldBuildingData JSON to WorldSetting table entries */
  private async syncWorldSettings(workId: string, wb: any) {
    try {
      const entries: { category: string; name: string; description: string }[] = [];

      if (wb.basics?.era) {
        entries.push({ category: 'culture', name: '時代', description: wb.basics.era });
      }
      if (wb.basics?.setting) {
        entries.push({ category: 'geography', name: '舞台', description: wb.basics.setting });
      }
      if (wb.basics?.civilizationLevel) {
        entries.push({ category: 'technology', name: '文明レベル', description: wb.basics.civilizationLevel });
      }
      for (const rule of wb.rules || []) {
        if (rule.name && rule.description) {
          entries.push({ category: 'magic', name: rule.name, description: `${rule.description}${rule.constraints ? `\n制約: ${rule.constraints}` : ''}` });
        }
      }
      for (const term of wb.terminology || []) {
        if (term.term && term.definition) {
          entries.push({ category: 'culture', name: term.term, description: `${term.reading ? `（${term.reading}）` : ''}${term.definition}` });
        }
      }
      if (wb.history) {
        entries.push({ category: 'culture', name: '歴史', description: wb.history });
      }

      for (const entry of entries) {
        await this.prisma.worldSetting.upsert({
          where: { workId_category_name: { workId, category: entry.category, name: entry.name } },
          update: { description: entry.description },
          create: { workId, ...entry },
        });
      }
    } catch {
      // Non-critical: don't fail the save if sync fails
    }
  }

  async getCreationPlan(workId: string) {
    return this.prisma.workCreationPlan.findUnique({ where: { workId } });
  }

  // ─── AI feedback logging ────────────────────────────────────

  async logAiFeedback(userId: string, dto: AiFeedbackDto) {
    return this.prisma.aiCreationLog.create({
      data: {
        workId: dto.workId,
        userId,
        stage: dto.stage,
        action: dto.action,
        inputChars: dto.inputChars,
        outputChars: dto.outputChars,
        acceptedChars: dto.acceptedChars,
        metadata: dto.metadata ?? undefined,
      },
    });
  }

  private async logCreationAction(
    workId: string,
    userId: string,
    stage: string,
    action: string,
    inputChars: number,
    outputChars: number,
  ) {
    await this.prisma.aiCreationLog
      .create({
        data: { workId, userId, stage, action, inputChars, outputChars },
      })
      .catch((e) => this.logger.error('Failed to log creation action', e));
  }

  // ─── Originality calculation ─────────────────────────────────

  async calculateOriginality(workId: string) {
    // Get all accepted AI creation logs
    const logs = await this.prisma.aiCreationLog.findMany({
      where: { workId, action: 'accepted' },
    });

    // Weight: creation stages at 0.3x, writing_assist at 1.0x
    const CREATION_STAGE_WEIGHT = 0.3;
    const WRITING_ASSIST_WEIGHT = 1.0;

    let weightedAiChars = 0;
    let totalAcceptedChars = 0;
    let creationStageChars = 0;
    let writingAssistChars = 0;

    for (const log of logs) {
      const isWritingAssist = log.stage === 'writing_assist';
      const weight = isWritingAssist ? WRITING_ASSIST_WEIGHT : CREATION_STAGE_WEIGHT;
      weightedAiChars += log.acceptedChars * weight;

      if (isWritingAssist) {
        writingAssistChars += log.acceptedChars;
      } else {
        creationStageChars += log.acceptedChars;
      }
      totalAcceptedChars += log.acceptedChars;
    }

    // Get total character count from all episodes
    const episodes = await this.prisma.episode.findMany({
      where: { workId },
      select: { wordCount: true },
    });
    const totalChars = episodes.reduce((sum, ep) => sum + ep.wordCount, 0);

    // originality = 1.0 - (weightedAiChars / max(totalChars, 1)), clamped [0, 1]
    const rawOriginality = 1.0 - weightedAiChars / Math.max(totalChars, 1);
    const originality = Math.max(0, Math.min(1, rawOriginality));

    // Update the work
    await this.prisma.work.update({
      where: { id: workId },
      data: { originality },
    });

    return {
      originality,
      breakdown: {
        totalChars,
        totalAcceptedAiChars: totalAcceptedChars,
        creationStageChars,
        writingAssistChars,
        weightedAiChars,
        logCount: logs.length,
      },
    };
  }

  // ─── Story Summary (cached context for AI assist) ──────────

  /**
   * Generate/update a running story summary for efficient AI context.
   * Uses Haiku for cost efficiency. Called after episode save.
   */
  /**
   * Incremental story summary update.
   * - If no existing summary: full rebuild (all episodes, 2000 chars each)
   * - If existing summary: only send previous summary + latest 2 episodes full text
   * This keeps token cost low (~3000-6000 input tokens) regardless of total episode count.
   */
  async updateStorySummary(workId: string, userId: string): Promise<void> {
    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) return;

    const episodes = await this.prisma.episode.findMany({
      where: { workId },
      orderBy: { orderIndex: 'asc' },
      select: { title: true, content: true, orderIndex: true },
    });

    if (episodes.length === 0) return;

    // Check for existing summary
    const existingPlan = await this.prisma.workCreationPlan.findUnique({
      where: { workId },
      select: { storySummary: true },
    });
    const existingSummary = existingPlan?.storySummary as Record<string, unknown> | null;

    let prompt: string;

    if (existingSummary && (existingSummary as any).episodes?.length > 0) {
      // --- Incremental update: send existing summary + latest 2 episodes ---
      const recentEps = episodes.slice(-2);
      const recentTexts = recentEps
        .map((ep) => `第${ep.orderIndex + 1}話「${ep.title}」:\n${ep.content.slice(0, 3000)}`)
        .join('\n\n---\n\n');

      prompt = `あなたは小説の分析専門家です。既存の物語要約と最新のエピソードを元に、要約を更新してください。

【既存の要約】
${JSON.stringify(existingSummary, null, 0)}

【最新のエピソード（直近2話分の本文）】
${recentTexts}

【指示】
- 既存の要約の正確な部分はそのまま維持してください
- 最新エピソードの内容を反映して、全体要約・キャラ現況・伏線を更新してください
- 本文に書かれている事実のみを要約し、推測で補完しないでください
- episodesリストに最新話の要約を追加/更新してください

以下のJSON形式で出力してください（JSONのみ）:

{
  "overallSummary": "物語全体の要約（300字以内、時系列で）",
  "episodes": [
    { "title": "話タイトル", "summary": "100字以内の要約", "keyEvents": ["出来事"], "endState": "終了時点の状況" }
  ],
  "characters": [
    { "name": "キャラ名", "currentState": "最新時点の状況（50字以内）", "relationships": "他キャラとの関係" }
  ],
  "openThreads": ["未解決の伏線"],
  "worldRules": ["作中のルール・設定"],
  "tone": "トーン",
  "timeline": "時間経過の概要"
}`;
    } else {
      // --- Full rebuild: all episodes, 2000 chars each ---
      const episodeTexts = episodes
        .map((ep) => `第${ep.orderIndex + 1}話「${ep.title}」:\n${ep.content.slice(0, 2000)}`)
        .join('\n\n---\n\n');

      prompt = `あなたは小説の分析専門家です。以下の小説の全話を読み、正確な要約を作成してください。

【重要】本文に書かれている事実のみを要約してください。推測で補完しないでください。

${episodeTexts}

以下のJSON形式で出力してください（JSONのみ）:

{
  "overallSummary": "物語全体の要約（300字以内、時系列で）",
  "episodes": [
    { "title": "話タイトル", "summary": "100字以内の要約", "keyEvents": ["出来事"], "endState": "終了時点の状況" }
  ],
  "characters": [
    { "name": "キャラ名", "currentState": "最新時点の状況（50字以内）", "relationships": "他キャラとの関係" }
  ],
  "openThreads": ["未解決の伏線"],
  "worldRules": ["作中のルール・設定"],
  "tone": "トーン",
  "timeline": "時間経過の概要"
}`;
    }

    try {
      const startTime = Date.now();
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        this.logger.error(`Story summary API error: ${response.status}`);
        return;
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return;

      const summary = JSON.parse(jsonMatch[0]);

      await this.prisma.workCreationPlan.upsert({
        where: { workId },
        update: { storySummary: summary },
        create: { workId, storySummary: summary },
      });

      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;
      const durationMs = Date.now() - startTime;
      await this.prisma.aiUsageLog.create({
        data: {
          userId,
          feature: 'story_summary',
          inputTokens,
          outputTokens,
          model: 'claude-haiku-4-5-20251001',
          durationMs,
        },
      }).catch(() => {});

      this.logger.log(`Story summary updated for work ${workId} (${existingSummary ? 'incremental' : 'full'}, ${episodes.length} episodes, ${inputTokens}+${outputTokens} tokens)`);
    } catch (e) {
      this.logger.error('Failed to update story summary', e);
    }
  }

  /** Get cached story summary */
  async getStorySummary(workId: string): Promise<unknown> {
    const plan = await this.prisma.workCreationPlan.findUnique({
      where: { workId },
      select: { storySummary: true },
    });
    return plan?.storySummary || null;
  }
}

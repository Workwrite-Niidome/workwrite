import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { AiTierService } from '../ai-settings/ai-tier.service';
import {
  GenerateCharactersDto,
  GeneratePlotDto,
  GenerateEmotionBlueprintDto,
  GenerateChapterOutlineDto,
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
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Claude API error: ${response.status} ${errorText}`);
      throw new ServiceUnavailableException('AI service error');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new ServiceUnavailableException('No response stream');

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

以下の形式でキャラクター提案をJSON形式で出力してください:
{
  "characters": [
    {
      "name": "提案する名前",
      "role": "主人公/ヒロイン/ライバル/メンター等",
      "personality": "性格の説明",
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

    const charInfo = dto.characters
      ? `\nキャラクター情報: ${typeof dto.characters === 'string' ? dto.characters : JSON.stringify(dto.characters)}`
      : '';
    const userPrompt = `テーマ: ${dto.themes}
${dto.message ? `伝えたいメッセージ: ${dto.message}` : ''}
${dto.emotionGoals ? `読者に与えたい感情: ${dto.emotionGoals}` : ''}${charInfo}

このテーマに沿った物語のプロット構造を提案してください。`;

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

重要: 出力はJSON形式のみにしてください。前置きや説明は不要です。JSONの前後にテキストを含めないでください。

以下の形式で出力してください:
{
  "chapters": [
    {
      "number": 1,
      "title": "章タイトル案",
      "summary": "章の概要（2-3文）",
      "keyScenes": ["シーン1", "シーン2"],
      "emotionTarget": "この章で狙う感情",
      "wordCountEstimate": 3000
    }
  ],
  "suggestions": "章構成への補足アドバイス"
}`;

    const parts: string[] = [];
    if (dto.plotOutline) parts.push(`プロット構成: ${JSON.stringify(dto.plotOutline)}`);
    if (dto.characters) parts.push(`キャラクター: ${JSON.stringify(dto.characters)}`);
    if (dto.emotionBlueprint) parts.push(`感情ブループリント: ${JSON.stringify(dto.emotionBlueprint)}`);
    if (dto.additionalNotes) parts.push(`追加メモ: ${dto.additionalNotes}`);

    const userPrompt = `${parts.join('\n\n')}

これらの情報を統合して、章立て構成を提案してください。`;

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

  // ─── Plan CRUD ───────────────────────────────────────────────

  async saveCreationPlan(workId: string, dto: SaveCreationPlanDto) {
    return this.prisma.workCreationPlan.upsert({
      where: { workId },
      update: {
        characters: dto.characters ?? undefined,
        plotOutline: dto.plotOutline ?? undefined,
        emotionBlueprint: dto.emotionBlueprint ?? undefined,
        chapterOutline: dto.chapterOutline ?? undefined,
      },
      create: {
        workId,
        characters: dto.characters ?? undefined,
        plotOutline: dto.plotOutline ?? undefined,
        emotionBlueprint: dto.emotionBlueprint ?? undefined,
        chapterOutline: dto.chapterOutline ?? undefined,
      },
    });
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
  async updateStorySummary(workId: string, userId: string): Promise<void> {
    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) return;

    const episodes = await this.prisma.episode.findMany({
      where: { workId },
      orderBy: { orderIndex: 'asc' },
      select: { title: true, content: true, orderIndex: true },
    });

    if (episodes.length === 0) return;

    // Build episode texts (truncated for summary generation)
    const episodeTexts = episodes
      .map((ep) => `第${ep.orderIndex + 1}話「${ep.title}」:\n${ep.content.slice(0, 1000)}`)
      .join('\n\n---\n\n');

    const prompt = `以下は小説の各話の内容です。全体を通した要約を以下のJSON形式で作成してください:

${episodeTexts}

{
  "overallSummary": "物語全体の要約（200字以内）",
  "episodes": [
    { "title": "話タイトル", "summary": "その話の要約（50字以内）", "keyEvents": ["重要な出来事1", "重要な出来事2"] }
  ],
  "characters": [
    { "name": "キャラ名", "currentState": "現在の状況（30字以内）" }
  ],
  "openThreads": ["未解決の伏線1", "未解決の伏線2"],
  "tone": "現在の物語のトーン（一言で）"
}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) return;

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

      // Log usage
      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;
      await this.prisma.aiUsageLog.create({
        data: {
          userId,
          feature: 'story_summary',
          inputTokens,
          outputTokens,
          model: 'claude-haiku-4-5-20251001',
          durationMs: 0,
        },
      }).catch(() => {});
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

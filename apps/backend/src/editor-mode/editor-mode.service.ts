import { Injectable, Logger, ServiceUnavailableException, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { AiTierService } from '../ai-settings/ai-tier.service';
import { CreditService } from '../billing/credit.service';
import {
  FinalizeDesignDto,
  StartGenerationDto,
  ChangeGenerationModeDto,
} from './dto/editor-mode.dto';

@Injectable()
export class EditorModeService {
  private readonly logger = new Logger(EditorModeService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
    private aiTier: AiTierService,
    private creditService: CreditService,
  ) {}

  // ─── Ownership check helper ──────────────────────────────

  private async getJobWithOwnerCheck(workId: string, userId: string) {
    const job = await this.prisma.editorModeJob.findUnique({ where: { workId } });
    if (!job) throw new NotFoundException('Editor mode job not found');
    if (job.userId !== userId) throw new ForbiddenException('Not authorized');
    return job;
  }

  // ─── Job management ────────────────────────────────────────

  async createWorkForEditorMode(userId: string) {
    const work = await this.prisma.work.create({
      data: {
        authorId: userId,
        title: '編集者モード — 設計中',
        isAiGenerated: true,
      },
    });
    await this.createJob(userId, work.id);
    return work;
  }

  async createJob(userId: string, workId: string) {
    return this.prisma.editorModeJob.upsert({
      where: { workId },
      update: {},
      create: {
        workId,
        userId,
        status: 'designing',
      },
    });
  }

  // ─── Design Chat (SSE stream) ─────────────────────────────

  async *streamDesignChat(
    userId: string,
    workId: string,
    message: string,
    _aiMode: 'normal' | 'premium' = 'premium',
    designState?: any,
  ): AsyncGenerator<string> {
    // Always use premium (Opus) for editor mode
    const { apiKey, model } = await this.getApiConfigForMode(userId, 'editor_mode_chat', 'premium');

    // Load existing job or create
    let job: Awaited<ReturnType<typeof this.prisma.editorModeJob.findUnique>>;
    const existing = await this.prisma.editorModeJob.findUnique({ where: { workId } });
    if (!existing) {
      job = await this.createJob(userId, workId);
    } else {
      if (existing.userId !== userId) throw new ForbiddenException('Not authorized');
      job = existing;
    }

    // Build chat history
    const history: { role: string; content: string }[] = (job.designChatHistory as any[]) || [];

    // Detect if this is the first message (no assistant messages yet)
    const isFirstMessage = !history.some(h => h.role === 'assistant');
    const creditCost = isFirstMessage ? 10 : 5;

    history.push({ role: 'user', content: message });

    // Build comprehensive design context from both chat history and tab edits
    const ds = designState || this.extractLatestDesignUpdate(history) || {};

    let systemPrompt: string;
    let maxTokens: number;

    if (isFirstMessage) {
      // ─── First message: complete design generation from user's brief ───
      maxTokens = 16000;
      systemPrompt = `あなたはベストセラー作家です。編集者（ユーザー）からブリーフを受け取り、完全な小説の設計書をJSON形式で出力してください。

【絶対ルール】
- 会話文や説明文は一切不要です。JSON出力のみ行ってください
- 以下の全フィールドを**一つ残らず**埋めてください
- 情報が足りなければ類推・創作して埋めてください。空欄・null・空文字は禁止です

以下の形式で出力してください（これ以外のテキストは出力しないでください）:

__DESIGN_UPDATE__
{
  "title": "魅力的なタイトル（必須）",
  "genre_setting": "メインジャンル（必須）",
  "theme": "テーマ（必須）",
  "coreMessage": "物語のコアメッセージ（必須）",
  "tone": "トーン・文体の説明（必須）",
  "targetEmotions": "読者に届けたい感情の流れ（必須）",
  "readerJourney": "読者の感情の旅路（必須）",
  "readerOneLiner": "一言で表す読後感（必須）",
  "conflict": "中心的な葛藤（具体的に。「善vs悪」ではなく「主人公が〇〇を失う恐怖と〇〇を守る覚悟の間で揺れる」のように）（必須）",
  "synopsis": "3-5行のあらすじ（必須）",
  "scope": "X話 × Y字（必須。ブリーフに指定があればそれを、なければ10話 × 3000字を推奨）",
  "characters": [
    {"name": "名前", "role": "役割", "personality": "性格（2-3文）", "speechStyle": "口調の特徴と例文", "firstPerson": "一人称（俺/私/僕/わたし等）", "motivation": "行動の動機", "background": "背景・過去"},
    （最低3人、理想4-5人。全員に明確な口調の差をつける）
  ],
  "worldBuilding": {
    "basics": {"era": "時代設定（必須）", "setting": "舞台の具体的な場所（必須）", "civilizationLevel": "文明・技術レベル（必須）"},
    "rules": [{"id": "r1", "name": "ルール名", "description": "説明", "constraints": "制約"}（最低2つ）],
    "terminology": [{"id": "t1", "term": "用語", "reading": "よみがな", "definition": "定義"}（最低3つ）],
    "history": "世界の歴史・背景（3-5文）",
    "infoAsymmetry": {"commonKnowledge": "登場人物・読者が知っている常識", "hiddenTruths": "物語で明かされる隠された真実"},
    "items": [{"id": "i1", "name": "アイテム名", "appearance": "外見", "ability": "能力・効果", "constraints": "制約", "owner": "所有者", "narrativeMeaning": "物語上の意味"}]
  },
  "structureTemplate": "kishotenketsu（または three-act, jo-ha-kyu）",
  "actGroups": [
    {
      "id": "act1",
      "label": "幕名（起/承/転/結 等）",
      "description": "この幕の概要",
      "episodes": [
        {"id": "ep1", "title": "第1話: サブタイトル", "whatHappens": "何が起こるか（2-3文）", "whyItHappens": "なぜそれが起こるか", "characters": ["登場キャラ名"], "emotionTarget": "この話で読者に感じてほしい感情", "aiSuggested": true}
      ]
    }
    （話数分のエピソードカードを全て作成すること）
  ]
}
__END_UPDATE__

【重要】
- ブリーフがたった一行でも、プロとして想像力を発揮して完全な設計書を作り上げてください
- JSON内の全フィールドに具体的な値を入れてください。nullや空文字は禁止
- キャラクターは最低3人。各キャラに明確な口調の差（一人称・語尾・語彙）を持たせる
- actGroupsのepisodesは話数分（scopeで指定した話数分）全て作成する
- 世界観のrulesは最低2つ、terminologyは最低3つ
- conflictは具体的に書く（抽象的な「善vs悪」は不可）`;
    } else {
      // ─── Subsequent messages: refinement with current design state ───
      maxTokens = 4000;

      // Build current design summary for the AI
      const designSections: string[] = [];

      // Genre & Theme
      if (ds.genre) designSections.push(`ジャンル: ${ds.genre}${ds.subGenres?.length ? ` (${ds.subGenres.join('、')})` : ''}`);
      if (ds.coreMessage || ds.theme) designSections.push(`テーマ: ${ds.coreMessage || ds.theme}`);
      if (ds.targetEmotions || ds.afterReading) designSections.push(`読後感: ${ds.targetEmotions || ds.afterReading}`);
      if (ds.readerJourney) designSections.push(`読者の旅路: ${ds.readerJourney}`);
      if (ds.tone) designSections.push(`トーン: ${ds.tone}`);

      // Characters
      if (Array.isArray(ds.characters) && ds.characters.length > 0) {
        const charLines = ds.characters.map((c: any) => {
          const parts = [`${c.name || '(未定)'}（${c.role || ''}）`];
          if (c.personality) parts.push(`性格: ${c.personality}`);
          if (c.speechStyle) parts.push(`口調: ${c.speechStyle}`);
          if (c.motivation) parts.push(`動機: ${c.motivation}`);
          if (c.background) parts.push(`背景: ${c.background}`);
          return parts.join(' / ');
        });
        designSections.push(`キャラクター:\n${charLines.join('\n')}`);
      } else if (ds.protagonist) {
        const p = typeof ds.protagonist === 'string' ? ds.protagonist : `${ds.protagonist.name}（${ds.protagonist.role || '主人公'}）`;
        designSections.push(`主人公: ${p}`);
      }

      // World Building
      if (ds.worldBuilding) {
        if (typeof ds.worldBuilding === 'string') {
          designSections.push(`世界観: ${ds.worldBuilding}`);
        } else {
          const wb = ds.worldBuilding;
          const wbParts: string[] = [];
          if (wb.basics?.era) wbParts.push(`時代: ${wb.basics.era}`);
          if (wb.basics?.setting) wbParts.push(`舞台: ${wb.basics.setting}`);
          if (wb.rules?.length) wbParts.push(`ルール: ${wb.rules.map((r: any) => r.name).filter(Boolean).join('、')}`);
          if (wb.terminology?.length) wbParts.push(`用語: ${wb.terminology.map((t: any) => t.term).filter(Boolean).join('、')}`);
          if (wbParts.length > 0) designSections.push(`世界観:\n${wbParts.join('\n')}`);
        }
      }

      // Plot
      if (ds.actGroups?.length > 0) {
        const plotParts = ds.actGroups.map((g: any) => {
          const eps = (g.episodes || []).map((ep: any) => ep.title || '(未定)').join('→');
          return `${g.label}: ${eps}`;
        });
        designSections.push(`プロット構成 (${ds.structureTemplate || '自由'}):\n${plotParts.join('\n')}`);
      } else if (ds.conflict || ds.plotOutline) {
        if (ds.conflict) designSections.push(`中心的な葛藤: ${ds.conflict}`);
        if (ds.plotOutline) designSections.push(`プロット概要: ${ds.plotOutline}`);
      }

      // Scope
      if (ds.episodeCount) designSections.push(`話数: ${ds.episodeCount}話${ds.charCountPerEpisode ? ` × ${ds.charCountPerEpisode}字` : ''}`);
      if (ds.title) designSections.push(`タイトル: ${ds.title}`);
      if (ds.synopsis) designSections.push(`あらすじ: ${ds.synopsis}`);

      systemPrompt = `あなたは小説家を育ててきたベテラン編集者です。ユーザーの修正指示に基づいて、設計書を改善してください。

【現在の設計状態】
${designSections.join('\n\n')}

あなたの役割:
- ユーザーの修正指示を正確に理解し、該当部分を改善する
- 修正が他の要素に影響する場合は、整合性を保つよう連動して修正する
- 修正の理由と改善ポイントを簡潔に説明する

【重要ルール】
- ユーザーの指示に直接対応する変更を行ってください
- キャラクターについて話すときは、必ず名前を使ってください
- 変更していない要素はJSONに含めないでください（変更した要素のみ）

修正内容を説明した後、末尾に必ず以下の形式で**変更した要素のみ**のJSONブロックを出力してください:
__DESIGN_UPDATE__
{変更した要素のみをJSON形式で。characterやworldBuildingは構造化オブジェクトで。}
__END_UPDATE__

対話は自然に、編集者としての経験に基づいた具体的な提案を交えて進めてください。`;
    }

    let transactionId: string | null = null;
    let contentDelivered = false;
    let fullOutput = '';
    const startTime = Date.now();

    try {
      if (creditCost > 0) {
        const result = await this.creditService.consumeCredits(userId, creditCost, 'editor_mode_chat', model);
        transactionId = result.transactionId;
      }

      const messages = history.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      }));

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
          max_tokens: maxTokens,
          stream: true,
          system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
          messages,
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
      let inputTokens = 0;
      let outputTokens = 0;

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
                fullOutput += event.delta.text;
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
            data: { userId, feature: 'editor_mode_chat', inputTokens, outputTokens, model, durationMs },
          })
          .catch((e) => this.logger.error('Failed to log AI usage', e));

        if (transactionId && contentDelivered) {
          await this.creditService.confirmTransaction(transactionId).catch((e) => this.logger.error(`Credit confirm failed`, e));
          transactionId = null;
        }
      }
    } catch (error) {
      if (transactionId && !contentDelivered) {
        await this.creditService.refundTransaction(transactionId).catch((e) => this.logger.error(`Credit refund failed`, e));
      } else if (transactionId && contentDelivered) {
        await this.creditService.confirmTransaction(transactionId).catch((e) => this.logger.error(`Credit confirm failed`, e));
      }
      throw error;
    }

    // Save chat history
    history.push({ role: 'assistant', content: fullOutput });
    await this.prisma.editorModeJob.update({
      where: { workId },
      data: {
        designChatHistory: history,
        creditsConsumed: { increment: creditCost },
      },
    });
  }

  // ─── Finalize Design ──────────────────────────────────────

  async finalizeDesign(userId: string, workId: string, dto: FinalizeDesignDto) {
    const job = await this.getJobWithOwnerCheck(workId, userId);

    // Extract design from chat history's last __DESIGN_UPDATE__ block
    const chatHistory = (job.designChatHistory as any[]) || [];
    const designData = this.extractLatestDesignUpdate(chatHistory);

    // Save to WorkCreationPlan
    await this.prisma.workCreationPlan.upsert({
      where: { workId },
      update: {
        characters: designData?.characters || undefined,
        plotOutline: designData?.plot ? { text: designData.plot } : undefined,
        emotionBlueprint: designData?.emotion ? { coreMessage: designData.emotion } : undefined,
      },
      create: {
        workId,
        characters: designData?.characters || undefined,
        plotOutline: designData?.plot ? { text: designData.plot } : undefined,
        emotionBlueprint: designData?.emotion ? { coreMessage: designData.emotion } : undefined,
      },
    });

    // Build episode plan from design data
    const episodePlan: { episodeNumber: number; title: string; summary: string }[] = [];
    for (let i = 1; i <= dto.totalEpisodes; i++) {
      episodePlan.push({
        episodeNumber: i,
        title: `第${i}話`,
        summary: '',
      });
    }

    // Update job
    await this.prisma.editorModeJob.update({
      where: { workId },
      data: {
        status: 'taste_check',
        totalEpisodes: dto.totalEpisodes,
        aiMode: dto.aiMode || job.aiMode,
        episodePlan,
      },
    });

    return { status: 'taste_check', totalEpisodes: dto.totalEpisodes };
  }

  // ─── Generate First Episode (SSE) ─────────────────────────

  async *generateFirstEpisode(
    userId: string,
    workId: string,
    aiMode: 'normal' | 'premium' = 'normal',
  ): AsyncGenerator<string> {
    const job = await this.getJobWithOwnerCheck(workId, userId);

    const { apiKey, model, creditCost } = await this.getApiConfigForMode(userId, 'editor_mode_generate', aiMode);

    const plan = await this.prisma.workCreationPlan.findUnique({ where: { workId } });
    const designData = this.extractLatestDesignUpdate((job.designChatHistory as any[]) || []);

    const systemPrompt = this.buildEpisodeGenerationPrompt(designData, plan, [], 1, job.totalEpisodes);

    const userPrompt = `第1話を執筆してください。物語の冒頭として読者を引き込む魅力的な導入にしてください。`;

    let fullOutput = '';
    for await (const chunk of this.streamFromClaude(
      apiKey, model, systemPrompt, userPrompt, userId, 'editor_mode_generate', creditCost,
    )) {
      fullOutput += chunk;
      yield chunk;
    }

    // Save episode
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (work) {
      await this.prisma.episode.upsert({
        where: { workId_orderIndex: { workId, orderIndex: 0 } },
        update: {
          content: fullOutput,
          title: `第1話`,
          wordCount: fullOutput.length,
        },
        create: {
          workId,
          authorId: userId,
          title: `第1話`,
          content: fullOutput,
          orderIndex: 0,
          wordCount: fullOutput.length,
        },
      });
    }

    // Update job
    await this.prisma.editorModeJob.update({
      where: { workId },
      data: {
        completedEpisodes: 1,
        creditsConsumed: { increment: creditCost },
      },
    });
  }

  // ─── Start Generation ─────────────────────────────────────

  async startGeneration(userId: string, workId: string, dto: StartGenerationDto) {
    await this.getJobWithOwnerCheck(workId, userId);

    const updated = await this.prisma.editorModeJob.updateMany({
      where: { workId, status: { not: 'generating' } },
      data: {
        status: 'generating',
        aiMode: dto.aiMode,
        generationMode: dto.generationMode,
      },
    });
    if (updated.count === 0) throw new ConflictException('Generation already in progress');

    // Fire-and-forget: start the generation loop
    this.runGenerationLoop(workId, userId).catch((e) =>
      this.logger.error(`Generation loop error for work ${workId}`, e),
    );

    return { status: 'generating' };
  }

  // ─── Pause Generation ─────────────────────────────────────

  async pauseGeneration(userId: string, workId: string) {
    await this.getJobWithOwnerCheck(workId, userId);

    await this.prisma.editorModeJob.update({
      where: { workId },
      data: { status: 'paused' },
    });

    return { status: 'paused' };
  }

  // ─── Resume Generation ────────────────────────────────────

  async resumeGeneration(userId: string, workId: string, dto: StartGenerationDto) {
    await this.getJobWithOwnerCheck(workId, userId);

    const updated = await this.prisma.editorModeJob.updateMany({
      where: { workId, status: { not: 'generating' } },
      data: {
        status: 'generating',
        aiMode: dto.aiMode,
        generationMode: dto.generationMode,
      },
    });
    if (updated.count === 0) throw new ConflictException('Generation already in progress');

    this.runGenerationLoop(workId, userId).catch((e) =>
      this.logger.error(`Generation loop error for work ${workId}`, e),
    );

    return { status: 'generating' };
  }

  // ─── Revise Episode (SSE) ─────────────────────────────────

  async *streamReviseEpisode(
    userId: string,
    workId: string,
    episodeId: string,
    instruction: string,
    aiMode: 'normal' | 'premium' = 'normal',
  ): AsyncGenerator<string> {
    await this.getJobWithOwnerCheck(workId, userId);

    const episode = await this.prisma.episode.findUnique({ where: { id: episodeId } });
    if (!episode) throw new NotFoundException('Episode not found');
    if (episode.workId !== workId) throw new NotFoundException('Episode not found');

    const { apiKey, model, creditCost } = await this.getApiConfigForMode(userId, 'editor_mode_revise', aiMode);

    const systemPrompt = `あなたは小説の編集者からの修正指示を受けて原稿を修正するプロの作家です。
元の文体・トーン・キャラクターの声を維持しながら、指示に従って修正してください。
修正後の全文を出力してください（修正部分だけでなく全文）。`;

    const userPrompt = `【現在の原稿】
${episode.content}

【修正指示】
${instruction}

上記の修正指示に従って、原稿を修正してください。全文を出力してください。`;

    let fullOutput = '';
    for await (const chunk of this.streamFromClaude(
      apiKey, model, systemPrompt, userPrompt, userId, 'editor_mode_revise', creditCost,
    )) {
      fullOutput += chunk;
      yield chunk;
    }

    // Update episode
    await this.prisma.episode.update({
      where: { id: episodeId },
      data: {
        content: fullOutput,
        wordCount: fullOutput.length,
        contentVersion: { increment: 1 },
      },
    });
  }

  // ─── Regenerate Episode (SSE) ─────────────────────────────

  async *streamRegenerateEpisode(
    userId: string,
    workId: string,
    episodeId: string,
    aiMode: 'normal' | 'premium' = 'normal',
  ): AsyncGenerator<string> {
    const job = await this.getJobWithOwnerCheck(workId, userId);

    const episode = await this.prisma.episode.findUnique({ where: { id: episodeId } });
    if (!episode) throw new NotFoundException('Episode not found');
    if (episode.workId !== workId) throw new NotFoundException('Episode not found');

    const { apiKey, model, creditCost } = await this.getApiConfigForMode(userId, 'editor_mode_generate', aiMode);

    const plan = await this.prisma.workCreationPlan.findUnique({ where: { workId } });
    const designData = this.extractLatestDesignUpdate((job.designChatHistory as any[]) || []);

    // Get previous episode summaries
    const previousEpisodes = await this.prisma.episode.findMany({
      where: { workId, orderIndex: { lt: episode.orderIndex } },
      orderBy: { orderIndex: 'asc' },
      select: { title: true, content: true, orderIndex: true },
    });

    const episodeSummaries = previousEpisodes.map((ep) => ({
      episodeNumber: ep.orderIndex + 1,
      title: ep.title,
      summary: ep.content.slice(0, 500),
    }));

    const episodeNumber = episode.orderIndex + 1;
    const systemPrompt = this.buildEpisodeGenerationPrompt(designData, plan, episodeSummaries, episodeNumber, job.totalEpisodes);
    const userPrompt = `第${episodeNumber}話を最初から書き直してください。`;

    let fullOutput = '';
    for await (const chunk of this.streamFromClaude(
      apiKey, model, systemPrompt, userPrompt, userId, 'editor_mode_generate', creditCost,
    )) {
      fullOutput += chunk;
      yield chunk;
    }

    await this.prisma.episode.update({
      where: { id: episodeId },
      data: {
        content: fullOutput,
        wordCount: fullOutput.length,
        contentVersion: { increment: 1 },
      },
    });
  }

  // ─── Auto-fix Episode (SSE) ───────────────────────────────

  async *autoFixEpisode(
    userId: string,
    workId: string,
    episodeId: string,
    aiMode: 'normal' | 'premium' = 'normal',
  ): AsyncGenerator<string> {
    const job = await this.getJobWithOwnerCheck(workId, userId);

    const episode = await this.prisma.episode.findUnique({ where: { id: episodeId } });
    if (!episode) throw new NotFoundException('Episode not found');
    if (episode.workId !== workId) throw new NotFoundException('Episode not found');

    const { apiKey, model, creditCost } = await this.getApiConfigForMode(userId, 'editor_mode_revise', aiMode);

    const designData = this.extractLatestDesignUpdate((job.designChatHistory as any[]) || []);

    // Get surrounding episodes (prev 2 + next 2)
    const surroundingEpisodes = await this.prisma.episode.findMany({
      where: {
        workId,
        orderIndex: {
          gte: Math.max(0, episode.orderIndex - 2),
          lte: episode.orderIndex + 2,
        },
      },
      orderBy: { orderIndex: 'asc' },
      select: { title: true, content: true, orderIndex: true },
    });

    const contextParts: string[] = [];
    for (const ep of surroundingEpisodes) {
      if (ep.orderIndex === episode.orderIndex) continue;
      const label = ep.orderIndex < episode.orderIndex ? '前' : '後';
      contextParts.push(`【${label}のエピソード: 第${ep.orderIndex + 1}話「${ep.title}」】\n${ep.content.slice(0, 2000)}`);
    }

    // Add design context
    if (designData) {
      const designParts: string[] = [];
      if (designData.genre_setting) designParts.push(`ジャンル: ${designData.genre_setting}`);
      if (designData.characters) designParts.push(`キャラクター: ${typeof designData.characters === 'string' ? designData.characters : JSON.stringify(designData.characters)}`);
      if (designData.tone) designParts.push(`トーン: ${designData.tone}`);
      if (designData.world) designParts.push(`世界観: ${designData.world}`);
      if (designParts.length > 0) {
        contextParts.push(`【設計情報】\n${designParts.join('\n')}`);
      }
    }

    const systemPrompt = `あなたは小説の品質管理AIです。前後のエピソードのコンテキストと設計情報を照合し、対象エピソードの問題を自動修正してください。

チェック項目:
- キャラクターの口調揺れ（一人称・語尾・言葉遣いの一貫性）
- 伏線の整合性（前のエピソードで設置された伏線との矛盾）
- トーンの一貫性（前後のエピソードとの雰囲気の統一）
- 時系列の矛盾
- 世界観設定との矛盾

まず修正箇所と理由を __FIX_REPORT__ ブロックで報告し、その後に修正済み全文を出力してください。

__FIX_REPORT__
- 修正1: [箇所] → [理由]
- 修正2: [箇所] → [理由]
__END_REPORT__

[修正済み全文]`;

    const userPrompt = `${contextParts.join('\n\n')}

【修正対象: 第${episode.orderIndex + 1}話「${episode.title}」】
${episode.content}

上記のエピソードを前後の文脈と設計情報に照合し、整合性を修正してください。`;

    let fullOutput = '';
    for await (const chunk of this.streamFromClaude(
      apiKey, model, systemPrompt, userPrompt, userId, 'editor_mode_revise', creditCost,
    )) {
      fullOutput += chunk;
      yield chunk;
    }

    // Extract content after __END_REPORT__ if present
    const reportEndIdx = fullOutput.indexOf('__END_REPORT__');
    const revisedContent = reportEndIdx >= 0
      ? fullOutput.slice(reportEndIdx + '__END_REPORT__'.length).trim()
      : fullOutput;

    if (revisedContent) {
      await this.prisma.episode.update({
        where: { id: episodeId },
        data: {
          content: revisedContent,
          wordCount: revisedContent.length,
          contentVersion: { increment: 1 },
        },
      });
    }
  }

  // ─── Approve Episode ──────────────────────────────────────

  async approveEpisode(userId: string, workId: string, episodeId: string) {
    await this.getJobWithOwnerCheck(workId, userId);

    const episode = await this.prisma.episode.findUnique({ where: { id: episodeId } });
    if (!episode) throw new NotFoundException('Episode not found');
    if (episode.workId !== workId) throw new NotFoundException('Episode not found');

    // We don't have a separate approval field on Episode, so we publish it
    await this.prisma.episode.update({
      where: { id: episodeId },
      data: { publishedAt: new Date() },
    });

    return { approved: true, episodeId };
  }

  // ─── Get Status ───────────────────────────────────────────

  async getStatus(userId: string, workId: string) {
    const job = await this.getJobWithOwnerCheck(workId, userId);

    const episodes = await this.prisma.episode.findMany({
      where: { workId },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        title: true,
        orderIndex: true,
        wordCount: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    return {
      id: job.id,
      status: job.status,
      aiMode: job.aiMode,
      generationMode: job.generationMode,
      totalEpisodes: job.totalEpisodes,
      completedEpisodes: job.completedEpisodes,
      creditsConsumed: job.creditsConsumed,
      episodePlan: job.episodePlan,
      designChatHistory: job.designChatHistory,
      episodes: episodes.map((ep) => ({
        id: ep.id,
        title: ep.title,
        orderIndex: ep.orderIndex,
        wordCount: ep.wordCount,
        approved: !!ep.publishedAt,
        updatedAt: ep.updatedAt,
      })),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  // ─── Change Generation Mode ───────────────────────────────

  async changeGenerationMode(userId: string, workId: string, dto: ChangeGenerationModeDto) {
    await this.getJobWithOwnerCheck(workId, userId);

    await this.prisma.editorModeJob.update({
      where: { workId },
      data: { generationMode: dto.generationMode },
    });

    return { generationMode: dto.generationMode };
  }

  // ─── Generation Loop (private, async) ─────────────────────

  private async runGenerationLoop(workId: string, userId: string): Promise<void> {
    this.logger.log(`Starting generation loop for work ${workId}`);

    while (true) {
      // Re-read job status from DB each iteration
      const job = await this.prisma.editorModeJob.findUnique({ where: { workId } });
      if (!job || job.status !== 'generating') {
        this.logger.log(`Generation loop stopped: status=${job?.status}`);
        break;
      }

      const nextEpisodeIndex = job.completedEpisodes; // 0-based
      if (nextEpisodeIndex >= job.totalEpisodes) {
        // All episodes generated
        await this.prisma.editorModeJob.update({
          where: { workId },
          data: { status: 'reviewing' },
        });
        this.logger.log(`Generation complete for work ${workId}`);
        break;
      }

      const aiMode = job.aiMode as 'normal' | 'premium';

      try {
        const { apiKey, model, creditCost } = await this.getApiConfigForMode(userId, 'editor_mode_generate', aiMode);

        // Check credits before generating
        const balance = await this.creditService.getBalance(userId);
        if (balance.total < creditCost) {
          this.logger.warn(`Insufficient credits for work ${workId}, pausing`);
          await this.prisma.editorModeJob.update({
            where: { workId },
            data: { status: 'paused' },
          });
          break;
        }

        // Get context
        const plan = await this.prisma.workCreationPlan.findUnique({ where: { workId } });
        const designData = this.extractLatestDesignUpdate((job.designChatHistory as any[]) || []);
        const previousEpisodes = await this.prisma.episode.findMany({
          where: { workId, orderIndex: { lt: nextEpisodeIndex } },
          orderBy: { orderIndex: 'asc' },
          select: { title: true, content: true, orderIndex: true },
        });

        const episodeSummaries = previousEpisodes.map((ep) => ({
          episodeNumber: ep.orderIndex + 1,
          title: ep.title,
          summary: ep.content.slice(0, 500),
        }));

        const episodeNumber = nextEpisodeIndex + 1;
        const systemPrompt = this.buildEpisodeGenerationPrompt(designData, plan, episodeSummaries, episodeNumber, job.totalEpisodes);
        const userPrompt = `第${episodeNumber}話を執筆してください。`;

        // Generate (non-streaming for background loop)
        let fullOutput = '';
        for await (const chunk of this.streamFromClaude(
          apiKey, model, systemPrompt, userPrompt, userId, 'editor_mode_generate', creditCost,
        )) {
          fullOutput += chunk;
        }

        // Save episode
        await this.prisma.episode.upsert({
          where: { workId_orderIndex: { workId, orderIndex: nextEpisodeIndex } },
          update: {
            content: fullOutput,
            title: `第${episodeNumber}話`,
            wordCount: fullOutput.length,
          },
          create: {
            workId,
            authorId: userId,
            title: `第${episodeNumber}話`,
            content: fullOutput,
            orderIndex: nextEpisodeIndex,
            wordCount: fullOutput.length,
          },
        });

        // Update progress
        await this.prisma.editorModeJob.update({
          where: { workId },
          data: {
            completedEpisodes: episodeNumber,
            creditsConsumed: { increment: creditCost },
          },
        });

        this.logger.log(`Generated episode ${episodeNumber}/${job.totalEpisodes} for work ${workId}`);

        // In confirm mode, pause after each episode
        if (job.generationMode === 'confirm') {
          await this.prisma.editorModeJob.update({
            where: { workId },
            data: { status: 'paused' },
          });
          break;
        }
      } catch (error) {
        this.logger.error(`Error generating episode ${nextEpisodeIndex + 1} for work ${workId}`, error);
        await this.prisma.editorModeJob.update({
          where: { workId },
          data: { status: 'paused' },
        }).catch(() => {});
        break;
      }
    }
  }

  // ─── Claude streaming helper ──────────────────────────────

  private async *streamFromClaude(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    userId: string,
    feature: string,
    creditCost: number,
  ): AsyncGenerator<string> {
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let transactionId: string | null = null;
    let contentDelivered = false;

    try {
      if (creditCost > 0) {
        const result = await this.creditService.consumeCredits(userId, creditCost, feature, model);
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
          system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
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
            data: { userId, feature, inputTokens, outputTokens, model, durationMs },
          })
          .catch((e) => this.logger.error('Failed to log AI usage', e));

        if (transactionId && contentDelivered) {
          await this.creditService.confirmTransaction(transactionId).catch((e) => this.logger.error(`Credit confirm failed`, e));
          transactionId = null;
        }
      }
    } catch (error) {
      if (transactionId && !contentDelivered) {
        await this.creditService.refundTransaction(transactionId).catch((e) => this.logger.error(`Credit refund failed`, e));
      } else if (transactionId && contentDelivered) {
        await this.creditService.confirmTransaction(transactionId).catch((e) => this.logger.error(`Credit confirm failed`, e));
      }
      throw error;
    }
  }

  // ─── Private helpers ──────────────────────────────────────

  private async getApiConfigForMode(
    userId: string,
    feature: string,
    aiMode: 'normal' | 'premium' = 'normal',
  ): Promise<{ apiKey: string; model: string; creditCost: number }> {
    const enabled = await this.aiSettings.isAiEnabled();
    if (!enabled) throw new ServiceUnavailableException('AI is currently disabled');

    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    await this.aiTier.assertCanUseAi(userId);

    const modelConfig = await this.aiTier.getModelConfig(userId, false, feature, aiMode);
    const creditCost = this.aiTier.getCreditCost(feature, false, false, aiMode);

    return { apiKey, model: modelConfig.model, creditCost };
  }

  private extractLatestDesignUpdate(chatHistory: { role: string; content: string }[]): any | null {
    // Walk backwards through assistant messages to find the latest __DESIGN_UPDATE__
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const msg = chatHistory[i];
      if (msg.role !== 'assistant') continue;

      const startIdx = msg.content.lastIndexOf('__DESIGN_UPDATE__');
      const endIdx = msg.content.lastIndexOf('__END_UPDATE__');
      if (startIdx >= 0 && endIdx > startIdx) {
        const jsonStr = msg.content.slice(startIdx + '__DESIGN_UPDATE__'.length, endIdx).trim();
        try {
          return JSON.parse(jsonStr);
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  private buildEpisodeGenerationPrompt(
    designData: any,
    plan: any,
    previousEpisodeSummaries: { episodeNumber: number; title: string; summary: string }[],
    currentEpisodeNumber: number,
    totalEpisodes: number,
  ): string {
    const parts: string[] = [];

    parts.push(`あなたはプロの小説家です。編集者の設計書に基づいて、高品質な小説のエピソードを執筆してください。

【品質ルール】
- 各話にキラーライン（その話のために存在する一文）を必ず入れる
- 五感描写を全話に入れる（没入力の底上げ）
- キャラクター全員の声を書き分ける（一人称・口調・語彙の一貫性）
- 伏線は設置と回収を明確にする
- 前話の余韻を抱えたまま書く（感情の連続性）
- 各エピソードの冒頭で読者を引き込む`);

    if (designData) {
      const designParts: string[] = [];
      if (designData.genre_setting) designParts.push(`ジャンル・舞台: ${designData.genre_setting}`);
      if (designData.theme) designParts.push(`テーマ: ${designData.theme}`);
      if (designData.emotion) designParts.push(`読後感: ${designData.emotion}`);
      if (designData.protagonist) designParts.push(`主人公: ${designData.protagonist}`);
      if (designData.characters) designParts.push(`キャラクター: ${typeof designData.characters === 'string' ? designData.characters : JSON.stringify(designData.characters)}`);
      if (designData.world) designParts.push(`世界観: ${designData.world}`);
      if (designData.conflict) designParts.push(`中心的な葛藤: ${designData.conflict}`);
      if (designData.plot) designParts.push(`プロット: ${designData.plot}`);
      if (designData.tone) designParts.push(`トーン・文体: ${designData.tone}`);
      if (designData.scope) designParts.push(`スコープ: ${designData.scope}`);
      if (designParts.length > 0) {
        parts.push(`\n【設計書】\n${designParts.join('\n')}`);
      }
    }

    if (plan?.characters) {
      const chars = Array.isArray(plan.characters) ? plan.characters : [];
      if (chars.length > 0) {
        const charTexts = chars.map((c: any) => `- ${c.name || '名前未定'}（${c.role || ''}）: ${c.personality || ''} / 口調: ${c.speechStyle || ''} / 一人称: ${c.firstPerson || ''}`);
        parts.push(`\n【キャラクター設定】\n${charTexts.join('\n')}`);
      }
    }

    if (previousEpisodeSummaries.length > 0) {
      const summaryTexts = previousEpisodeSummaries.map(
        (s) => `第${s.episodeNumber}話「${s.title}」: ${s.summary}`,
      );
      parts.push(`\n【これまでのエピソード要約】\n${summaryTexts.join('\n')}`);
    }

    parts.push(`\n現在: 第${currentEpisodeNumber}話 / 全${totalEpisodes}話`);

    return parts.join('\n');
  }
}

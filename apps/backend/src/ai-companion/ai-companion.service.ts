import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { AiTierService } from '../ai-settings/ai-tier.service';

const MAX_WORK_TEXT_LENGTH = 20000;
const MAX_STRUCTURED_CONTEXT_LENGTH = 3000;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AiCompanionService {
  private readonly logger = new Logger(AiCompanionService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
    private aiTier: AiTierService,
  ) {}

  async *streamChat(
    userId: string,
    workId: string,
    userMessage: string,
  ): AsyncGenerator<string> {
    // Check companion-specific limits (weekly limit for free users, not credit-based)
    await this.aiTier.assertCanUseCompanion(userId);
    const modelConfig = await this.aiTier.getCompanionModelConfig();

    const enabled = await this.aiSettings.isAiEnabled();
    if (!enabled) throw new ServiceUnavailableException('AI is currently disabled');

    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    const model = modelConfig.model;

    // Load or create conversation
    let conversation = await this.prisma.aiConversation.findUnique({
      where: { userId_workId: { userId, workId } },
    });

    const existingMessages: ChatMessage[] = conversation
      ? (conversation.messages as unknown as ChatMessage[])
      : [];

    // Get work info, reading progress, and structured data in parallel
    const [work, progress, publicCharacters, storyArc, creationPlan, episodeAnalyses] = await Promise.all([
      this.prisma.work.findUnique({
        where: { id: workId },
        include: {
          episodes: {
            orderBy: { orderIndex: 'asc' },
            select: { id: true, title: true, content: true, orderIndex: true },
          },
        },
      }),
      this.prisma.readingProgress.findMany({
        where: { userId, workId },
        select: { episodeId: true, completed: true, progressPct: true },
      }),
      this.prisma.storyCharacter.findMany({
        where: { workId, isPublic: true },
        select: { name: true, role: true, personality: true, motivation: true, speechStyle: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.storyArc.findUnique({
        where: { workId },
        select: { premise: true, centralConflict: true, themes: true },
      }),
      this.prisma.workCreationPlan.findUnique({
        where: { workId },
        select: { emotionBlueprint: true, worldBuildingData: true },
      }),
      this.prisma.episodeAnalysis.findMany({
        where: { workId },
        select: { episode: { select: { orderIndex: true } }, characters: true },
        orderBy: { episode: { orderIndex: 'asc' } },
      }),
    ]);

    if (!work) throw new NotFoundException('Work not found');

    // Build work text (up to limit)
    const completedEpisodeIds = new Set(
      progress.filter((p) => p.completed).map((p) => p.episodeId),
    );
    const currentEpisodeIndex = Math.max(
      ...progress.map((p) => {
        const ep = work.episodes.find((e) => e.id === p.episodeId);
        return ep ? ep.orderIndex : 0;
      }),
      0,
    );

    // Spoiler prevention: collect character names that appeared up to reader's progress
    const appearedCharNames = new Set<string>();
    for (const ea of episodeAnalyses) {
      if (ea.episode.orderIndex <= currentEpisodeIndex && Array.isArray(ea.characters)) {
        for (const c of ea.characters as any[]) {
          if (c.name) appearedCharNames.add(c.name);
        }
      }
    }

    // Build structured context (spoiler-safe)
    const structuredParts: string[] = [];

    // Characters: only those that appeared in read episodes
    const safeChars = publicCharacters.filter((c) => appearedCharNames.has(c.name));
    if (safeChars.length > 0) {
      const charLines = safeChars.map((c) =>
        `- ${c.name} (${c.role}): ${[c.personality, c.motivation, c.speechStyle ? `口調:${c.speechStyle}` : ''].filter(Boolean).join('、')}`,
      ).join('\n');
      structuredParts.push(`【登場人物情報】\n${charLines}`);
    }

    // World setting (no spoilers in world basics)
    const wb = creationPlan?.worldBuildingData as any;
    if (wb) {
      const wbLines: string[] = [];
      if (wb.basics?.era) wbLines.push(`時代: ${wb.basics.era}`);
      if (wb.basics?.setting) wbLines.push(`舞台: ${wb.basics.setting}`);
      for (const term of (Array.isArray(wb.terminology) ? wb.terminology : []).slice(0, 10)) {
        if (term.term) wbLines.push(`${term.term}: ${term.definition}`);
      }
      if (wbLines.length > 0) structuredParts.push(`【世界観】\n${wbLines.join('\n')}`);
    }

    // Story themes (non-spoiler)
    if (storyArc) {
      const themeLines: string[] = [];
      if (storyArc.premise) themeLines.push(`前提: ${storyArc.premise}`);
      if (storyArc.centralConflict) themeLines.push(`中心的葛藤: ${storyArc.centralConflict}`);
      if (storyArc.themes.length > 0) themeLines.push(`テーマ: ${storyArc.themes.join('、')}`);
      if (themeLines.length > 0) structuredParts.push(`【物語のテーマ】\n${themeLines.join('\n')}`);
    }

    const structuredContext = structuredParts.join('\n\n').slice(0, MAX_STRUCTURED_CONTEXT_LENGTH);

    const fullText = work.episodes.map((e) => e.content).join('\n\n');
    const workText = fullText.slice(0, MAX_WORK_TEXT_LENGTH);

    const systemPrompt = `あなたは「${work.title}」の読書コンパニオンAIです。読者と作品について語り合います。

重要なルール:
- 読者は第${currentEpisodeIndex + 1}話まで読んでいます。それ以降のネタバレは絶対にしないでください。
- 読者が読んだ範囲の内容について、深い考察や感想を共有してください。
- 質問には親切に、しかし未読部分の内容は明かさないでください。
- 登場人物の名前、性格、口調を以下の情報から正確に参照してください。
- 世界観の用語や設定を正確に使用してください。
- 日本語で回答してください。
${structuredContext ? `\n${structuredContext}\n` : ''}
作品テキスト（読者の既読範囲）:
${workText}`;

    // Build messages array for Claude
    const messages: ChatMessage[] = [
      ...existingMessages.slice(-20), // Keep last 20 messages for context
      { role: 'user', content: userMessage },
    ];

    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let assistantResponse = '';

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
        max_tokens: 4000,
        stream: true,
        system: [
          {
            type: 'text' as const,
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages,
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
              assistantResponse += event.delta.text;
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

      // Save conversation
      const updatedMessages: ChatMessage[] = [
        ...existingMessages,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: assistantResponse },
      ];

      await this.prisma.aiConversation.upsert({
        where: { userId_workId: { userId, workId } },
        update: { messages: updatedMessages as any },
        create: { userId, workId, messages: updatedMessages as any },
      }).catch((e) => this.logger.error('Failed to save conversation', e));

      // Log usage
      const durationMs = Date.now() - startTime;
      await this.prisma.aiUsageLog.create({
        data: {
          userId,
          feature: 'book_companion',
          inputTokens,
          outputTokens,
          model,
          durationMs,
        },
      }).catch((e) => this.logger.error('Failed to log AI usage', e));
    }
  }

  async getHistory(userId: string, workId: string) {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { userId_workId: { userId, workId } },
    });
    return { messages: conversation?.messages || [] };
  }

  async clearConversation(userId: string, workId: string) {
    await this.prisma.aiConversation.deleteMany({
      where: { userId, workId },
    });
    return { deleted: true };
  }
}

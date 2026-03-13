import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { AiTierService } from '../ai-settings/ai-tier.service';

const MAX_WORK_TEXT_LENGTH = 30000;

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
    // Check tier (enforces free weekly limit, throws ForbiddenException if exceeded)
    const modelConfig = await this.aiTier.getModelConfig(userId, false, 'companion');

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

    // Get work info and reading progress
    const [work, progress] = await Promise.all([
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

    const fullText = work.episodes.map((e) => e.content).join('\n\n');
    const workText = fullText.slice(0, MAX_WORK_TEXT_LENGTH);

    const systemPrompt = `あなたは「${work.title}」の読書コンパニオンAIです。読者と作品について語り合います。

重要なルール:
- 読者は第${currentEpisodeIndex + 1}話まで読んでいます。それ以降のネタバレは絶対にしないでください。
- 読者が読んだ範囲の内容について、深い考察や感想を共有してください。
- 質問には親切に、しかし未読部分の内容は明かさないでください。
- 日本語で回答してください。

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

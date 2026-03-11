import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';

@Injectable()
export class HighlightsService {
  private readonly logger = new Logger(HighlightsService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
  ) {}

  async create(userId: string, data: {
    episodeId: string;
    startPos: number;
    endPos: number;
    color?: string;
    memo?: string;
  }) {
    return this.prisma.highlight.create({
      data: { userId, ...data },
    });
  }

  async findByEpisode(userId: string, episodeId: string) {
    return this.prisma.highlight.findMany({
      where: { userId, episodeId },
      orderBy: { startPos: 'asc' },
    });
  }

  async findByWork(userId: string, workId: string) {
    return this.prisma.highlight.findMany({
      where: {
        userId,
        episode: { workId },
      },
      orderBy: { createdAt: 'desc' },
      include: { episode: { select: { id: true, title: true } } },
    });
  }

  async update(id: string, userId: string, data: { memo?: string; color?: string }) {
    const hl = await this.prisma.highlight.findUnique({ where: { id } });
    if (!hl || hl.userId !== userId) throw new NotFoundException();
    return this.prisma.highlight.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, userId: string) {
    const hl = await this.prisma.highlight.findUnique({ where: { id } });
    if (!hl || hl.userId !== userId) throw new NotFoundException();
    await this.prisma.highlight.delete({ where: { id } });
    return { deleted: true };
  }

  async getHighlightWithContext(highlightId: string, userId: string) {
    const highlight = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
      include: {
        episode: {
          select: { id: true, title: true, content: true, workId: true },
        },
      },
    });
    if (!highlight || highlight.userId !== userId) throw new NotFoundException();

    const text = highlight.episode.content.slice(highlight.startPos, highlight.endPos);
    return {
      text,
      episodeId: highlight.episodeId,
      workId: highlight.episode.workId,
    };
  }

  async explainHighlight(highlightId: string, userId: string) {
    const highlight = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
      include: {
        episode: {
          select: { id: true, title: true, content: true, workId: true },
        },
      },
    });
    if (!highlight || highlight.userId !== userId) throw new NotFoundException();

    const enabled = await this.aiSettings.isAiEnabled();
    if (!enabled) throw new ServiceUnavailableException('AI is currently disabled');

    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    const model = await this.aiSettings.getModel();

    // Extract highlighted text and surrounding context
    const episodeContent = highlight.episode.content;
    const highlightedText = episodeContent.slice(highlight.startPos, highlight.endPos);
    const contextStart = Math.max(0, highlight.startPos - 500);
    const contextEnd = Math.min(episodeContent.length, highlight.endPos + 500);
    const context = episodeContent.slice(contextStart, contextEnd);

    const prompt = `読者が以下の箇所をハイライトしました。この箇所の文学的意味、文脈上の重要性、作者の意図について200-400字で解説してください。

ハイライト箇所: 「${highlightedText}」

前後の文脈:
${context}

${highlight.memo ? `読者のメモ: ${highlight.memo}` : ''}

JSON形式で回答: { "explanation": "...", "literaryDevices": ["技法1", "技法2"], "significance": "..." }`;

    const startTime = Date.now();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Claude API error: ${response.status} ${errorText}`);
      throw new ServiceUnavailableException('AI service error');
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';
    const durationMs = Date.now() - startTime;

    // Log usage
    await this.prisma.aiUsageLog.create({
      data: {
        userId,
        feature: 'highlight_explain',
        inputTokens: result.usage?.input_tokens || 0,
        outputTokens: result.usage?.output_tokens || 0,
        model,
        durationMs,
      },
    }).catch((e) => this.logger.error('Failed to log AI usage', e));

    // Parse JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      this.logger.warn('Failed to parse AI JSON response');
    }
    return { explanation: text };
  }
}

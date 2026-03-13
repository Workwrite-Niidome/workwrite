import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';

const MAX_WORK_TEXT_LENGTH = 15000;
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
// Cache TTL: 1 hour
const CACHE_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AiRecommendationsService {
  private readonly logger = new Logger(AiRecommendationsService.name);
  private cache = new Map<string, { data: unknown; expiresAt: number }>();

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
  ) {}

  async getPersonalRecommendations(userId: string) {
    // Check cache
    const cacheKey = `personal:${userId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    // Get user's read works with emotion tags
    const readWorks = await this.prisma.readingProgress.findMany({
      where: { userId, completed: true },
      select: { workId: true },
      distinct: ['workId'],
    });

    const readWorkIds = readWorks.map((r) => r.workId);

    const emotionTags = await this.prisma.userEmotionTag.findMany({
      where: { userId },
      include: { tag: true, work: { select: { title: true } } },
    });

    // Get all work embeddings for unread works
    const candidates = await this.prisma.workEmbedding.findMany({
      where: { workId: { notIn: readWorkIds } },
      include: { work: { select: { id: true, title: true, synopsis: true, coverUrl: true, genre: true } } },
      take: 50,
    });

    if (candidates.length === 0) {
      return { recommendations: [] };
    }

    const userProfile = emotionTags
      .map((et) => `「${et.work.title}」で${et.tag.name}(強度:${et.intensity})`)
      .join(', ') || '読書履歴なし';

    const candidateList = candidates
      .map((c) => `ID:${c.workId} 「${c.work.title}」 要約:${c.summary} テーマ:${JSON.stringify(c.themes)} トーン:${c.tone || '不明'}`)
      .join('\n');

    const prompt = `あなたは読書レコメンドAIです。
以下の読者プロフィールに基づき、候補作品から最大5作品を推薦してください。

読者の感情傾向: ${userProfile}

候補作品:
${candidateList}

JSON形式で回答: { "recommendations": [{ "workId": "...", "reason": "推薦理由(50字以内)" }] }`;

    const result = await this.callClaude(prompt, 'recommendations', userId);
    const parsed = this.parseJsonResponse(result);
    this.cache.set(cacheKey, { data: parsed, expiresAt: Date.now() + CACHE_TTL_MS });
    return parsed;
  }

  async getBecauseYouRead(workId: string) {
    // Check cache
    const cacheKey = `because:${workId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    const sourceEmbedding = await this.prisma.workEmbedding.findUnique({
      where: { workId },
      include: { work: { select: { title: true } } },
    });

    if (!sourceEmbedding) {
      return { recommendations: [] };
    }

    // Get other work embeddings
    const candidates = await this.prisma.workEmbedding.findMany({
      where: { workId: { not: workId } },
      include: { work: { select: { id: true, title: true, synopsis: true, coverUrl: true, genre: true } } },
      take: 30,
    });

    if (candidates.length === 0) {
      return { recommendations: [] };
    }

    const candidateList = candidates
      .map((c) => `ID:${c.workId} 「${c.work.title}」 要約:${c.summary} テーマ:${JSON.stringify(c.themes)} トーン:${c.tone || '不明'}`)
      .join('\n');

    const prompt = `「${sourceEmbedding.work.title}」を読んだ人におすすめの作品を候補から最大5つ選んでください。

元の作品: 要約:${sourceEmbedding.summary} テーマ:${JSON.stringify(sourceEmbedding.themes)} トーン:${sourceEmbedding.tone || '不明'}

候補作品:
${candidateList}

JSON形式で回答: { "recommendations": [{ "workId": "...", "reason": "推薦理由(50字以内)" }] }`;

    const result = await this.callClaude(prompt, 'because_you_read');
    const parsed = this.parseJsonResponse(result);
    this.cache.set(cacheKey, { data: parsed, expiresAt: Date.now() + CACHE_TTL_MS });
    return parsed;
  }

  async generateEmbedding(workId: string) {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      include: {
        episodes: {
          orderBy: { orderIndex: 'asc' },
          select: { content: true },
        },
      },
    });
    if (!work) throw new NotFoundException('Work not found');

    const fullText = work.episodes.map((e) => e.content).join('\n\n');
    const workText = fullText.slice(0, MAX_WORK_TEXT_LENGTH);

    const prompt = `この作品を200字で要約し、テーマ、トーン、対象読者をJSON形式で回答してください: { "summary": "...", "themes": ["テーマ1", "テーマ2"], "tone": "...", "audience": "..." }

作品テキスト:
${workText}`;

    const result = await this.callClaude(prompt, 'embedding_generation');
    const parsed = this.parseJsonResponse(result);

    const embedding = await this.prisma.workEmbedding.upsert({
      where: { workId },
      update: {
        summary: String(parsed.summary || ''),
        themes: (parsed.themes || []) as any,
        tone: parsed.tone ? String(parsed.tone) : null,
        audience: parsed.audience ? String(parsed.audience) : null,
      },
      create: {
        workId,
        summary: String(parsed.summary || ''),
        themes: (parsed.themes || []) as any,
        tone: parsed.tone ? String(parsed.tone) : null,
        audience: parsed.audience ? String(parsed.audience) : null,
      },
    });

    return embedding;
  }

  private parseJsonResponse(text: string): Record<string, unknown> {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      this.logger.warn('Failed to parse AI JSON response, returning as text');
    }
    return { raw: text };
  }

  private async callClaude(prompt: string, feature: string, userId?: string): Promise<string> {
    const enabled = await this.aiSettings.isAiEnabled();
    if (!enabled) throw new ServiceUnavailableException('AI is currently disabled');

    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    // Use Haiku for recommendations (cost-efficient, structured output)
    const model = HAIKU_MODEL;
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

    await this.prisma.aiUsageLog.create({
      data: {
        userId: userId || 'system',
        feature,
        inputTokens: result.usage?.input_tokens || 0,
        outputTokens: result.usage?.output_tokens || 0,
        model,
        durationMs,
      },
    }).catch((e) => this.logger.error('Failed to log AI usage', e));

    return text;
  }
}

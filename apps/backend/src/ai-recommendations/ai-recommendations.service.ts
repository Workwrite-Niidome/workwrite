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
      .map((c) => {
        const parts = [`ID:${c.workId} 「${c.work.title}」 要約:${c.summary} テーマ:${JSON.stringify(c.themes)} トーン:${c.tone || '不明'}`];
        if (c.worldType) parts.push(`世界観:${c.worldType}`);
        if (c.emotionProfile) parts.push(`感情:${JSON.stringify(c.emotionProfile)}`);
        if (c.characters) parts.push(`キャラ:${JSON.stringify(c.characters)}`);
        return parts.join(' ');
      })
      .join('\n');

    const prompt = `あなたは読書レコメンドAIです。
以下の読者プロフィールに基づき、候補作品から最大5作品を推薦してください。
世界観タイプの類似性、感情の整合性を考慮してください。

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
      .map((c) => {
        const parts = [`ID:${c.workId} 「${c.work.title}」 要約:${c.summary} テーマ:${JSON.stringify(c.themes)} トーン:${c.tone || '不明'}`];
        if (c.worldType) parts.push(`世界観:${c.worldType}`);
        if (c.emotionProfile) parts.push(`感情:${JSON.stringify(c.emotionProfile)}`);
        return parts.join(' ');
      })
      .join('\n');

    const sourceExtra: string[] = [];
    if (sourceEmbedding.worldType) sourceExtra.push(`世界観:${sourceEmbedding.worldType}`);
    if (sourceEmbedding.emotionProfile) sourceExtra.push(`感情:${JSON.stringify(sourceEmbedding.emotionProfile)}`);

    const prompt = `「${sourceEmbedding.work.title}」を読んだ人におすすめの作品を候補から最大5つ選んでください。
世界観タイプの類似性、感情の整合性を考慮してください。

元の作品: 要約:${sourceEmbedding.summary} テーマ:${JSON.stringify(sourceEmbedding.themes)} トーン:${sourceEmbedding.tone || '不明'} ${sourceExtra.join(' ')}

候補作品:
${candidateList}

JSON形式で回答: { "recommendations": [{ "workId": "...", "reason": "推薦理由(50字以内)" }] }`;

    const result = await this.callClaude(prompt, 'because_you_read');
    const parsed = this.parseJsonResponse(result);
    this.cache.set(cacheKey, { data: parsed, expiresAt: Date.now() + CACHE_TTL_MS });
    return parsed;
  }

  async generateEmbedding(workId: string) {
    const [work, characters, storyArc, creationPlan] = await Promise.all([
      this.prisma.work.findUnique({
        where: { id: workId },
        include: {
          episodes: {
            orderBy: { orderIndex: 'asc' },
            select: { content: true },
          },
        },
      }),
      this.prisma.storyCharacter.findMany({
        where: { workId },
        select: { name: true, role: true, motivation: true },
        orderBy: { sortOrder: 'asc' },
        take: 10,
      }),
      this.prisma.storyArc.findUnique({
        where: { workId },
        select: { premise: true, centralConflict: true, themes: true },
      }),
      this.prisma.workCreationPlan.findUnique({
        where: { workId },
        select: { emotionBlueprint: true, worldBuildingData: true },
      }),
    ]);
    if (!work) throw new NotFoundException('Work not found');

    const fullText = work.episodes.map((e) => e.content).join('\n\n');
    const workText = fullText.slice(0, 10000);

    // Build enriched context
    const enrichParts: string[] = [];
    if (characters.length > 0) {
      enrichParts.push(`キャラクター: ${characters.map((c) => `${c.name}(${c.role}${c.motivation ? `,${c.motivation}` : ''})`).join(', ')}`);
    }
    const wb = creationPlan?.worldBuildingData as any;
    if (wb?.basics) {
      enrichParts.push(`世界観: ${[wb.basics.era, wb.basics.setting, wb.basics.civilizationLevel].filter(Boolean).join(', ')}`);
    }
    const eb = creationPlan?.emotionBlueprint as any;
    if (eb) {
      if (eb.coreMessage) enrichParts.push(`核メッセージ: ${eb.coreMessage}`);
      if (eb.targetEmotions) enrichParts.push(`目標感情: ${eb.targetEmotions}`);
    }
    if (storyArc) {
      if (storyArc.premise) enrichParts.push(`前提: ${storyArc.premise}`);
      if (storyArc.themes.length > 0) enrichParts.push(`テーマ: ${storyArc.themes.join(', ')}`);
    }

    const enrichedContext = enrichParts.length > 0
      ? `\n\n構造化データ:\n${enrichParts.join('\n')}`
      : '';

    const prompt = `この作品を200字で要約し、以下のJSON形式で回答してください:
{
  "summary": "200字の要約",
  "themes": ["テーマ1", "テーマ2"],
  "tone": "トーン",
  "audience": "対象読者",
  "characters": ["キャラ名1", "キャラ名2"],
  "worldType": "世界観タイプ（例: 中世ファンタジー, 現代日本, 近未来SF）",
  "emotionProfile": ["感動", "希望"],
  "subGenre": "具体的サブジャンル"
}
${enrichedContext}

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
        characters: (parsed.characters || []) as any,
        worldType: parsed.worldType ? String(parsed.worldType) : null,
        emotionProfile: (parsed.emotionProfile || []) as any,
        subGenre: parsed.subGenre ? String(parsed.subGenre) : null,
      },
      create: {
        workId,
        summary: String(parsed.summary || ''),
        themes: (parsed.themes || []) as any,
        tone: parsed.tone ? String(parsed.tone) : null,
        audience: parsed.audience ? String(parsed.audience) : null,
        characters: (parsed.characters || []) as any,
        worldType: parsed.worldType ? String(parsed.worldType) : null,
        emotionProfile: (parsed.emotionProfile || []) as any,
        subGenre: parsed.subGenre ? String(parsed.subGenre) : null,
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

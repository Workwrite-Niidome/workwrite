import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';

const MAX_WORK_TEXT_LENGTH = 15000;
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
  ) {}

  async getGenericInsights(workId: string) {
    // Check cache first
    const cached = await this.prisma.aiInsight.findFirst({
      where: { workId, userId: null, type: 'generic' },
    });
    if (cached) return cached.content;

    // Generate new insights with structured context
    const workText = await this.getWorkText(workId);

    // Fetch structured data for richer analysis
    const [characters, storyArc, creationPlan, foreshadowings] = await Promise.all([
      this.prisma.storyCharacter.findMany({
        where: { workId },
        select: { name: true, role: true, personality: true, motivation: true, arc: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.storyArc.findUnique({
        where: { workId },
        select: { premise: true, centralConflict: true, themes: true },
      }),
      this.prisma.workCreationPlan.findUnique({
        where: { workId },
        select: { emotionBlueprint: true },
      }),
      this.prisma.foreshadowing.findMany({
        where: { workId, status: 'open' },
        select: { description: true, plantedIn: true, importance: true },
        take: 20,
      }),
    ]);

    // Build structured reference section
    const structuredRef: string[] = [];
    if (characters.length > 0) {
      const charList = characters.map((c) =>
        `- ${c.name} (${c.role}): 性格=${c.personality || '不明'}, 動機=${c.motivation || '不明'}, アーク=${c.arc || '不明'}`,
      ).join('\n');
      structuredRef.push(`【キャラクター設計】\n${charList}`);
    }
    if (storyArc) {
      const arcLines: string[] = [];
      if (storyArc.premise) arcLines.push(`前提: ${storyArc.premise}`);
      if (storyArc.centralConflict) arcLines.push(`葛藤: ${storyArc.centralConflict}`);
      if (storyArc.themes.length > 0) arcLines.push(`テーマ: ${storyArc.themes.join('、')}`);
      if (arcLines.length > 0) structuredRef.push(`【ストーリーアーク】\n${arcLines.join('\n')}`);
    }
    const eb = creationPlan?.emotionBlueprint as any;
    if (eb) {
      const ebLines: string[] = [];
      if (eb.coreMessage) ebLines.push(`核メッセージ: ${eb.coreMessage}`);
      if (eb.targetEmotions) ebLines.push(`目標感情: ${eb.targetEmotions}`);
      if (ebLines.length > 0) structuredRef.push(`【感情設計】\n${ebLines.join('\n')}`);
    }
    if (foreshadowings.length > 0) {
      const fList = foreshadowings.map((f) =>
        `- [第${f.plantedIn + 1}話] ${f.description} (${f.importance})`,
      ).join('\n');
      structuredRef.push(`【未回収の伏線】\n${fList}`);
    }

    const structuredSection = structuredRef.length > 0
      ? `\n\n以下は作者の設計データです。分析の参考にしてください:\n${structuredRef.join('\n\n')}\n`
      : '';

    const prompt = `あなたは文学評論家です。以下の小説を分析し、JSON形式で回答してください。
{
  "themes": [{ "name": "テーマ名", "explanation": "説明" }],
  "emotionalJourney": "作品の感情的な軌道の説明",
  "characterInsights": [{ "name": "人物名", "arc": "成長や変化" }],
  "symbolism": [{ "element": "象徴", "meaning": "意味" }],
  "discussionQuestions": ["問い1", "問い2", "問い3"],
  "foreshadowingStatus": [{ "description": "伏線", "suggestion": "解決提案" }],
  "characterArcProgress": [{ "name": "人物名", "planned": "計画されたアーク", "current": "現在の進捗" }],
  "emotionAlignment": { "intended": "作者の意図した感情", "detected": "検出された感情アーク", "alignment": "一致度の説明" }
}
${structuredSection}
作品テキスト:
${workText}`;

    const result = await this.callClaude(prompt, 'generic_insights');
    const content = this.parseJsonResponse(result);

    // Save to cache (userId=null for generic insights)
    await this.prisma.aiInsight.create({
      data: {
        workId,
        userId: null,
        type: 'generic',
        content: content as any,
      },
    });

    return content;
  }

  /**
   * @deprecated Personal insights have been removed to reduce AI costs.
   * Use getGenericInsights() instead (cached per work, Haiku model).
   */
  async getPersonalInsights(workId: string, _userId: string) {
    // Return generic insights instead of generating per-user insights
    return this.getGenericInsights(workId);
  }

  private async getWorkText(workId: string): Promise<string> {
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
    return fullText.slice(0, MAX_WORK_TEXT_LENGTH);
  }

  private parseJsonResponse(text: string): Record<string, unknown> {
    try {
      // Try to extract JSON from the response
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

    // Use Haiku for insights (cost-efficient, cached per work)
    const model = HAIKU_MODEL;
    const startTime = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
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
        signal: controller.signal,
      });
    } catch (e) {
      this.logger.error(`Claude API call failed: ${e}`);
      throw new ServiceUnavailableException('AI service timeout or network error');
    } finally {
      clearTimeout(timeout);
    }

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

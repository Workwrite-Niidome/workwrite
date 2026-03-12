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

    // Generate new insights
    const workText = await this.getWorkText(workId);
    const prompt = `あなたは文学評論家です。以下の小説を分析し、JSON形式で回答してください。
{
  "themes": [{ "name": "テーマ名", "explanation": "説明" }],
  "emotionalJourney": "作品の感情的な軌道の説明",
  "characterInsights": [{ "name": "人物名", "arc": "成長や変化" }],
  "symbolism": [{ "element": "象徴", "meaning": "意味" }],
  "discussionQuestions": ["問い1", "問い2", "問い3"]
}

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

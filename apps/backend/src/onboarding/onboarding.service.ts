import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { SubmitOnboardingDto, ONBOARDING_QUESTIONS } from './dto/onboarding.dto';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
  ) {}

  getQuestions() {
    return ONBOARDING_QUESTIONS;
  }

  async submitOnboarding(userId: string, dto: SubmitOnboardingDto) {
    const existing = await this.prisma.onboardingResult.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException('Onboarding already completed');
    }

    const emotionVector = this.calculateEmotionVector(dto.answers);

    const result = await this.prisma.onboardingResult.create({
      data: {
        userId,
        answers: dto.answers as any,
        emotionVector: emotionVector as any,
      },
    });

    // Generate AI profile asynchronously (don't block the response)
    this.generateAiProfile(userId, dto.answers, emotionVector).catch((e) =>
      this.logger.error('Failed to generate AI profile', e),
    );

    return { result, emotionVector };
  }

  async getOnboardingStatus(userId: string) {
    const result = await this.prisma.onboardingResult.findUnique({
      where: { userId },
    });
    return { completed: !!result, completedAt: result?.completedAt };
  }

  private calculateEmotionVector(answers: SubmitOnboardingDto['answers']) {
    // Map answers to initial emotion vector dimensions
    const vector: Record<string, number> = {
      courage: 0,
      tears: 0,
      worldview: 0,
      healing: 0,
      excitement: 0,
      thinking: 0,
      laughter: 0,
      empathy: 0,
    };

    for (const answer of answers) {
      const weight = answer.weight / 5;

      switch (answer.questionId) {
        case 'reading_goal':
          if (answer.answer === 'escape') { vector.healing += weight; vector.excitement += weight; }
          if (answer.answer === 'growth') { vector.thinking += weight; vector.worldview += weight; }
          if (answer.answer === 'emotion') { vector.tears += weight; vector.empathy += weight; }
          if (answer.answer === 'fun') { vector.laughter += weight; vector.excitement += weight; }
          break;
        case 'emotional_preference':
          if (answer.answer === 'joy') { vector.laughter += weight; vector.courage += weight; }
          if (answer.answer === 'thrill') { vector.excitement += weight; }
          if (answer.answer === 'sadness') { vector.tears += weight; vector.empathy += weight; }
          if (answer.answer === 'wonder') { vector.worldview += weight; }
          if (answer.answer === 'comfort') { vector.healing += weight; }
          break;
        case 'current_mood':
          if (answer.answer === 'tired') { vector.healing += weight * 0.5; }
          if (answer.answer === 'energetic') { vector.excitement += weight * 0.5; }
          break;
      }
    }

    // Normalize to 0-1
    const max = Math.max(...Object.values(vector), 1);
    for (const key of Object.keys(vector)) {
      vector[key] = Math.round((vector[key] / max) * 100) / 100;
    }

    return vector;
  }

  async getAiProfile(userId: string) {
    const result = await this.prisma.onboardingResult.findUnique({
      where: { userId },
    });
    if (!result) throw new NotFoundException('Onboarding not completed');
    return { aiProfile: result.aiProfile };
  }

  private async generateAiProfile(
    userId: string,
    answers: SubmitOnboardingDto['answers'],
    emotionVector: Record<string, number>,
  ) {
    const enabled = await this.aiSettings.isAiEnabled();
    if (!enabled) return;

    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) return;

    const model = await this.aiSettings.getModel();

    const answersText = answers
      .map((a) => `質問:${a.questionId} 回答:${a.answer} 重み:${a.weight}`)
      .join('\n');
    const vectorText = Object.entries(emotionVector)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');

    const prompt = `以下のオンボーディング回答と感情ベクトルから、この読者の「読書パーソナリティ」を生成してください。

回答:
${answersText}

感情ベクトル: ${vectorText}

JSON形式で回答: { "personalityType": "タイプ名(4-8文字)", "description": "この読者の読書傾向の説明(100-200字)", "strengths": ["強み1", "強み2"], "recommendedGenres": ["ジャンル1", "ジャンル2"], "readingStyle": "読書スタイルの説明(50字程度)" }`;

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
      this.logger.error(`Claude API error: ${response.status}`);
      return;
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';
    const durationMs = Date.now() - startTime;

    // Log usage
    await this.prisma.aiUsageLog.create({
      data: {
        userId,
        feature: 'onboarding_profile',
        inputTokens: result.usage?.input_tokens || 0,
        outputTokens: result.usage?.output_tokens || 0,
        model,
        durationMs,
      },
    }).catch((e) => this.logger.error('Failed to log AI usage', e));

    // Parse and save AI profile
    let aiProfile: Record<string, unknown> = { raw: text };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiProfile = JSON.parse(jsonMatch[0]);
      }
    } catch {
      this.logger.warn('Failed to parse AI profile JSON');
    }

    await this.prisma.onboardingResult.update({
      where: { userId },
      data: { aiProfile: aiProfile as any },
    });
  }
}

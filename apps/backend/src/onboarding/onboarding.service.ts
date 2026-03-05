import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SubmitOnboardingDto, ONBOARDING_QUESTIONS } from './dto/onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

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
}

import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from './ai-settings.service';

export interface AiTier {
  plan: 'free' | 'standard' | 'premium';
  canUseAi: boolean;
  canUseThinking: boolean;
  remainingFreeUses: number | null; // null = unlimited
}

const FREE_WEEKLY_LIMIT = 5;

@Injectable()
export class AiTierService {
  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
  ) {}

  /** Get the user's current AI tier and remaining usage */
  async getUserTier(userId: string): Promise<AiTier> {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    const plan = sub?.status === 'active' ? (sub.plan as 'standard' | 'premium') : 'free';

    if (plan === 'premium') {
      return { plan, canUseAi: true, canUseThinking: true, remainingFreeUses: null };
    }

    if (plan === 'standard') {
      return { plan, canUseAi: true, canUseThinking: false, remainingFreeUses: null };
    }

    // Free tier: count weekly usage
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyUsage = await this.prisma.aiUsageLog.count({
      where: {
        userId,
        createdAt: { gte: weekAgo },
      },
    });

    const remaining = Math.max(0, FREE_WEEKLY_LIMIT - weeklyUsage);

    return {
      plan,
      canUseAi: remaining > 0,
      canUseThinking: false,
      remainingFreeUses: remaining,
    };
  }

  /** Check if the user can use AI. Throws ForbiddenException if not. */
  async assertCanUseAi(userId: string): Promise<AiTier> {
    const tier = await this.getUserTier(userId);
    if (!tier.canUseAi) {
      throw new ForbiddenException(
        '無料プランの週間AI使用回数の上限に達しました。プランをアップグレードすると無制限にご利用いただけます。',
      );
    }
    return tier;
  }

  /** Get the model config based on user's tier and requested mode */
  async getModelConfig(userId: string, premiumMode: boolean = false): Promise<{
    model: string;
    thinking: boolean;
    budgetTokens: number;
  }> {
    const tier = await this.assertCanUseAi(userId);
    const baseModel = await this.aiSettings.getModel();

    if (premiumMode && tier.canUseThinking) {
      return {
        model: baseModel,
        thinking: true,
        budgetTokens: 10000,
      };
    }

    return {
      model: baseModel,
      thinking: false,
      budgetTokens: 0,
    };
  }

  /** Admin: grant a plan to a user */
  async grantPlan(adminId: string, targetUserId: string, plan: 'standard' | 'premium'): Promise<void> {
    await this.prisma.subscription.upsert({
      where: { userId: targetUserId },
      update: {
        plan,
        status: 'active',
        grantedBy: adminId,
        currentPeriodEnd: null,
      },
      create: {
        userId: targetUserId,
        plan,
        status: 'active',
        grantedBy: adminId,
        stripeSubId: null,
        currentPeriodEnd: null,
      },
    });
  }

  /** Admin: revoke a user's plan */
  async revokePlan(targetUserId: string): Promise<void> {
    await this.prisma.subscription.deleteMany({
      where: { userId: targetUserId },
    });
  }
}

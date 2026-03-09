import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from './ai-settings.service';

export type PlanType = 'free' | 'starter' | 'standard' | 'premium';

export interface AiTier {
  plan: PlanType;
  canUseAi: boolean;
  canUseThinking: boolean;
  canUseOpus: boolean;
  remainingFreeUses: number | null; // null = unlimited
}

// ─── Plan Limits ─────────────────────────────────────────
const FREE_WEEKLY_LIMIT = 5;

// ─── Model Routing ───────────────────────────────────────
// Light tasks: use Haiku (校正, スコアリング, あらすじ, ハイライト説明, オンボーディング)
// Creative tasks: use Sonnet (執筆アシスト, キャラクター, プロット, 章立て, コンパニオン)
// Premium tasks: use Opus (じっくりモード)
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const OPUS_MODEL = 'claude-opus-4-6';

const LIGHT_FEATURES = new Set([
  'proofread', 'scoring', 'episode_scoring', 'synopsis-gen',
  'highlight_explain', 'onboarding_profile', 'embedding_generation',
]);

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

    const rawPlan = sub?.status === 'active' ? sub.plan : 'free';
    // Map legacy 'standard' plan name to 'starter' for backward compatibility
    const plan: PlanType = rawPlan === 'standard' ? 'starter' : (rawPlan as PlanType);

    if (plan === 'premium') {
      return { plan, canUseAi: true, canUseThinking: true, canUseOpus: true, remainingFreeUses: null };
    }

    if (plan === 'standard') {
      return { plan, canUseAi: true, canUseThinking: true, canUseOpus: false, remainingFreeUses: null };
    }

    if (plan === 'starter') {
      return { plan, canUseAi: true, canUseThinking: false, canUseOpus: false, remainingFreeUses: null };
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
      canUseOpus: false,
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

  /** Get the model config based on user's tier, feature, and requested mode */
  async getModelConfig(
    userId: string,
    premiumMode: boolean = false,
    feature?: string,
  ): Promise<{
    model: string;
    thinking: boolean;
    budgetTokens: number;
  }> {
    const tier = await this.assertCanUseAi(userId);
    const baseSonnet = await this.aiSettings.getModel();

    // Premium mode with Opus (premium plan only)
    if (premiumMode && tier.canUseOpus) {
      return {
        model: OPUS_MODEL,
        thinking: true,
        budgetTokens: 16000,
      };
    }

    // Standard thinking mode (standard + premium)
    if (premiumMode && tier.canUseThinking) {
      return {
        model: baseSonnet,
        thinking: true,
        budgetTokens: 10000,
      };
    }

    // Light tasks → Haiku (all tiers)
    if (feature && LIGHT_FEATURES.has(feature)) {
      return {
        model: HAIKU_MODEL,
        thinking: false,
        budgetTokens: 0,
      };
    }

    // Default: Sonnet
    return {
      model: baseSonnet,
      thinking: false,
      budgetTokens: 0,
    };
  }

  /** Admin: grant a plan to a user */
  async grantPlan(adminId: string, targetUserId: string, plan: 'starter' | 'standard' | 'premium'): Promise<void> {
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

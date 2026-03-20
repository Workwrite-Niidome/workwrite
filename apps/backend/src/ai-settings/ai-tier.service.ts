import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from './ai-settings.service';
import { CreditService } from '../billing/credit.service';

export type PlanType = 'free' | 'standard' | 'pro';

export interface AiTier {
  plan: PlanType;
  canUseAi: boolean;
  canUseThinking: boolean;
  canUseOpus: boolean;
  remainingFreeUses: number | null; // null = unlimited
  credits: { total: number; monthly: number; purchased: number };
}

// ─── Model Routing ───────────────────────────────────────
// Light tasks: use Haiku (校正, スコアリング, あらすじ, ハイライト説明, オンボーディング)
// Creative tasks: use Sonnet (執筆アシスト, キャラクター, プロット, 章立て, コンパニオン)
// Premium tasks: use Opus (高精度モード)
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const OPUS_MODEL = 'claude-opus-4-6';

const LIGHT_FEATURES = new Set([
  'proofread', 'episode_scoring', 'synopsis-gen',
  'highlight_explain', 'onboarding_profile', 'embedding_generation',
  'companion', 'reflection', 'consistency_check',
]);

// Free tier weekly limit for AI reading companion
const FREE_WEEKLY_COMPANION_LIMIT = 5;

@Injectable()
export class AiTierService {
  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
    private creditService: CreditService,
  ) {}

  /**
   * Get credit cost for a feature.
   * LIGHT_FEATURES (Haiku): 0cr
   * Sonnet normal: 1cr
   * Sonnet + Thinking: 2cr
   * Opus: 5cr
   * companion: 0cr
   * creation_wizard: 1cr
   */
  getCreditCost(
    feature: string,
    premiumMode: boolean = false,
    isOpus: boolean = false,
    aiMode?: 'normal' | 'thinking' | 'premium',
  ): number {
    // Companion is always free
    if (feature === 'companion') return 0;

    // Light features are always free
    if (LIGHT_FEATURES.has(feature)) return 0;

    // New aiMode takes precedence over legacy premiumMode flag
    if (aiMode === 'premium') return 5;
    if (aiMode === 'thinking') return 2;
    if (aiMode === 'normal') return 1;

    // Legacy fallback: premiumMode boolean
    if (premiumMode && isOpus) return 5;
    if (premiumMode) return 2;

    // Normal Sonnet (including creation_wizard)
    return 1;
  }

  /** Get the user's current AI tier and remaining usage */
  async getUserTier(userId: string): Promise<AiTier> {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    const rawPlan = sub?.status === 'active' ? sub.plan : 'free';
    // Normalize plan names: treat 'premium' as 'pro', unknown paid plans as 'standard'
    let plan: PlanType;
    if (rawPlan === 'pro' || rawPlan === 'premium') {
      plan = 'pro';
    } else if (rawPlan === 'standard') {
      plan = 'standard';
    } else if (rawPlan === 'free' || !sub || sub.status !== 'active') {
      plan = 'free';
    } else {
      // Unknown paid plan — treat as standard
      plan = 'standard';
    }

    const credits = await this.creditService.getBalance(userId);

    if (plan === 'pro') {
      return {
        plan,
        canUseAi: true,
        canUseThinking: true,
        canUseOpus: true,
        remainingFreeUses: null,
        credits,
      };
    }

    if (plan === 'standard') {
      return {
        plan,
        canUseAi: true,
        canUseThinking: true,
        canUseOpus: true,
        remainingFreeUses: null,
        credits,
      };
    }

    // Free tier: check credit balance (not weekly count)
    // canUseAi is true if they have any credits left
    return {
      plan,
      canUseAi: credits.total > 0,
      canUseThinking: false,
      canUseOpus: false,
      remainingFreeUses: credits.total,
      credits,
    };
  }

  /** Check if the user can use AI. Throws ForbiddenException if not. */
  async assertCanUseAi(userId: string): Promise<AiTier> {
    const tier = await this.getUserTier(userId);
    if (!tier.canUseAi) {
      throw new ForbiddenException(
        'クレジットが不足しています。プランをアップグレードするか、クレジットを追加購入してください。',
      );
    }
    return tier;
  }

  /** Check if free user can use companion (weekly limit) */
  async assertCanUseCompanion(userId: string): Promise<AiTier> {
    const tier = await this.getUserTier(userId);

    if (tier.plan !== 'free') return tier;

    // Free tier: check weekly companion usage
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyUsage = await this.prisma.aiUsageLog.count({
      where: {
        userId,
        feature: 'companion',
        createdAt: { gte: weekAgo },
      },
    });

    if (weeklyUsage >= FREE_WEEKLY_COMPANION_LIMIT) {
      throw new ForbiddenException(
        '無料プランのAI読書コンパニオンの週間使用回数の上限（5回）に達しました。プランをアップグレードすると無制限にご利用いただけます。',
      );
    }

    return tier;
  }

  /** Get the model config based on user's tier, feature, and requested mode */
  async getModelConfig(
    userId: string,
    premiumMode: boolean = false,
    feature?: string,
    aiMode?: 'normal' | 'thinking' | 'premium',
  ): Promise<{
    model: string;
    thinking: boolean;
    budgetTokens: number;
  }> {
    const tier = await this.assertCanUseAi(userId);
    const baseSonnet = await this.aiSettings.getModel();

    // Resolve effective mode from aiMode or legacy premiumMode
    const effectiveMode = aiMode || (premiumMode ? 'thinking' : 'normal');

    // Premium (Opus) mode — pro plan only, falls back to thinking
    if (effectiveMode === 'premium') {
      if (tier.canUseOpus) {
        return {
          model: OPUS_MODEL,
          thinking: true,
          budgetTokens: 16000,
        };
      }
      // Pro-only feature — fall through to thinking if standard user somehow requests it
      if (tier.canUseThinking) {
        return {
          model: baseSonnet,
          thinking: true,
          budgetTokens: 10000,
        };
      }
    }

    // Thinking mode — standard + pro
    if (effectiveMode === 'thinking' && tier.canUseThinking) {
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
  async grantPlan(adminId: string, targetUserId: string, plan: 'standard' | 'pro'): Promise<void> {
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

    // Grant credits for the plan
    const credits = plan === 'pro' ? 600 : 200;
    await this.creditService.grantMonthlyCredits(targetUserId, credits, plan);
  }

  /** Admin: revoke a user's plan */
  async revokePlan(targetUserId: string): Promise<void> {
    await this.prisma.subscription.deleteMany({
      where: { userId: targetUserId },
    });

    // Reset to free credits
    await this.creditService.grantMonthlyCredits(targetUserId, 30, 'free');
  }
}

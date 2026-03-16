import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreditService } from '../billing/credit.service';

const REWARD_CONFIG: Record<string, number> = {
  first_work_published: 50,
  first_review: 10,
};

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    private prisma: PrismaService,
    private creditService: CreditService,
  ) {}

  /**
   * Check and grant referral reward when a trigger event occurs.
   * Called from work publish / review create flows.
   */
  async checkAndReward(inviteeId: string, triggerEvent: string): Promise<void> {
    const rewardAmount = REWARD_CONFIG[triggerEvent];
    if (!rewardAmount) return;

    // Find who invited this user via invite code
    const inviterId = await this.findInviter(inviteeId);
    if (!inviterId) return;

    // Prevent duplicate rewards
    const existing = await this.prisma.referralReward.findUnique({
      where: {
        inviterId_inviteeId_triggerEvent: {
          inviterId,
          inviteeId,
          triggerEvent,
        },
      },
    });
    if (existing) return;

    // Create reward record and grant credits
    try {
      await this.prisma.referralReward.create({
        data: {
          inviterId,
          inviteeId,
          triggerEvent,
          creditAmount: rewardAmount,
          claimed: true,
          claimedAt: new Date(),
        },
      });

      // Grant credits to inviter
      await this.creditService.ensureCreditBalance(inviterId);
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRawUnsafe(
          'SELECT * FROM "CreditBalance" WHERE "userId" = $1 FOR UPDATE',
          inviterId,
        );

        await tx.creditBalance.update({
          where: { userId: inviterId },
          data: {
            balance: { increment: rewardAmount },
            purchasedBalance: { increment: rewardAmount }, // referral credits don't expire
          },
        });

        await tx.creditTransaction.create({
          data: {
            userId: inviterId,
            amount: rewardAmount,
            type: 'PURCHASE', // reuse existing type
            status: 'confirmed',
            balance: 0, // will be overwritten by actual
            description: `招待報酬: ${triggerEvent === 'first_work_published' ? '招待ユーザーが初作品を公開' : '招待ユーザーが初レビューを投稿'} (+${rewardAmount}cr)`,
          },
        });
      });

      this.logger.log(
        `Referral reward granted: ${rewardAmount}cr to ${inviterId} (event: ${triggerEvent}, invitee: ${inviteeId})`,
      );
    } catch (e) {
      this.logger.error(`Failed to grant referral reward: ${e}`);
    }
  }

  /** Find who invited a given user by tracing invite code usage */
  private async findInviter(userId: string): Promise<string | null> {
    const usage = await this.prisma.inviteCodeUsage.findFirst({
      where: { userId },
      include: { inviteCode: { select: { createdBy: true } } },
    });
    if (!usage) return null;
    // Don't reward if the inviter is the same as invitee (admin self-use)
    if (usage.inviteCode.createdBy === userId) return null;
    return usage.inviteCode.createdBy;
  }

  /** Get referral dashboard data for a user */
  async getDashboard(userId: string) {
    const [rewards, inviteCodes] = await Promise.all([
      this.prisma.referralReward.findMany({
        where: { inviterId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inviteCode.findMany({
        where: { createdBy: userId },
        include: {
          usages: {
            select: { userId: true, usedAt: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const totalCreditsEarned = rewards.reduce((sum, r) => sum + r.creditAmount, 0);
    const totalInvitees = inviteCodes.reduce((sum, c) => sum + c.usages.length, 0);

    return {
      inviteCodes: inviteCodes.map((c) => ({
        code: c.code,
        label: c.label,
        maxUses: c.maxUses,
        usedCount: c.usedCount,
        isActive: c.isActive,
        usages: c.usages,
      })),
      rewards: rewards.map((r) => ({
        triggerEvent: r.triggerEvent,
        creditAmount: r.creditAmount,
        createdAt: r.createdAt,
      })),
      totalCreditsEarned,
      totalInvitees,
    };
  }
}

import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';

export class InsufficientCreditsException extends ForbiddenException {
  constructor(required: number, available: number) {
    super({
      message: `クレジットが不足しています（必要: ${required}cr、残高: ${available}cr）`,
      required,
      available,
      code: 'INSUFFICIENT_CREDITS',
    });
  }
}

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(private prisma: PrismaService) {}

  /** Ensure a CreditBalance record exists for the user */
  async ensureCreditBalance(userId: string) {
    return this.prisma.creditBalance.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        balance: 20,
        monthlyBalance: 20,
        rewardBalance: 0,
        purchasedBalance: 0,
        monthlyGranted: 20,
        lastGrantedAt: new Date(),
      },
    });
  }

  /** Get the user's credit balance */
  async getBalance(userId: string) {
    const bal = await this.ensureCreditBalance(userId);
    return {
      total: bal.balance,
      monthly: bal.monthlyBalance,
      reward: bal.rewardBalance,
      purchased: bal.purchasedBalance,
    };
  }

  /**
   * Consume credits with PENDING status (two-phase commit).
   * Consumption order: monthly → reward → purchased.
   * Only purchasedDeducted counts toward author revenue.
   */
  async consumeCredits(
    userId: string,
    amount: number,
    feature: string,
    model?: string,
  ): Promise<{ transactionId: string; newBalance: number; purchasedDeducted: number }> {
    return this.prisma.$transaction(async (tx) => {
      // Lock the row for update
      await tx.$queryRawUnsafe(
        'SELECT * FROM "CreditBalance" WHERE "userId" = $1 FOR UPDATE',
        userId,
      );

      const bal = await tx.creditBalance.findUnique({ where: { userId } });
      if (!bal) {
        throw new InsufficientCreditsException(amount, 0);
      }
      if (bal.balance < amount) {
        throw new InsufficientCreditsException(amount, bal.balance);
      }

      // Consume order: monthly → reward → purchased
      const monthlyDeduct = Math.min(bal.monthlyBalance, amount);
      const remaining = amount - monthlyDeduct;
      const rewardDeduct = Math.min(bal.rewardBalance, remaining);
      const purchasedDeduct = remaining - rewardDeduct;

      await tx.creditBalance.update({
        where: { userId },
        data: {
          balance: { decrement: amount },
          monthlyBalance: { decrement: monthlyDeduct },
          rewardBalance: { decrement: rewardDeduct },
          purchasedBalance: { decrement: purchasedDeduct },
        },
      });

      const txRecord = await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          type: 'CONSUME',
          status: 'pending',
          balance: bal.balance - amount,
          relatedFeature: feature,
          relatedModel: model || null,
        },
      });

      return { transactionId: txRecord.id, newBalance: bal.balance - amount, purchasedDeducted: purchasedDeduct };
    });
  }

  /** Confirm a pending transaction (AI call succeeded) */
  async confirmTransaction(transactionId: string): Promise<void> {
    await this.prisma.creditTransaction
      .update({
        where: { id: transactionId },
        data: { status: 'confirmed' },
      })
      .catch((e) =>
        this.logger.error(`Failed to confirm transaction ${transactionId}`, e),
      );
  }

  /** Refund a pending transaction (AI call failed, no content delivered) */
  async refundTransaction(transactionId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (prisma) => {
        // Re-read the transaction under lock to avoid TOCTOU race
        const tx = await prisma.creditTransaction.findUnique({
          where: { id: transactionId },
        });
        if (!tx || tx.status !== 'pending') return;

        const refundAmount = Math.abs(tx.amount);

        // Lock the balance row
        await prisma.$queryRawUnsafe(
          'SELECT * FROM "CreditBalance" WHERE "userId" = $1 FOR UPDATE',
          tx.userId,
        );

        const bal = await prisma.creditBalance.findUnique({
          where: { userId: tx.userId },
        });
        if (!bal) return;

        // Restore order: monthly (up to cap) → purchased (remaining)
        // Reward credits are not restored on refund (conservative: small amounts, rare event)
        const monthlyRestore = Math.max(0, Math.min(
          refundAmount,
          bal.monthlyGranted - bal.monthlyBalance,
        ));
        const purchasedRestore = refundAmount - monthlyRestore;

        await prisma.creditBalance.update({
          where: { userId: tx.userId },
          data: {
            balance: { increment: refundAmount },
            monthlyBalance: { increment: monthlyRestore },
            purchasedBalance: { increment: purchasedRestore },
          },
        });

        await prisma.creditTransaction.update({
          where: { id: transactionId },
          data: { status: 'refunded' },
        });

        // Log refund transaction
        await prisma.creditTransaction.create({
          data: {
            userId: tx.userId,
            amount: refundAmount,
            type: 'REFUND',
            status: 'confirmed',
            balance: bal.balance + refundAmount,
            relatedFeature: tx.relatedFeature,
            relatedModel: tx.relatedModel,
            description: `Refund for failed ${tx.relatedFeature || 'AI'} call`,
          },
        });
      });
    } catch (e) {
      this.logger.error(`Failed to refund transaction ${transactionId}`, e);
    }
  }

  /**
   * Auto-refund stale pending transactions (older than 10 minutes).
   * Called periodically to clean up transactions left behind by crashes/timeouts.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refundStalePendingTransactions(): Promise<number> {
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
    const staleTxns = await this.prisma.creditTransaction.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: staleThreshold },
      },
      select: { id: true },
    });

    if (staleTxns.length === 0) return 0;

    this.logger.warn(`Found ${staleTxns.length} stale pending transactions, refunding...`);
    let refunded = 0;
    for (const tx of staleTxns) {
      try {
        await this.refundTransaction(tx.id);
        refunded++;
      } catch (e) {
        this.logger.error(`Failed to auto-refund stale transaction ${tx.id}`, e);
      }
    }
    this.logger.log(`Auto-refunded ${refunded}/${staleTxns.length} stale pending transactions`);
    return refunded;
  }

  /**
   * Grant monthly credits: expire old monthly balance, then grant new.
   * rewardBalance and purchasedBalance are preserved.
   * @param stripeInvoiceId Optional Stripe invoice ID for idempotency tracking
   */
  async grantMonthlyCredits(
    userId: string,
    amount: number,
    planType: string,
    stripeInvoiceId?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT * FROM "CreditBalance" WHERE "userId" = $1 FOR UPDATE',
        userId,
      );

      const bal = await this.ensureCreditBalanceInTx(tx, userId);

      // Expire remaining monthly balance
      const expired = bal.monthlyBalance;
      if (expired > 0) {
        await tx.creditTransaction.create({
          data: {
            userId,
            amount: -expired,
            type: 'EXPIRE',
            status: 'confirmed',
            balance: bal.balance - expired,
            description: `Monthly credits expired (${planType})`,
          },
        });
      }

      // Grant new monthly credits (preserve reward + purchased)
      const newBalance = bal.balance - expired + amount;
      await tx.creditBalance.update({
        where: { userId },
        data: {
          balance: newBalance,
          monthlyBalance: amount,
          // rewardBalance: unchanged
          purchasedBalance: bal.purchasedBalance,
          monthlyGranted: amount,
          lastGrantedAt: new Date(),
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          type: 'MONTHLY_GRANT',
          status: 'confirmed',
          balance: newBalance,
          stripePaymentId: stripeInvoiceId || null,
          description: `Monthly grant (${planType}: ${amount}cr)`,
        },
      });
    });
  }

  /** Add purchased credits (no expiration) */
  async addPurchasedCredits(
    userId: string,
    amount: number,
    stripePaymentId: string,
    priceJpy: number,
  ): Promise<void> {
    this.logger.log(`addPurchasedCredits: userId=${userId}, amount=${amount}, stripePaymentId=${stripePaymentId}`);

    // Idempotency check
    const existing = await this.prisma.creditPurchase.findUnique({
      where: { stripePaymentIntentId: stripePaymentId },
    });
    if (existing) {
      this.logger.log(`addPurchasedCredits: duplicate purchase detected, skipping (stripePaymentId=${stripePaymentId})`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT * FROM "CreditBalance" WHERE "userId" = $1 FOR UPDATE',
        userId,
      );

      const bal = await this.ensureCreditBalanceInTx(tx, userId);

      await tx.creditBalance.update({
        where: { userId },
        data: {
          balance: { increment: amount },
          purchasedBalance: { increment: amount },
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          type: 'PURCHASE',
          status: 'confirmed',
          balance: bal.balance + amount,
          stripePaymentId,
          description: `Purchased ${amount}cr (¥${priceJpy})`,
        },
      });

      await tx.creditPurchase.create({
        data: {
          userId,
          amount,
          priceJpy,
          stripePaymentIntentId: stripePaymentId,
          status: 'completed',
        },
      });
    });

    this.logger.log(`addPurchasedCredits: SUCCESS — ${amount}cr added to user ${userId}`);
  }

  /**
   * Grant reward credits (rewardBalance — 30日失効, 作家還元対象外).
   * Enforces per-category monthly count limits to prevent abuse.
   * @param monthlyCountLimit Max times this reward category can be earned per month
   * @param descriptionPrefix Prefix to match for counting (e.g. "レビュー報酬", "読了報酬")
   * Returns true if granted, false if capped or duplicate.
   */
  async grantRewardCredits(
    userId: string,
    amount: number,
    type: 'REVIEW_REWARD' | 'REFERRAL_REWARD',
    description: string,
    monthlyCountLimit: number,
    descriptionPrefix: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // Lock the balance row
      await tx.$queryRawUnsafe(
        'SELECT * FROM "CreditBalance" WHERE "userId" = $1 FOR UPDATE',
        userId,
      );

      // Duplicate check
      const existing = await tx.creditTransaction.findFirst({
        where: { userId, type, description },
      });
      if (existing) return false;

      // Monthly count limit per reward category
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthlyCount = await tx.creditTransaction.count({
        where: {
          userId,
          type,
          status: 'confirmed',
          description: { startsWith: descriptionPrefix },
          createdAt: { gte: monthStart },
        },
      });

      if (monthlyCount >= monthlyCountLimit) {
        this.logger.log(`Monthly ${descriptionPrefix} limit reached for user ${userId} (${monthlyCount}/${monthlyCountLimit})`);
        return false;
      }

      // Extend reward expiry to 30 days from now
      const rewardExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const bal = await tx.creditBalance.update({
        where: { userId },
        data: {
          balance: { increment: amount },
          rewardBalance: { increment: amount },
          rewardExpiresAt,
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          type,
          status: 'confirmed',
          balance: bal.balance,
          description,
        },
      });

      return true;
    });
  }

  /**
   * Expire reward credits that have passed their 30-day expiry.
   * Runs daily at 01:00.
   */
  @Cron('0 1 * * *')
  async expireRewardCredits(): Promise<number> {
    const now = new Date();
    const expiredBalances = await this.prisma.creditBalance.findMany({
      where: {
        rewardBalance: { gt: 0 },
        rewardExpiresAt: { lt: now },
      },
      select: { userId: true, balance: true, rewardBalance: true },
    });

    if (expiredBalances.length === 0) return 0;

    this.logger.log(`Expiring reward credits for ${expiredBalances.length} users`);
    let count = 0;
    for (const bal of expiredBalances) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.$queryRawUnsafe(
            'SELECT * FROM "CreditBalance" WHERE "userId" = $1 FOR UPDATE',
            bal.userId,
          );

          // Re-read under lock
          const current = await tx.creditBalance.findUnique({ where: { userId: bal.userId } });
          if (!current || current.rewardBalance <= 0) return;
          if (current.rewardExpiresAt && current.rewardExpiresAt >= now) return;

          const expireAmount = current.rewardBalance;

          await tx.creditBalance.update({
            where: { userId: bal.userId },
            data: {
              balance: { decrement: expireAmount },
              rewardBalance: 0,
              rewardExpiresAt: null,
            },
          });

          await tx.creditTransaction.create({
            data: {
              userId: bal.userId,
              amount: -expireAmount,
              type: 'EXPIRE',
              status: 'confirmed',
              balance: current.balance - expireAmount,
              description: `報酬クレジット失効 (${expireAmount}cr, 30日経過)`,
            },
          });
        });
        count++;
      } catch (e) {
        this.logger.error(`Failed to expire reward credits for user ${bal.userId}`, e);
      }
    }
    this.logger.log(`Expired reward credits for ${count}/${expiredBalances.length} users`);
    return count;
  }

  /** Get transaction history with pagination */
  async getTransactionHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.creditTransaction.count({ where: { userId } }),
    ]);
    return { data, total };
  }

  /** Helper: ensure balance exists within a transaction */
  private async ensureCreditBalanceInTx(tx: any, userId: string) {
    let bal = await tx.creditBalance.findUnique({ where: { userId } });
    if (!bal) {
      bal = await tx.creditBalance.create({
        data: {
          userId,
          balance: 0,
          monthlyBalance: 0,
          rewardBalance: 0,
          purchasedBalance: 0,
          monthlyGranted: 0,
        },
      });
    }
    return bal;
  }
}

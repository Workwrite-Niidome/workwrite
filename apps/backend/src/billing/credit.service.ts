import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
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
      purchased: bal.purchasedBalance,
    };
  }

  /**
   * Consume credits with PENDING status (two-phase commit).
   * Uses SELECT FOR UPDATE to prevent race conditions.
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

      // Consume monthly first, then purchased
      const monthlyDeduct = Math.min(bal.monthlyBalance, amount);
      const purchasedDeduct = amount - monthlyDeduct;

      await tx.creditBalance.update({
        where: { userId },
        data: {
          balance: { decrement: amount },
          monthlyBalance: { decrement: monthlyDeduct },
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

        // Restore to monthly up to monthlyGranted cap, clamp to 0 to prevent negative
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
   * Grant monthly credits: expire old monthly balance, then grant new.
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

      // Grant new monthly credits
      const newBalance = bal.balance - expired + amount;
      await tx.creditBalance.update({
        where: { userId },
        data: {
          balance: newBalance,
          monthlyBalance: amount,
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
          purchasedBalance: 0,
          monthlyGranted: 0,
        },
      });
    }
    return bal;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreditService } from './credit.service';
import { NotificationsService } from '../notifications/notifications.service';
import Stripe from 'stripe';

const PLAN_MONTHLY_CREDITS: Record<string, number> = {
  free: 10,
  standard: 200,
  pro: 600,
};

// Credit purchase: Standard pays ¥980 for 100cr, Pro pays ¥880 for 100cr
const CREDIT_PURCHASE_AMOUNT = 100;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private creditService: CreditService,
    private notifications: NotificationsService,
  ) {}

  /** Get billing status for a user */
  async getBillingStatus(userId: string) {
    const [credits, sub] = await Promise.all([
      this.creditService.getBalance(userId),
      this.prisma.subscription.findUnique({ where: { userId } }),
    ]);

    const plan = sub?.status === 'active' ? sub.plan : 'free';

    return {
      plan,
      credits,
      subscription: sub
        ? {
            status: sub.status,
            currentPeriodEnd: sub.currentPeriodEnd,
            currentPeriodStart: sub.currentPeriodStart,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            trialEnd: sub.trialEnd,
          }
        : null,
    };
  }

  /** Handle invoice.paid webhook — grant monthly credits (idempotent via invoice ID) */
  async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;
    if (!customerId) return;

    // Idempotency: check if we already processed this invoice
    const invoiceId = invoice.id;
    const existing = await this.prisma.creditTransaction.findFirst({
      where: { stripePaymentId: invoiceId, type: 'MONTHLY_GRANT' },
    });
    if (existing) {
      this.logger.log(`Invoice ${invoiceId} already processed, skipping`);
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (!user) {
      this.logger.warn(`No user found for Stripe customer ${customerId}`);
      return;
    }

    const sub = await this.prisma.subscription.findUnique({
      where: { userId: user.id },
    });
    if (!sub || sub.status !== 'active') return;

    const credits = PLAN_MONTHLY_CREDITS[sub.plan] || 0;
    if (credits > 0) {
      await this.creditService.grantMonthlyCredits(user.id, credits, sub.plan, invoiceId);
      this.logger.log(
        `Granted ${credits}cr to user ${user.id} (plan: ${sub.plan}, invoice: ${invoiceId})`,
      );
    }
  }

  /** Handle checkout.session.completed */
  async handleCheckoutComplete(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) return;

    // Credit purchase
    if (session.metadata?.type === 'credit_purchase') {
      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;
      if (paymentIntentId) {
        const creditAmount = session.metadata?.creditAmount
          ? parseInt(session.metadata.creditAmount, 10)
          : CREDIT_PURCHASE_AMOUNT;
        const priceJpy = session.metadata?.priceJpy
          ? parseInt(session.metadata.priceJpy, 10)
          : 980;
        await this.creditService.addPurchasedCredits(
          userId,
          creditAmount,
          paymentIntentId,
          priceJpy,
        );
      }
      return;
    }

    // Letter checkout
    if (session.metadata?.type === 'letter') {
      await this.handleLetterCheckoutComplete(session);
      return;
    }

    // Subscription checkout
    const plan = session.metadata?.plan;
    if (!plan) return;

    const subId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        plan,
        status: 'active',
        stripeSubId: subId || null,
      },
      create: {
        userId,
        plan,
        status: 'active',
        stripeSubId: subId || null,
      },
    });

    // Note: credits are granted via invoice.paid webhook (not here)
    // to avoid double-granting on initial subscription
  }

  /** Handle customer.subscription.updated */
  async handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
    const userId = sub.metadata?.userId;
    if (!userId) return;

    const plan = sub.metadata?.plan || 'standard';
    const subAny = sub as any;
    const periodEnd = subAny.current_period_end ?? subAny.currentPeriodEnd;
    const periodStart = subAny.current_period_start ?? subAny.currentPeriodStart;
    const cancelAtEnd = subAny.cancel_at_period_end ?? subAny.cancelAtPeriodEnd ?? false;
    const trialEnd = subAny.trial_end ?? subAny.trialEnd;

    await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        plan,
        status: sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
        cancelAtPeriodEnd: cancelAtEnd,
        trialEnd: trialEnd ? new Date(trialEnd * 1000) : null,
      },
      create: {
        userId,
        plan,
        status: 'active',
        stripeSubId: sub.id,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
        cancelAtPeriodEnd: cancelAtEnd,
        trialEnd: trialEnd ? new Date(trialEnd * 1000) : null,
      },
    });
  }

  /** Handle customer.subscription.deleted */
  async handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    const userId = sub.metadata?.userId;
    if (!userId) return;

    await this.prisma.subscription.updateMany({
      where: { stripeSubId: sub.id },
      data: { status: 'canceled' },
    });

    // Grant free tier credits
    await this.creditService.grantMonthlyCredits(
      userId,
      PLAN_MONTHLY_CREDITS.free,
      'free',
    );
  }

  /** Handle letter checkout completion — create Payment + Letter from PendingLetter */
  private async handleLetterCheckoutComplete(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const pendingLetterId = session.metadata?.pendingLetterId;
    if (!pendingLetterId) {
      this.logger.warn('Letter checkout missing pendingLetterId in metadata');
      return;
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    // Idempotency: check if Letter already created for this payment
    if (paymentIntentId) {
      const existingPayment = await this.prisma.payment.findUnique({
        where: { stripePaymentId: paymentIntentId },
      });
      if (existingPayment) {
        this.logger.log(`Letter payment ${paymentIntentId} already processed, skipping`);
        return;
      }
    }

    const pending = await this.prisma.pendingLetter.findUnique({
      where: { id: pendingLetterId },
    });

    if (pending) {
      // Normal path: PendingLetter exists → create Payment + Letter atomically
      await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            stripePaymentId: paymentIntentId || `checkout_${session.id}`,
            payerId: pending.senderId,
            recipientId: pending.recipientId,
            amount: pending.amount,
            type: 'LETTER',
            status: 'succeeded',
          },
        });

        await tx.letter.create({
          data: {
            senderId: pending.senderId,
            recipientId: pending.recipientId,
            episodeId: pending.episodeId,
            type: pending.type,
            content: pending.content,
            amount: pending.amount,
            isHighlighted: pending.type === 'PREMIUM' || pending.type === 'GIFT',
            paymentId: payment.id,
            moderationStatus: pending.moderationStatus,
            moderationReason: pending.moderationReason,
          },
        });

        await tx.pendingLetter.delete({
          where: { id: pendingLetterId },
        });
      });

      // Notify author (outside transaction — non-critical)
      try {
        const sender = await this.prisma.user.findUnique({
          where: { id: pending.senderId },
          select: { name: true, displayName: true },
        });
        const senderName = sender?.displayName || sender?.name || '匿名';
        await this.notifications.createNotification(pending.recipientId, {
          type: 'letter',
          title: 'レターが届きました',
          body: `${senderName}さんから¥${pending.amount}のレターが届きました`,
          data: { episodeId: pending.episodeId },
        });
      } catch (e: any) {
        this.logger.error(`Failed to notify author about letter: ${e.message}`);
      }

      this.logger.log(`Letter created from PendingLetter ${pendingLetterId} (payment_intent: ${paymentIntentId})`);
    } else {
      // Fallback path: PendingLetter missing (expired/cascade-deleted) but payment succeeded
      // Reconstruct minimal Letter from Stripe session metadata to prevent money loss
      const meta = session.metadata || {};
      const recipientId = meta.recipientId;
      const episodeId = meta.episodeId;
      const letterType = meta.letterType as any;
      const amount = meta.amount ? parseInt(meta.amount, 10) : 0;
      const userId = meta.userId;

      if (!recipientId || !episodeId || !userId) {
        this.logger.error(
          `PendingLetter ${pendingLetterId} missing AND metadata incomplete — cannot create Letter. ` +
          `Payment ${paymentIntentId} succeeded but Letter NOT created. Manual intervention required. ` +
          `metadata: ${JSON.stringify(meta)}`,
        );
        return;
      }

      this.logger.warn(
        `PendingLetter ${pendingLetterId} missing — reconstructing Letter from metadata (payment: ${paymentIntentId})`,
      );

      const payment = await this.prisma.payment.create({
        data: {
          stripePaymentId: paymentIntentId || `checkout_${session.id}`,
          payerId: userId,
          recipientId,
          amount,
          type: 'LETTER',
          status: 'succeeded',
        },
      });

      await this.prisma.letter.create({
        data: {
          senderId: userId,
          recipientId,
          episodeId,
          type: letterType || 'STANDARD',
          content: '（決済完了後にレター内容を復元できませんでした。お問い合わせください。）',
          amount,
          isHighlighted: letterType === 'PREMIUM' || letterType === 'GIFT',
          paymentId: payment.id,
          moderationStatus: 'approved',
        },
      });

      // Notify author
      try {
        await this.notifications.createNotification(recipientId, {
          type: 'letter',
          title: 'レターが届きました',
          body: `¥${amount}のレターが届きました`,
          data: { episodeId },
        });
      } catch (e: any) {
        this.logger.error(`Failed to notify author about fallback letter: ${e.message}`);
      }

      this.logger.warn(`Fallback Letter created for payment ${paymentIntentId} (PendingLetter ${pendingLetterId} was missing)`);
    }
  }

  /** Handle invoice.payment_failed */
  async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;
    if (!customerId) return;

    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (!user) return;

    await this.prisma.subscription.updateMany({
      where: { userId: user.id },
      data: { status: 'past_due' },
    });
  }
}

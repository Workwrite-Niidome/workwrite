import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreditService } from './credit.service';
import { StripeService } from './stripe.service';
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
    private stripeService: StripeService,
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
      // Create Payment + Letter atomically. Payout handled by daily scheduler.
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
            payoutStatus: 'pending',
            moderationStatus: 'approved',
          },
        });

        await tx.pendingLetter.delete({
          where: { id: pendingLetterId },
        });
      });

      // Notify author
      try {
        const sender = await this.prisma.user.findUnique({
          where: { id: pending.senderId },
          select: { name: true, displayName: true },
        });
        const senderName = sender?.displayName || sender?.name || '匿名';
        const notifyBody = `${senderName}さんから¥${pending.amount}のギフトレターが届きました。収益は毎朝自動で送金されます。`;
        await this.notifications.createNotification(pending.recipientId, {
          type: 'letter',
          title: 'ギフトレターが届きました',
          body: notifyBody,
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
          content: '（決済完了後にギフトレター内容を復元できませんでした。お問い合わせください。）',
          amount,
          isHighlighted: letterType === 'PREMIUM' || letterType === 'GIFT',
          paymentId: payment.id,
          payoutStatus: 'pending',
          moderationStatus: 'approved',
        },
      });

      // Notify author
      try {
        await this.notifications.createNotification(recipientId, {
          type: 'letter',
          title: 'ギフトレターが届きました',
          body: `¥${amount}のギフトレターが届きました`,
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

  /**
   * Transfer pending letter payouts to an author who just completed Stripe Connect setup.
   * Called when an author's Connect account becomes active.
   */
  async transferPendingLetterPayouts(authorId: string): Promise<{ transferred: number; totalAmount: number }> {
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { stripeAccountId: true },
    });
    if (!author?.stripeAccountId) return { transferred: 0, totalAmount: 0 };

    const pendingLetters = await this.prisma.letter.findMany({
      where: { recipientId: authorId, payoutStatus: 'pending', moderationStatus: 'approved' },
    });

    if (pendingLetters.length === 0) return { transferred: 0, totalAmount: 0 };

    let transferred = 0;
    let totalAmount = 0;

    for (const letter of pendingLetters) {
      try {
        const authorAmount = Math.floor(letter.amount * 0.8);
        const { transferId } = await this.stripeService.createTransfer(
          authorAmount,
          author.stripeAccountId,
          { type: 'letter_payout', letterId: letter.id, recipientId: authorId },
          `letter_payout_v3_${letter.id}`,
        );

        await this.prisma.letter.update({
          where: { id: letter.id },
          data: { payoutStatus: 'transferred', payoutTransferId: transferId },
        });

        transferred++;
        totalAmount += authorAmount;
      } catch (e: any) {
        this.logger.error(`Failed to transfer letter payout ${letter.id}: ${e.message}`);
      }
    }

    if (transferred > 0) {
      this.logger.log(`Transferred ${transferred} pending letter payouts (¥${totalAmount}) to author ${authorId}`);
    }

    return { transferred, totalAmount };
  }
}

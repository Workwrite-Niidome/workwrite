import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreditService } from './credit.service';
import Stripe from 'stripe';

const PLAN_MONTHLY_CREDITS: Record<string, number> = {
  free: 20,
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

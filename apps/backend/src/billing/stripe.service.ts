import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import Stripe from 'stripe';

interface PlanConfig {
  priceId: string;
  credits: number;
}

interface CreditPurchaseConfig {
  priceId: string;
  amount: number;
  priceJpy: number;
}

@Injectable()
export class StripeService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(StripeService.name);

  private planPrices: Record<string, PlanConfig> = {
    standard: { priceId: '', credits: 200 },
    pro: { priceId: '', credits: 600 },
  };

  private creditPurchasePrices: Record<string, CreditPurchaseConfig> = {
    standard: { priceId: '', amount: 100, priceJpy: 980 },
    pro: { priceId: '', amount: 100, priceJpy: 880 },
    free_500: { priceId: '', amount: 20, priceJpy: 500 },
    free_1000: { priceId: '', amount: 40, priceJpy: 1000 },
  };

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' as any });

      // Load price IDs from env
      const stdPrice = this.config.get<string>('STRIPE_STANDARD_PRICE_ID');
      const proPrice = this.config.get<string>('STRIPE_PRO_PRICE_ID');
      if (stdPrice) this.planPrices.standard.priceId = stdPrice;
      if (proPrice) this.planPrices.pro.priceId = proPrice;

      // Credit purchase prices (per plan)
      const creditStd = this.config.get<string>('STRIPE_CREDIT_PURCHASE_STANDARD_PRICE_ID');
      const creditPro = this.config.get<string>('STRIPE_CREDIT_PURCHASE_PRO_PRICE_ID');
      const creditFree500 = this.config.get<string>('STRIPE_CREDIT_PURCHASE_FREE_500_PRICE_ID');
      const creditFree1000 = this.config.get<string>('STRIPE_CREDIT_PURCHASE_FREE_1000_PRICE_ID');
      if (creditStd) this.creditPurchasePrices.standard.priceId = creditStd;
      if (creditPro) this.creditPurchasePrices.pro.priceId = creditPro;
      if (creditFree500) this.creditPurchasePrices.free_500.priceId = creditFree500;
      if (creditFree1000) this.creditPurchasePrices.free_1000.priceId = creditFree1000;
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set — Stripe features disabled');
    }
  }

  private ensureStripe(): Stripe {
    if (!this.stripe) throw new BadRequestException('Stripe決済は現在利用できません');
    return this.stripe;
  }

  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    const stripe = this.ensureStripe();

    // Validate existing customer still exists in Stripe (handles test→live migration)
    if (user?.stripeCustomerId) {
      try {
        await stripe.customers.retrieve(user.stripeCustomerId);
        return user.stripeCustomerId;
      } catch {
        this.logger.warn(`Stripe customer ${user.stripeCustomerId} not found, creating new one for user ${userId}`);
      }
    }

    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  async createCheckoutSession(
    userId: string,
    email: string,
    plan: 'standard' | 'pro',
  ): Promise<{ url: string }> {
    const stripe = this.ensureStripe();
    const customerId = await this.getOrCreateCustomer(userId, email);
    const planConfig = this.planPrices[plan];
    if (!planConfig?.priceId) {
      throw new BadRequestException(`${plan}プランの価格が設定されていません。管理者にお問い合わせください。`);
    }

    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'https://workwrite.jp';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId, plan },
      },
      success_url: `${baseUrl}/settings/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/settings/billing/cancel`,
      metadata: { userId, plan },
    });

    return { url: session.url! };
  }

  async createCreditPurchaseSession(
    userId: string,
    email: string,
    tier?: 'free_500' | 'free_1000',
  ): Promise<{ url: string }> {
    const stripe = this.ensureStripe();
    const customerId = await this.getOrCreateCustomer(userId, email);

    // Determine price based on user's current plan and requested tier
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    const isSubscribed = sub?.status === 'active';
    let purchaseKey: string;
    if (tier && !isSubscribed) {
      // Free user selecting a specific tier
      purchaseKey = tier;
    } else if (isSubscribed) {
      purchaseKey = sub!.plan;
    } else {
      // Free user without tier specified — default to free_1000
      purchaseKey = 'free_1000';
    }
    const purchaseConfig = this.creditPurchasePrices[purchaseKey] || this.creditPurchasePrices.free_1000;

    if (!purchaseConfig.priceId) {
      throw new BadRequestException('クレジット追加購入の価格が設定されていません。管理者にお問い合わせください。');
    }

    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'https://workwrite.jp';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: purchaseConfig.priceId, quantity: 1 }],
      success_url: `${baseUrl}/settings/billing/success?session_id={CHECKOUT_SESSION_ID}&type=credits`,
      cancel_url: `${baseUrl}/settings/billing/cancel`,
      metadata: {
        userId,
        type: 'credit_purchase',
        creditAmount: String(purchaseConfig.amount),
        priceJpy: String(purchaseConfig.priceJpy),
      },
    });

    return { url: session.url! };
  }

  async createLetterCheckoutSession(
    userId: string,
    email: string,
    pendingLetterId: string,
    amount: number,
    letterContext: { recipientId: string; episodeId: string; letterType: string },
  ): Promise<{ url: string; sessionId: string }> {
    const stripe = this.ensureStripe();
    const customerId = await this.getOrCreateCustomer(userId, email);
    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'https://workwrite.jp';

    // Platform receives payment. Transfer to author happens separately
    // when author has Stripe Connect set up.
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: { name: 'レター（ファンレター）' },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        metadata: { type: 'letter_tip', pendingLetterId },
      },
      success_url: `${baseUrl}/read/letter-sent?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/read/letter-cancelled`,
      metadata: {
        userId,
        type: 'letter',
        pendingLetterId,
        amount: String(amount),
        recipientId: letterContext.recipientId,
        episodeId: letterContext.episodeId,
        letterType: letterContext.letterType,
      },
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });

    return { url: session.url!, sessionId: session.id };
  }

  async createPortalSession(userId: string): Promise<{ url: string }> {
    const stripe = this.ensureStripe();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      throw new BadRequestException('Stripeカスタマー情報が見つかりません');
    }

    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'https://workwrite.jp';
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/settings/billing`,
    });

    return { url: session.url };
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const stripe = this.ensureStripe();
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not set');
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  // ─── Stripe Connect ──────────────────────────────

  /**
   * Create a Stripe Connect Express account for an author.
   * Returns the account ID.
   */
  async createConnectAccount(userId: string, email: string): Promise<string> {
    const stripe = this.ensureStripe();

    // Check if user already has a Connect account
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeAccountId: true },
    });

    if (user?.stripeAccountId) {
      // Verify the account still exists in Stripe
      try {
        await stripe.accounts.retrieve(user.stripeAccountId);
        return user.stripeAccountId;
      } catch {
        this.logger.warn(`Connect account ${user.stripeAccountId} not found in Stripe, creating new one`);
      }
    }

    try {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'JP',
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: { userId },
      });

      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeAccountId: account.id },
      });

      this.logger.log(`Created Connect account ${account.id} for user ${userId}`);
      return account.id;
    } catch (err: any) {
      const stripeCode = err?.code || err?.type || 'unknown';
      const stripeMsg = err?.raw?.message || err?.message || 'unknown error';
      this.logger.error(`Failed to create Connect account for user ${userId}: [${stripeCode}] ${stripeMsg}`);
      throw new BadRequestException(
        `Stripe Connectアカウントの作成に失敗しました（${stripeCode}）。しばらくしてからお試しください。`,
      );
    }
  }

  /**
   * Generate an onboarding link for a Connect Express account.
   */
  async createConnectOnboardingLink(userId: string, email: string): Promise<{ url: string }> {
    const stripe = this.ensureStripe();
    const accountId = await this.createConnectAccount(userId, email);
    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'https://workwrite.jp';

    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${baseUrl}/dashboard/earnings?connect=refresh`,
        return_url: `${baseUrl}/dashboard/earnings?connect=complete`,
        type: 'account_onboarding',
      });

      return { url: accountLink.url };
    } catch (err: any) {
      this.logger.error(`Failed to create onboarding link for account ${accountId}: ${err.message}`);
      throw new BadRequestException(
        'オンボーディングリンクの生成に失敗しました。しばらくしてからお試しください。',
      );
    }
  }

  /**
   * Generate a login link for a Connect Express account dashboard.
   */
  async createConnectLoginLink(userId: string): Promise<{ url: string }> {
    const stripe = this.ensureStripe();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeAccountId: true },
    });

    if (!user?.stripeAccountId) {
      throw new BadRequestException('Stripe Connectアカウントが設定されていません');
    }

    const loginLink = await stripe.accounts.createLoginLink(user.stripeAccountId);
    return { url: loginLink.url };
  }

  /**
   * Get Connect account status.
   */
  async getConnectStatus(userId: string): Promise<{
    hasAccount: boolean;
    accountId: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeAccountId: true },
    });

    if (!user?.stripeAccountId) {
      return { hasAccount: false, accountId: null, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false };
    }

    if (!this.stripe) {
      return { hasAccount: true, accountId: user.stripeAccountId, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false };
    }

    try {
      const account = await this.stripe.accounts.retrieve(user.stripeAccountId);
      return {
        hasAccount: true,
        accountId: user.stripeAccountId,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        detailsSubmitted: account.details_submitted ?? false,
      };
    } catch {
      return { hasAccount: true, accountId: user.stripeAccountId, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false };
    }
  }

  /**
   * Create a PaymentIntent with Connect destination charge.
   * @param applicationFeeRate — decimal fraction (0.2 = 20%)
   * @param idempotencyKey — unique key to prevent duplicate charges
   */
  async createConnectPaymentIntent(
    customerId: string,
    recipientAccountId: string,
    amount: number,
    applicationFeeRate: number,
    metadata: Record<string, string>,
    idempotencyKey?: string,
  ): Promise<{ clientSecret: string; paymentIntentId: string; status: string }> {
    const stripe = this.ensureStripe();
    const applicationFeeAmount = Math.round(amount * applicationFeeRate);

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount,
        currency: 'jpy',
        customer: customerId,
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: recipientAccountId,
        },
        metadata,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    };
  }

  /**
   * Create a Stripe Transfer from platform to a Connect account.
   * Used for character talk monthly payouts.
   */
  async createTransfer(
    amount: number,
    destinationAccountId: string,
    metadata: Record<string, string>,
    idempotencyKey?: string,
  ): Promise<{ transferId: string }> {
    const stripe = this.ensureStripe();

    const transfer = await stripe.transfers.create(
      {
        amount,
        currency: 'jpy',
        destination: destinationAccountId,
        metadata,
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    return { transferId: transfer.id };
  }

  /**
   * Refund a payment via Stripe.
   * Used for unclaimed letter payouts after the retention period.
   */
  async refundPayment(
    paymentIntentId: string,
    metadata?: Record<string, string>,
  ): Promise<{ refundId: string }> {
    const stripe = this.ensureStripe();
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      metadata,
    });
    return { refundId: refund.id };
  }
}

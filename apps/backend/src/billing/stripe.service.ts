import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import Stripe from 'stripe';

const PLAN_PRICES: Record<string, { priceId: string; credits: number }> = {
  standard: { priceId: '', credits: 200 },
  pro: { priceId: '', credits: 600 },
};

const CREDIT_PURCHASE_PRICE_ID = ''; // Set via env

@Injectable()
export class StripeService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(StripeService.name);

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
      const creditPrice = this.config.get<string>('STRIPE_CREDIT_PURCHASE_PRICE_ID');
      if (stdPrice) PLAN_PRICES.standard.priceId = stdPrice;
      if (proPrice) PLAN_PRICES.pro.priceId = proPrice;
      if (creditPrice) {
        // Update module-level const via Object reference is not ideal but safe here
        (this as any).creditPurchasePriceId = creditPrice;
      }
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set — Stripe features disabled');
    }
  }

  private ensureStripe(): Stripe {
    if (!this.stripe) throw new Error('Stripe is not configured');
    return this.stripe;
  }

  async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (user?.stripeCustomerId) return user.stripeCustomerId;

    const stripe = this.ensureStripe();
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
    const planConfig = PLAN_PRICES[plan];
    if (!planConfig?.priceId) throw new Error(`Price not configured for plan: ${plan}`);

    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';

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
  ): Promise<{ url: string }> {
    const stripe = this.ensureStripe();
    const customerId = await this.getOrCreateCustomer(userId, email);
    const priceId = (this as any).creditPurchasePriceId || this.config.get<string>('STRIPE_CREDIT_PURCHASE_PRICE_ID');
    if (!priceId) throw new Error('Credit purchase price not configured');

    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/settings/billing/success?session_id={CHECKOUT_SESSION_ID}&type=credits`,
      cancel_url: `${baseUrl}/settings/billing/cancel`,
      metadata: { userId, type: 'credit_purchase' },
    });

    return { url: session.url! };
  }

  async createPortalSession(userId: string): Promise<{ url: string }> {
    const stripe = this.ensureStripe();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) throw new Error('No Stripe customer found');

    const baseUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
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
}

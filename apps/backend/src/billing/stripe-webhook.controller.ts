import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StripeService } from './stripe.service';
import { BillingService } from './billing.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import Stripe from 'stripe';

// ─── Webhook event deduplication (in-memory, 24h TTL) ────────────────────────
const processedEvents = new Map<string, number>();
const EVENT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Clean up expired entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of processedEvents) {
    if (now - ts > EVENT_TTL_MS) processedEvents.delete(id);
  }
}, 60 * 60 * 1000);

@Controller('billing')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private stripeService: StripeService,
    private billingService: BillingService,
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  @Post('webhook')
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    let event: Stripe.Event;

    try {
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        this.logger.error('No raw body available for webhook verification — check main.ts middleware');
        return res.status(400).json({ error: 'No raw body' });
      }
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    this.logger.log(`Webhook received: ${event.type} (id: ${event.id})`);

    // Deduplication: reject replayed events
    if (processedEvents.has(event.id)) {
      this.logger.warn(`Duplicate webhook event ignored: ${event.id}`);
      return res.status(200).json({ received: true, duplicate: true });
    }

    try {
      switch (event.type) {
        case 'invoice.paid':
          await this.billingService.handleInvoicePaid(
            event.data.object as Stripe.Invoice,
          );
          break;
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          this.logger.log(`Checkout completed: userId=${session.metadata?.userId}, type=${session.metadata?.type}, paymentIntent=${session.payment_intent}`);
          await this.billingService.handleCheckoutComplete(session);
          break;
        }
        case 'customer.subscription.updated':
          await this.billingService.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription,
          );
          break;
        case 'customer.subscription.deleted':
          await this.billingService.handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
          );
          break;
        case 'invoice.payment_failed':
          await this.billingService.handlePaymentFailed(
            event.data.object as Stripe.Invoice,
          );
          break;
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(
            event.data.object as Stripe.PaymentIntent,
          );
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(
            event.data.object as Stripe.PaymentIntent,
          );
          break;
        case 'account.updated':
          await this.handleAccountUpdated(
            event.data.object as Stripe.Account,
          );
          break;
        default:
          this.logger.debug(`Unhandled event type: ${event.type}`);
      }

      // Mark as processed only after successful handling
      processedEvents.set(event.id, Date.now());
    } catch (err: any) {
      this.logger.error(`Webhook handler error for ${event.type}: ${err.message}`, err.stack);
      // Return 500 so Stripe retries. Dedup map prevents double-processing on retry.
      return res.status(500).json({ error: err.message });
    }

    return res.status(200).json({ received: true });
  }

  /** Update Payment record when Stripe confirms the charge succeeded */
  private async handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
    if (pi.metadata?.type !== 'letter_tip') return;

    const updated = await this.prisma.payment.updateMany({
      where: { stripePaymentId: pi.id, status: { not: 'succeeded' } },
      data: { status: 'succeeded' },
    });

    if (updated.count > 0) {
      this.logger.log(`Payment confirmed via webhook: ${pi.id}`);
    }
  }

  /** Mark Payment as failed when Stripe reports a payment failure */
  private async handlePaymentIntentFailed(pi: Stripe.PaymentIntent): Promise<void> {
    if (pi.metadata?.type !== 'letter_tip') return;

    const updated = await this.prisma.payment.updateMany({
      where: { stripePaymentId: pi.id },
      data: { status: 'failed' },
    });

    if (updated.count > 0) {
      this.logger.warn(`Payment failed via webhook: ${pi.id}, reason: ${pi.last_payment_error?.message}`);
    }
  }

  /** Persist Connect account status and notify author on approval */
  private async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    this.logger.log(
      `Connect account updated: ${account.id}, charges_enabled=${account.charges_enabled}, payouts_enabled=${account.payouts_enabled}`,
    );

    const user = await this.prisma.user.findFirst({
      where: { stripeAccountId: account.id },
      select: { id: true },
    });
    if (!user) return;

    // Notify author when their Connect account becomes fully active
    if (account.charges_enabled && account.payouts_enabled) {
      try {
        await this.notifications.createNotification(user.id, {
          type: 'system',
          title: 'Stripe Connectの審査が完了しました。レター収益の自動振込が有効になりました。',
        });
      } catch (e: any) {
        this.logger.error(`Failed to notify user ${user.id} about Connect approval: ${e.message}`);
      }
    }
  }
}

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
  ) {}

  @Post('webhook')
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    let event: Stripe.Event;

    try {
      // req.body should be raw buffer — configured in main.ts
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        this.logger.error('No raw body available for webhook verification');
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
    processedEvents.set(event.id, Date.now());

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
        case 'account.updated': {
          const account = event.data.object as Stripe.Account;
          this.logger.log(`Connect account updated: ${account.id}, charges_enabled=${account.charges_enabled}, payouts_enabled=${account.payouts_enabled}`);
          break;
        }
        default:
          this.logger.debug(`Unhandled event type: ${event.type}`);
      }
    } catch (err: any) {
      this.logger.error(`Webhook handler error: ${err.message}`, err.stack);
      // Return 200 to prevent Stripe retries that could cause duplicate processing.
      // The event is already marked as processed in the dedup map.
      return res.status(200).json({ received: true, error: err.message });
    }

    return res.status(200).json({ received: true });
  }
}

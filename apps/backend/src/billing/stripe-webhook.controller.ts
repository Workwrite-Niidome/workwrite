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
import Stripe from 'stripe';

@Controller('billing')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private stripeService: StripeService,
    private billingService: BillingService,
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
        default:
          this.logger.debug(`Unhandled event type: ${event.type}`);
      }
    } catch (err: any) {
      this.logger.error(`Webhook handler error: ${err.message}`, err.stack);
      return res.status(500).json({ error: 'Webhook handler failed' });
    }

    return res.status(200).json({ received: true });
  }
}

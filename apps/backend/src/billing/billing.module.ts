import { Global, Module } from '@nestjs/common';
import { CreditService } from './credit.service';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { CreditGrantScheduler } from './credit-grant.scheduler';

@Global()
@Module({
  controllers: [BillingController, StripeWebhookController],
  providers: [CreditService, BillingService, StripeService, CreditGrantScheduler],
  exports: [CreditService, BillingService, StripeService],
})
export class BillingModule {}

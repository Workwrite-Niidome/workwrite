import { Global, Module } from '@nestjs/common';
import { CreditService } from './credit.service';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { CreditGrantScheduler } from './credit-grant.scheduler';
import { AuthorPayoutService } from './author-payout.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Global()
@Module({
  imports: [NotificationsModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [CreditService, BillingService, StripeService, CreditGrantScheduler, AuthorPayoutService],
  exports: [CreditService, BillingService, StripeService, AuthorPayoutService],
})
export class BillingModule {}

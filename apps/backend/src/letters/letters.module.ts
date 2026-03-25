import { Module } from '@nestjs/common';
import { LettersController } from './letters.controller';
import { LettersService } from './letters.service';
import { LetterModerationService } from './letter-moderation.service';
import { PendingLetterCleanupScheduler } from './pending-letter-cleanup.scheduler';
import { LetterPayoutScheduler } from './letter-payout.scheduler';
import { StampsService } from './stamps/stamps.service';
import { PaymentsModule } from '../payments/payments.module';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PaymentsModule, BillingModule, NotificationsModule],
  controllers: [LettersController],
  providers: [LettersService, LetterModerationService, PendingLetterCleanupScheduler, LetterPayoutScheduler, StampsService],
  exports: [LettersService, StampsService],
})
export class LettersModule {}

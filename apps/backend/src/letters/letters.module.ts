import { Module } from '@nestjs/common';
import { LettersController } from './letters.controller';
import { LettersService } from './letters.service';
import { LetterModerationService } from './letter-moderation.service';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PaymentsModule, NotificationsModule],
  controllers: [LettersController],
  providers: [LettersService, LetterModerationService],
  exports: [LettersService],
})
export class LettersModule {}

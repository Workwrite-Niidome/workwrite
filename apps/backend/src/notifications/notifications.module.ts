import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DigestScheduler } from './digest.scheduler';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, DigestScheduler],
  exports: [NotificationsService],
})
export class NotificationsModule {}

import { Module } from '@nestjs/common';
import { EditorModeController } from './editor-mode.controller';
import { EditorModeService } from './editor-mode.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [EditorModeController],
  providers: [EditorModeService],
  exports: [EditorModeService],
})
export class EditorModeModule {}

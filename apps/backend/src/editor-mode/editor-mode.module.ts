import { Module } from '@nestjs/common';
import { EditorModeController } from './editor-mode.controller';
import { EditorModeService } from './editor-mode.service';

@Module({
  controllers: [EditorModeController],
  providers: [EditorModeService],
  exports: [EditorModeService],
})
export class EditorModeModule {}

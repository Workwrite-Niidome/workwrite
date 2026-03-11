import { Module } from '@nestjs/common';
import { EpisodesController } from './episodes.controller';
import { EpisodesService } from './episodes.service';
import { ScheduledPublishService } from './scheduled-publish.service';
import { CreationWizardModule } from '../creation-wizard/creation-wizard.module';
import { AiAssistModule } from '../ai-assist/ai-assist.module';

@Module({
  imports: [CreationWizardModule, AiAssistModule],
  controllers: [EpisodesController],
  providers: [EpisodesService, ScheduledPublishService],
  exports: [EpisodesService],
})
export class EpisodesModule {}

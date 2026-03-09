import { Module } from '@nestjs/common';
import { EpisodesController } from './episodes.controller';
import { EpisodesService } from './episodes.service';
import { ScheduledPublishService } from './scheduled-publish.service';

@Module({
  controllers: [EpisodesController],
  providers: [EpisodesService, ScheduledPublishService],
  exports: [EpisodesService],
})
export class EpisodesModule {}

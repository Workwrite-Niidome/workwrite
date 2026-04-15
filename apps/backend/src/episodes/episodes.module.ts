import { Module } from '@nestjs/common';
import { EpisodesController } from './episodes.controller';
import { EpisodesService } from './episodes.service';
import { ScheduledPublishService } from './scheduled-publish.service';
import { CreationWizardModule } from '../creation-wizard/creation-wizard.module';
import { AiAssistModule } from '../ai-assist/ai-assist.module';
import { PostsModule } from '../posts/posts.module';
import { ScoringModule } from '../scoring/scoring.module';
import { WorksModule } from '../works/works.module';
import { CharacterTalkModule } from '../character-talk/character-talk.module';
import { WorldFragmentsModule } from '../world-fragments/world-fragments.module';
import { SharedWorldModule } from '../shared-world/shared-world.module';

@Module({
  imports: [CreationWizardModule, AiAssistModule, PostsModule, ScoringModule, WorksModule, CharacterTalkModule, WorldFragmentsModule, SharedWorldModule],
  controllers: [EpisodesController],
  providers: [EpisodesService, ScheduledPublishService],
  exports: [EpisodesService],
})
export class EpisodesModule {}

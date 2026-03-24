import { Module } from '@nestjs/common';
import { WorksController } from './works.controller';
import { WorksService } from './works.service';
import { PostsModule } from '../posts/posts.module';
import { ScoringModule } from '../scoring/scoring.module';
import { EmotionsModule } from '../emotions/emotions.module';
import { AiAssistModule } from '../ai-assist/ai-assist.module';
import { DiscoverModule } from '../discover/discover.module';

@Module({
  imports: [PostsModule, ScoringModule, EmotionsModule, AiAssistModule, DiscoverModule],
  controllers: [WorksController],
  providers: [WorksService],
  exports: [WorksService],
})
export class WorksModule {}

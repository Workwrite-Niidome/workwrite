import { Module } from '@nestjs/common';
import { WorksController } from './works.controller';
import { WorksService } from './works.service';
import { PostsModule } from '../posts/posts.module';
import { ScoringModule } from '../scoring/scoring.module';
import { EmotionsModule } from '../emotions/emotions.module';

@Module({
  imports: [PostsModule, ScoringModule, EmotionsModule],
  controllers: [WorksController],
  providers: [WorksService],
  exports: [WorksService],
})
export class WorksModule {}

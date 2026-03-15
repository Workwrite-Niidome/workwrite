import { Module } from '@nestjs/common';
import { AiRecommendationsController } from './ai-recommendations.controller';
import { AiRecommendationsService } from './ai-recommendations.service';

@Module({
  controllers: [AiRecommendationsController],
  providers: [AiRecommendationsService],
  exports: [AiRecommendationsService],
})
export class AiRecommendationsModule {}

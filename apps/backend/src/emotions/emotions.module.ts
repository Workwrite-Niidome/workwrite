import { Module } from '@nestjs/common';
import { EmotionsController } from './emotions.controller';
import { EmotionsService } from './emotions.service';
import { EmotionMappingService } from './emotion-mapping.service';

@Module({
  controllers: [EmotionsController],
  providers: [EmotionsService, EmotionMappingService],
  exports: [EmotionsService, EmotionMappingService],
})
export class EmotionsModule {}

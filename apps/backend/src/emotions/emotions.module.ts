import { Module } from '@nestjs/common';
import { EmotionsController } from './emotions.controller';
import { EmotionsService } from './emotions.service';
import { EmotionMappingService } from './emotion-mapping.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [EmotionsController],
  providers: [EmotionsService, EmotionMappingService],
  exports: [EmotionsService, EmotionMappingService],
})
export class EmotionsModule {}

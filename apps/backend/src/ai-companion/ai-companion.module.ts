import { Module } from '@nestjs/common';
import { AiCompanionController } from './ai-companion.controller';
import { AiCompanionService } from './ai-companion.service';

@Module({
  controllers: [AiCompanionController],
  providers: [AiCompanionService],
})
export class AiCompanionModule {}

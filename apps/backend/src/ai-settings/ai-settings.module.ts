import { Global, Module } from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service';
import { AiTierService } from './ai-tier.service';
import { AiSettingsController } from './ai-settings.controller';

@Global()
@Module({
  controllers: [AiSettingsController],
  providers: [AiSettingsService, AiTierService],
  exports: [AiSettingsService, AiTierService],
})
export class AiSettingsModule {}

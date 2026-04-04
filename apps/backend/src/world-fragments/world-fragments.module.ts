import { Module } from '@nestjs/common';
import { WorldFragmentsController } from './world-fragments.controller';
import { WorldCanonService } from './services/world-canon.service';
import { FragmentGeneratorService } from './services/fragment-generator.service';
import { EpisodeTextAnalyzerService } from './services/episode-text-analyzer.service';
import { AiSettingsModule } from '../ai-settings/ai-settings.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [AiSettingsModule, BillingModule],
  controllers: [WorldFragmentsController],
  providers: [WorldCanonService, FragmentGeneratorService, EpisodeTextAnalyzerService],
  exports: [WorldCanonService],
})
export class WorldFragmentsModule {}

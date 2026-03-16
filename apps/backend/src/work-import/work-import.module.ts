import { Module } from '@nestjs/common';
import { WorkImportController } from './work-import.controller';
import { WorkImportService } from './work-import.service';
import { NarouScraperService } from './scrapers/narou-scraper.service';
import { KakuyomuScraperService } from './scrapers/kakuyomu-scraper.service';
import { ScoringModule } from '../scoring/scoring.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [ScoringModule, BillingModule],
  controllers: [WorkImportController],
  providers: [WorkImportService, NarouScraperService, KakuyomuScraperService],
})
export class WorkImportModule {}

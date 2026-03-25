import { Module } from '@nestjs/common';
import { WorkImportController } from './work-import.controller';
import { WorkImportService } from './work-import.service';
import { ScoringModule } from '../scoring/scoring.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [ScoringModule, BillingModule],
  controllers: [WorkImportController],
  providers: [WorkImportService],
})
export class WorkImportModule {}

import { Module } from '@nestjs/common';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';
import { TextAnalyzerService } from './text-analyzer.service';
import { SampleExtractorService } from './sample-extractor.service';
import { StructuralDataBuilderService } from './structural-data-builder.service';
import { WorkStructureExtractorService } from './work-structure-extractor.service';

@Module({
  controllers: [ScoringController],
  providers: [
    ScoringService,
    TextAnalyzerService,
    SampleExtractorService,
    StructuralDataBuilderService,
    WorkStructureExtractorService,
  ],
  exports: [ScoringService, WorkStructureExtractorService],
})
export class ScoringModule {}

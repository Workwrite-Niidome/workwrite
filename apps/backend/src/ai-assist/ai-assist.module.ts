import { Module } from '@nestjs/common';
import { AiAssistController } from './ai-assist.controller';
import { AiAssistService } from './ai-assist.service';
import { EpisodeAnalysisService } from './episode-analysis.service';
import { AiContextBuilderService } from './ai-context-builder.service';
import { PromptTemplatesModule } from '../prompt-templates/prompt-templates.module';

@Module({
  imports: [PromptTemplatesModule],
  controllers: [AiAssistController],
  providers: [AiAssistService, EpisodeAnalysisService, AiContextBuilderService],
  exports: [EpisodeAnalysisService, AiContextBuilderService],
})
export class AiAssistModule {}

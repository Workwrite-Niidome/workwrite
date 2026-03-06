import { Module } from '@nestjs/common';
import { AiAssistController } from './ai-assist.controller';
import { AiAssistService } from './ai-assist.service';
import { PromptTemplatesModule } from '../prompt-templates/prompt-templates.module';

@Module({
  imports: [PromptTemplatesModule],
  controllers: [AiAssistController],
  providers: [AiAssistService],
})
export class AiAssistModule {}

import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { PromptTemplatesController } from './prompt-templates.controller';
import { PromptTemplatesService } from './prompt-templates.service';

@Module({
  controllers: [PromptTemplatesController],
  providers: [PromptTemplatesService],
  exports: [PromptTemplatesService],
})
export class PromptTemplatesModule implements OnModuleInit {
  private readonly logger = new Logger(PromptTemplatesModule.name);

  constructor(private templates: PromptTemplatesService) {}

  async onModuleInit() {
    try {
      const result = await this.templates.seedBuiltInTemplates();
      this.logger.log(`Seeded ${result.seeded} built-in prompt templates`);
    } catch (e) {
      this.logger.warn('Failed to seed built-in templates', e);
    }
  }
}

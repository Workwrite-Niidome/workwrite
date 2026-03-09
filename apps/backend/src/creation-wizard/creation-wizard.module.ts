import { Module } from '@nestjs/common';
import { CreationWizardController } from './creation-wizard.controller';
import { CreationWizardService } from './creation-wizard.service';

@Module({
  controllers: [CreationWizardController],
  providers: [CreationWizardService],
  exports: [CreationWizardService],
})
export class CreationWizardModule {}

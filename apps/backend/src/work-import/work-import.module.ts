import { Module } from '@nestjs/common';
import { WorkImportController } from './work-import.controller';
import { WorkImportService } from './work-import.service';

@Module({
  controllers: [WorkImportController],
  providers: [WorkImportService],
})
export class WorkImportModule {}

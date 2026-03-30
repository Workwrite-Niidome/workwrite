import { Module } from '@nestjs/common';
import { WorkExportController } from './work-export.controller';
import { WorkExportService } from './work-export.service';

@Module({
  controllers: [WorkExportController],
  providers: [WorkExportService],
})
export class WorkExportModule {}

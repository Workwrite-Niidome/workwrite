import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WorkImportService } from './work-import.service';
import { AnalyzeTextDto, ImportTextDto } from './dto/work-import.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Work Import')
@Controller('works/import')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkImportController {
  constructor(private importService: WorkImportService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze text for chapter detection' })
  analyzeText(@Body() dto: AnalyzeTextDto) {
    return { data: this.importService.analyzeText(dto) };
  }

  @Post('text')
  @ApiOperation({ summary: 'Import text as work with chapters' })
  async importText(@CurrentUser('id') userId: string, @Body() dto: ImportTextDto) {
    const result = await this.importService.importText(userId, dto);
    return { data: result };
  }

  @Get(':importId/status')
  @ApiOperation({ summary: 'Get import status' })
  async getImportStatus(
    @Param('importId') importId: string,
    @CurrentUser('id') userId: string,
  ) {
    const status = await this.importService.getImportStatus(importId, userId);
    return { data: status };
  }

  @Get()
  @ApiOperation({ summary: 'Get import history' })
  async getHistory(@CurrentUser('id') userId: string) {
    const data = await this.importService.getImportHistory(userId);
    return { data };
  }
}

import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReadingHistoryService } from './reading-history.service';
import { ImportHistoryDto } from './dto/import-history.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Reading History')
@Controller('reading-history')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReadingHistoryController {
  constructor(private readingHistoryService: ReadingHistoryService) {}

  @Post('import')
  @ApiOperation({ summary: 'Import reading history (manual)' })
  importHistory(
    @CurrentUser('id') userId: string,
    @Body() dto: ImportHistoryDto,
  ) {
    return this.readingHistoryService.importHistory(userId, dto);
  }

  @Post('import/csv')
  @ApiOperation({ summary: 'Import reading history from CSV' })
  importCsv(
    @CurrentUser('id') userId: string,
    @Body('csv') csv: string,
  ) {
    return this.readingHistoryService.importCsv(userId, csv);
  }

  @Get()
  @ApiOperation({ summary: 'Get imported reading history' })
  getHistory(@CurrentUser('id') userId: string) {
    return this.readingHistoryService.getHistory(userId);
  }
}

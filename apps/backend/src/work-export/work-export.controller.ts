import { Controller, Get, Param, Query, UseGuards, Res, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkExportService, ExportFormat } from './work-export.service';

@ApiTags('Work Export')
@Controller('works')
export class WorkExportController {
  constructor(private exportService: WorkExportService) {}

  @Get(':workId/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export work as file (txt/epub/html)' })
  @ApiQuery({ name: 'format', enum: ['txt', 'epub', 'html'], required: true })
  @ApiQuery({ name: 'includeDrafts', type: Boolean, required: false })
  async exportWork(
    @Param('workId') workId: string,
    @CurrentUser('id') userId: string,
    @Query('format') format: string,
    @Query('includeDrafts') includeDrafts: string,
    @Res() res: Response,
  ) {
    if (!['txt', 'epub', 'html'].includes(format)) {
      throw new BadRequestException('format は txt, epub, html のいずれかを指定してください');
    }

    const result = await this.exportService.exportWork(workId, userId, {
      format: format as ExportFormat,
      includeDrafts: includeDrafts === 'true',
    });

    const encodedFilename = encodeURIComponent(result.filename);
    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
      'Content-Length': result.buffer.length.toString(),
    });
    res.send(result.buffer);
  }
}

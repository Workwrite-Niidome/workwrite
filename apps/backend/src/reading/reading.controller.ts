import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReadingService } from './reading.service';
import { BatchProgressDto } from './dto/reading.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Reading')
@Controller('reading')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReadingController {
  constructor(private readingService: ReadingService) {}

  @Post('progress')
  @ApiOperation({ summary: 'Batch update reading progress' })
  async updateProgress(
    @CurrentUser('id') userId: string,
    @Body() dto: BatchProgressDto,
  ) {
    const data = await this.readingService.batchUpdateProgress(userId, dto);
    return { data };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get reading statistics' })
  async getStats(@CurrentUser('id') userId: string) {
    const data = await this.readingService.getStats(userId);
    return { data };
  }

  @Get('progress/:workId')
  @ApiOperation({ summary: 'Get reading progress for a work' })
  async getProgress(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    const data = await this.readingService.getProgress(userId, workId);
    return { data };
  }

  @Get('resume/:workId')
  @ApiOperation({ summary: 'Get resume position for a work' })
  async getResume(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    const data = await this.readingService.getResumePosition(userId, workId);
    return { data };
  }
}

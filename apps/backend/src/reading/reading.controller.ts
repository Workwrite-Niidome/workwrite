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
  updateProgress(
    @CurrentUser('id') userId: string,
    @Body() dto: BatchProgressDto,
  ) {
    return this.readingService.batchUpdateProgress(userId, dto);
  }

  @Get('progress/:workId')
  @ApiOperation({ summary: 'Get reading progress for a work' })
  getProgress(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    return this.readingService.getProgress(userId, workId);
  }

  @Get('resume/:workId')
  @ApiOperation({ summary: 'Get resume position for a work' })
  getResume(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    return this.readingService.getResumePosition(userId, workId);
  }
}

import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmotionsService } from './emotions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Emotions')
@Controller('emotions')
export class EmotionsController {
  constructor(private emotionsService: EmotionsService) {}

  @Get('tags')
  @ApiOperation({ summary: 'Get all emotion tag masters' })
  getAllTags() {
    return this.emotionsService.getAllTags();
  }

  @Post('tag')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add emotion tag to a work' })
  addTag(
    @CurrentUser('id') userId: string,
    @Body() body: { workId: string; tagId: string; intensity?: number },
  ) {
    return this.emotionsService.addEmotionTag(userId, body);
  }

  @Post('tags/batch')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add multiple emotion tags to a work' })
  addMultipleTags(
    @CurrentUser('id') userId: string,
    @Body() body: { workId: string; tags: { tagId: string; intensity?: number }[] },
  ) {
    return this.emotionsService.addMultipleEmotionTags(userId, body.workId, body.tags);
  }

  @Get('work/:workId/aggregate')
  @ApiOperation({ summary: 'Get aggregated emotion tags for a work (for author dashboard)' })
  getAggregated(@Param('workId') workId: string) {
    return this.emotionsService.getAggregatedEmotionTags(workId);
  }

  @Get('work/:workId')
  @ApiOperation({ summary: 'Get all emotion tags for a work' })
  getForWork(@Param('workId') workId: string) {
    return this.emotionsService.getEmotionTagsForWork(workId);
  }

  @Get('work/:workId/mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my emotion tags for a work' })
  getMyTags(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    return this.emotionsService.getUserEmotionTagsForWork(userId, workId);
  }
}

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
  async getAllTags() {
    const data = await this.emotionsService.getAllTags();
    return { data };
  }

  @Post('tag')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add emotion tag to a work' })
  async addTag(
    @CurrentUser('id') userId: string,
    @Body() body: { workId: string; tagId: string; intensity?: number },
  ) {
    const data = await this.emotionsService.addEmotionTag(userId, body);
    return { data };
  }

  @Post('tags/batch')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add multiple emotion tags to a work' })
  async addMultipleTags(
    @CurrentUser('id') userId: string,
    @Body() body: { workId: string; tags: { tagId: string; intensity?: number }[] },
  ) {
    const data = await this.emotionsService.addMultipleEmotionTags(userId, body.workId, body.tags);
    return { data };
  }

  @Get('work/:workId/aggregate')
  @ApiOperation({ summary: 'Get aggregated emotion tags for a work (for author dashboard)' })
  async getAggregated(@Param('workId') workId: string) {
    const data = await this.emotionsService.getAggregatedEmotionTags(workId);
    return { data };
  }

  @Get('work/:workId')
  @ApiOperation({ summary: 'Get all emotion tags for a work' })
  async getForWork(@Param('workId') workId: string) {
    const data = await this.emotionsService.getEmotionTagsForWork(workId);
    return { data };
  }

  @Get('work/:workId/mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my emotion tags for a work' })
  async getMyTags(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    const data = await this.emotionsService.getUserEmotionTagsForWork(userId, workId);
    return { data };
  }
}

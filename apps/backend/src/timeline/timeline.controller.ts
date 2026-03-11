import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TimelineService } from './timeline.service';
import { PostQueryDto } from '../posts/dto/post-query.dto';

@ApiTags('Timeline')
@Controller('timeline')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'フォロー中のタイムライン' })
  async getFollowingTimeline(
    @CurrentUser('id') userId: string,
    @Query() query: PostQueryDto,
  ) {
    const result = await this.timelineService.getFollowingTimeline(
      userId,
      query.cursor,
      query.limit,
    );
    return { data: result };
  }

  @Get('global')
  @ApiOperation({ summary: 'グローバルタイムライン' })
  async getGlobalTimeline(
    @Query() query: PostQueryDto,
    @CurrentUser('id') userId?: string,
  ) {
    const result = await this.timelineService.getGlobalTimeline(
      query.cursor,
      query.limit,
      userId,
    );
    return { data: result };
  }

  @Get('trending')
  @ApiOperation({ summary: '話題の投稿' })
  async getTrendingPosts() {
    const posts = await this.timelineService.getTrendingPosts();
    return { data: posts };
  }
}

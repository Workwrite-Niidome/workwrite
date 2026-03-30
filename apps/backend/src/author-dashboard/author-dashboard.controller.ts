import { Controller, Get, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthorDashboardService } from './author-dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('Author Dashboard')
@Controller('author')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuthorDashboardController {
  constructor(
    private dashboardService: AuthorDashboardService,
    private prisma: PrismaService,
  ) {}

  private async verifyWorkOwnership(workId: string, userId: string) {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { authorId: true },
    });
    if (!work || work.authorId !== userId) {
      throw new ForbiddenException();
    }
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get author dashboard overview' })
  getOverview(@CurrentUser('id') userId: string) {
    return this.dashboardService.getOverview(userId);
  }

  @Get('works/:workId/analytics')
  @ApiOperation({ summary: 'Get analytics for a specific work' })
  async getWorkAnalytics(@Param('workId') workId: string, @CurrentUser('id') userId: string) {
    await this.verifyWorkOwnership(workId, userId);
    return this.dashboardService.getWorkAnalytics(workId);
  }

  @Get('works/:workId/emotions')
  @ApiOperation({ summary: 'Get emotion tag word cloud for a work' })
  async getEmotionCloud(@Param('workId') workId: string, @CurrentUser('id') userId: string) {
    await this.verifyWorkOwnership(workId, userId);
    return this.dashboardService.getEmotionTagCloud(workId);
  }

  @Get('works/:workId/heatmap')
  @ApiOperation({ summary: 'Get episode reading heatmap' })
  async getHeatmap(@Param('workId') workId: string, @CurrentUser('id') userId: string) {
    await this.verifyWorkOwnership(workId, userId);
    return this.dashboardService.getEpisodeHeatmap(workId);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue overview' })
  getRevenue(@CurrentUser('id') userId: string) {
    return this.dashboardService.getRevenueOverview(userId);
  }
}

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthorDashboardService } from './author-dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Author Dashboard')
@Controller('author')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuthorDashboardController {
  constructor(private dashboardService: AuthorDashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get author dashboard overview' })
  getOverview(@CurrentUser('id') userId: string) {
    return this.dashboardService.getOverview(userId);
  }

  @Get('works/:workId/analytics')
  @ApiOperation({ summary: 'Get analytics for a specific work' })
  getWorkAnalytics(@Param('workId') workId: string) {
    return this.dashboardService.getWorkAnalytics(workId);
  }

  @Get('works/:workId/emotions')
  @ApiOperation({ summary: 'Get emotion tag word cloud for a work' })
  getEmotionCloud(@Param('workId') workId: string) {
    return this.dashboardService.getEmotionTagCloud(workId);
  }

  @Get('works/:workId/heatmap')
  @ApiOperation({ summary: 'Get episode reading heatmap' })
  getHeatmap(@Param('workId') workId: string) {
    return this.dashboardService.getEpisodeHeatmap(workId);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue overview' })
  getRevenue(@CurrentUser('id') userId: string) {
    return this.dashboardService.getRevenueOverview(userId);
  }
}

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiInsightsService } from './ai-insights.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('AI Insights')
@Controller('ai/insights')
export class AiInsightsController {
  constructor(private aiInsightsService: AiInsightsService) {}

  @Get(':workId')
  @ApiOperation({ summary: 'Get generic AI insights for a work' })
  getGenericInsights(@Param('workId') workId: string) {
    return this.aiInsightsService.getGenericInsights(workId);
  }

  @Get(':workId/personal')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get personalized AI insights for a work' })
  getPersonalInsights(
    @Param('workId') workId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.aiInsightsService.getPersonalInsights(workId, userId);
  }
}

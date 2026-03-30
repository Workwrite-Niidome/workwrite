import { Controller, Get, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiInsightsService } from './ai-insights.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('AI Insights')
@Controller('ai/insights')
export class AiInsightsController {
  constructor(private aiInsightsService: AiInsightsService, private prisma: PrismaService) {}

  @Get(':workId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get generic AI insights for a work' })
  async getGenericInsights(@Param('workId') workId: string, @CurrentUser('id') userId: string) {
    const work = await this.prisma.work.findUnique({ where: { id: workId }, select: { authorId: true } });
    if (!work || work.authorId !== userId) throw new ForbiddenException();
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

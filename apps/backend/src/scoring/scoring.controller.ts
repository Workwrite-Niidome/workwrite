import { Controller, Get, Post, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ScoringService } from './scoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('Scoring')
@Controller('scoring')
export class ScoringController {
  constructor(private scoringService: ScoringService, private prisma: PrismaService) {}

  private async verifyWorkOwnership(workId: string, userId: string) {
    const work = await this.prisma.work.findUnique({ where: { id: workId }, select: { authorId: true } });
    if (!work || work.authorId !== userId) throw new ForbiddenException();
  }

  @Get('works/:workId/estimate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Estimate credit cost for scoring a work' })
  @ApiQuery({ name: 'model', required: false, enum: ['haiku', 'sonnet'] })
  async estimateCost(
    @Param('workId') workId: string,
    @Req() req: any,
    @Query('model') model?: 'haiku' | 'sonnet',
  ) {
    const userId = req.user?.id || req.user?.sub;
    await this.verifyWorkOwnership(workId, userId);
    return this.scoringService.estimateScoringCost(workId, userId, model || 'haiku');
  }

  @Post('works/:workId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger AI scoring for a work (saves to history, does not overwrite current score)' })
  @ApiQuery({ name: 'model', required: false, enum: ['haiku', 'sonnet'] })
  async scoreWork(
    @Param('workId') workId: string,
    @Req() req: any,
    @Query('model') model?: 'haiku' | 'sonnet',
  ) {
    const userId = req.user?.id || req.user?.sub;
    await this.verifyWorkOwnership(workId, userId);
    const result = await this.scoringService.scoreWork(workId, userId, model || 'haiku');
    if (!result) return { data: null };

    const { newScore, historyId, currentScore, autoAdopted } = result;

    return {
      data: {
        newScore: {
          immersion: newScore.immersion,
          transformation: newScore.transformation,
          virality: newScore.virality,
          worldBuilding: newScore.worldBuilding,
          characterDepth: newScore.characterDepth,
          structuralScore: newScore.structuralScore,
          overall: newScore.overall,
          analysis: newScore.analysis,
          tips: newScore.improvementTips,
          emotionTags: newScore.emotionTags,
          scoredAt: new Date().toISOString(),
        },
        historyId,
        currentScore: currentScore ? {
          immersion: currentScore.immersion,
          transformation: currentScore.transformation,
          virality: currentScore.virality,
          worldBuilding: currentScore.worldBuilding,
          characterDepth: currentScore.characterDepth,
          structuralScore: currentScore.structuralScore,
          overall: currentScore.overall,
          analysis: currentScore.analysisJson as Record<string, string> | null,
          tips: (currentScore.improvementTips as string[]) || [],
          scoredAt: currentScore.scoredAt.toISOString(),
        } : null,
        autoAdopted,
      },
    };
  }

  @Post('works/:workId/adopt')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Adopt a score history entry as the current quality score' })
  @ApiQuery({ name: 'historyId', required: true })
  async adoptScore(
    @Param('workId') workId: string,
    @Req() req: any,
    @Query('historyId') historyId: string,
  ) {
    const userId = req.user?.id || req.user?.sub;
    await this.verifyWorkOwnership(workId, userId);
    const success = await this.scoringService.adoptScore(workId, historyId, userId);
    return { success };
  }

  @Get('works/:workId/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get scoring history for a work' })
  async getHistory(@Param('workId') workId: string, @CurrentUser('id') userId: string) {
    await this.verifyWorkOwnership(workId, userId);
    const entries = await this.scoringService.getHistory(workId);
    return {
      data: entries.map((e: any) => ({
        id: e.id,
        immersion: e.immersion,
        transformation: e.transformation,
        virality: e.virality,
        worldBuilding: e.worldBuilding,
        characterDepth: e.characterDepth,
        structuralScore: e.structuralScore,
        overall: e.overall,
        analysis: e.analysisJson as Record<string, string> | null,
        tips: (e.improvementTips as string[]) || [],
        emotionTags: (e.emotionTags as string[]) || [],
        model: e.model,
        scoredAt: e.scoredAt.toISOString(),
      })),
    };
  }

  @Get('works/:workId')
  @ApiOperation({ summary: 'Get quality score for a work' })
  getScore(@Param('workId') workId: string) {
    return this.scoringService.getScore(workId);
  }

  @Get('works/:workId/analysis')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get detailed score analysis with improvement tips' })
  async getAnalysis(@Param('workId') workId: string, @CurrentUser('id') userId: string) {
    await this.verifyWorkOwnership(workId, userId);
    return this.scoringService.getScoreWithAnalysis(workId);
  }

  @Post('episodes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Score a single episode' })
  async scoreEpisode(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const episode = await this.prisma.episode.findUnique({ where: { id }, select: { work: { select: { authorId: true } } } });
    if (!episode || episode.work.authorId !== userId) throw new ForbiddenException();
    return this.scoringService.scoreEpisode(id);
  }
}

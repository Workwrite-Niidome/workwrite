import { Controller, Get, Post, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ScoringService } from './scoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Scoring')
@Controller('scoring')
export class ScoringController {
  constructor(private scoringService: ScoringService) {}

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
    return this.scoringService.estimateScoringCost(workId, userId, model || 'haiku');
  }

  @Post('works/:workId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger AI scoring for a work (dynamic credit cost)' })
  @ApiQuery({ name: 'model', required: false, enum: ['haiku', 'sonnet'] })
  async scoreWork(
    @Param('workId') workId: string,
    @Req() req: any,
    @Query('model') model?: 'haiku' | 'sonnet',
  ) {
    const userId = req.user?.id || req.user?.sub;
    const result = await this.scoringService.scoreWork(workId, userId, model || 'haiku');
    if (!result) return { data: null };
    return {
      data: {
        immersion: result.immersion,
        transformation: result.transformation,
        virality: result.virality,
        worldBuilding: result.worldBuilding,
        characterDepth: result.characterDepth,
        structuralScore: result.structuralScore,
        overall: result.overall,
        analysis: result.analysis,
        tips: result.improvementTips,
        emotionTags: result.emotionTags,
        scoredAt: new Date().toISOString(),
      },
    };
  }

  @Get('works/:workId')
  @ApiOperation({ summary: 'Get quality score for a work' })
  getScore(@Param('workId') workId: string) {
    return this.scoringService.getScore(workId);
  }

  @Get('works/:workId/analysis')
  @ApiOperation({ summary: 'Get detailed score analysis with improvement tips' })
  getAnalysis(@Param('workId') workId: string) {
    return this.scoringService.getScoreWithAnalysis(workId);
  }

  @Post('episodes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Score a single episode' })
  scoreEpisode(@Param('id') id: string) {
    return this.scoringService.scoreEpisode(id);
  }
}

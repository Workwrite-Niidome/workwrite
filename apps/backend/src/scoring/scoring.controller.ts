import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ScoringService } from './scoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Scoring')
@Controller('scoring')
export class ScoringController {
  constructor(private scoringService: ScoringService) {}

  @Post('works/:workId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger AI scoring for a work' })
  scoreWork(@Param('workId') workId: string) {
    return this.scoringService.scoreWork(workId);
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

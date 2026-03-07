import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';

import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HighlightsService } from './highlights.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Highlights')
@Controller('reading/highlights')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HighlightsController {
  constructor(private highlightsService: HighlightsService) {}

  @Post()
  @ApiOperation({ summary: 'Create highlight' })
  create(
    @CurrentUser('id') userId: string,
    @Body() body: { episodeId: string; startPos: number; endPos: number; color?: string; memo?: string },
  ) {
    return this.highlightsService.create(userId, body);
  }

  @Get('episode/:episodeId')
  @ApiOperation({ summary: 'Get highlights for an episode' })
  findByEpisode(
    @CurrentUser('id') userId: string,
    @Param('episodeId') episodeId: string,
  ) {
    return this.highlightsService.findByEpisode(userId, episodeId);
  }

  @Get(':workId')
  @ApiOperation({ summary: 'Get all highlights for a work' })
  findByWork(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    return this.highlightsService.findByWork(userId, workId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete highlight' })
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.highlightsService.delete(id, userId);
  }

  @Post(':id/ai-explain')
  @ApiOperation({ summary: 'Get AI explanation for a highlight' })
  explainHighlight(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.highlightsService.explainHighlight(id, userId);
  }
}

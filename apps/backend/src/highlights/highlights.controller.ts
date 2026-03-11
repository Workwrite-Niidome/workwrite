import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Logger } from '@nestjs/common';

import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HighlightsService } from './highlights.service';
import { PostsService } from '../posts/posts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Highlights')
@Controller('reading/highlights')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HighlightsController {
  private readonly logger = new Logger(HighlightsController.name);

  constructor(
    private highlightsService: HighlightsService,
    private postsService: PostsService,
  ) {}

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

  @Patch(':id')
  @ApiOperation({ summary: 'Update highlight' })
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { memo?: string; color?: string },
  ) {
    return this.highlightsService.update(id, userId, body);
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

  @Post(':id/share')
  @ApiOperation({ summary: 'Share highlight as a post' })
  async shareHighlight(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { comment?: string },
  ) {
    const highlight = await this.highlightsService.getHighlightWithContext(id, userId);
    const quote = highlight.text.slice(0, 200);
    const content = body.comment
      ? `${body.comment}\n\n「${quote}${highlight.text.length > 200 ? '...' : ''}」`
      : `「${quote}${highlight.text.length > 200 ? '...' : ''}」`;

    const post = await this.postsService.create(userId, {
      content,
      workId: highlight.workId,
      episodeId: highlight.episodeId,
      highlightId: id,
    });

    return { data: post };
  }
}

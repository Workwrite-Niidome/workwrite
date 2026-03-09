import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Comments')
@Controller('comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get('episode/:episodeId')
  @ApiOperation({ summary: 'Get comments for an episode' })
  findByEpisode(@Param('episodeId') episodeId: string) {
    return this.commentsService.findByEpisode(episodeId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Post a comment' })
  create(
    @CurrentUser('id') userId: string,
    @Body() body: { episodeId: string; content: string; paragraphId?: string; parentId?: string },
  ) {
    return this.commentsService.create(userId, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete comment' })
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.commentsService.delete(id, userId);
  }
}

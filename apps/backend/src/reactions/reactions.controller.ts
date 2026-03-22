import { Controller, Get, Post, Param, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReactionsService } from './reactions.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateReactionDto } from './dto/reaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Reactions')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReactionsController {
  constructor(
    private reactionsService: ReactionsService,
    private prisma: PrismaService,
  ) {}

  @Post('reactions/episode/:episodeId')
  async react(
    @Param('episodeId') episodeId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReactionDto,
  ) {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      select: { workId: true },
    });
    if (!episode) throw new NotFoundException('Episode not found');
    return this.reactionsService.upsertReaction(userId, episodeId, episode.workId, dto);
  }

  @Get('reactions/episode/:episodeId')
  async getEpisodeReactions(
    @Param('episodeId') episodeId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.reactionsService.getEpisodeReactions(episodeId, userId);
  }

  @Get('reactions/work/:workId')
  async getWorkReactions(@Param('workId') workId: string) {
    return this.reactionsService.getWorkReactions(workId);
  }

  @Get('reactions/work/:workId/feed')
  async getWorkReactionFeed(@Param('workId') workId: string) {
    return this.reactionsService.getWorkReactionFeed(workId);
  }
}

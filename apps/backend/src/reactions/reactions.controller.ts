import { Controller, Get, Post, Param, Body, UseGuards, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReactionsService } from './reactions.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateReactionDto } from './dto/reaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

// In-memory rate limiter for reaction POST: 30 per minute per user
const reactionRateMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

function checkReactionRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = reactionRateMap.get(userId) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  reactionRateMap.set(userId, recent);
  return true;
}

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
    if (!checkReactionRateLimit(userId)) {
      throw new ServiceUnavailableException('リアクションの送信回数が多すぎます。しばらくお待ちください。');
    }
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

  @Get('reactions/my/feed')
  async getMyReactionFeed(@CurrentUser('id') userId: string) {
    return this.reactionsService.getAuthorReactionFeed(userId);
  }

  @Get('reactions/trending')
  async getTrendingWorks() {
    return this.reactionsService.getTrendingWorks();
  }
}

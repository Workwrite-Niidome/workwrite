import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateReactionDto } from './dto/reaction.dto';

@Injectable()
export class ReactionsService {
  constructor(private prisma: PrismaService) {}

  async upsertReaction(userId: string, episodeId: string, workId: string, dto: CreateReactionDto) {
    return this.prisma.episodeReaction.upsert({
      where: { userId_episodeId: { userId, episodeId } },
      create: {
        userId,
        episodeId,
        workId,
        claps: dto.claps,
        emotion: dto.emotion,
      },
      update: {
        claps: dto.claps,
        emotion: dto.emotion,
      },
    });
  }

  async getEpisodeReactions(episodeId: string, userId?: string) {
    const reactions = await this.prisma.episodeReaction.findMany({ where: { episodeId } });
    const totalClaps = reactions.reduce((sum, r) => sum + r.claps, 0);
    const reactionCount = reactions.length;
    const emotions: Record<string, number> = {};
    for (const r of reactions) {
      if (r.emotion) emotions[r.emotion] = (emotions[r.emotion] || 0) + 1;
    }
    const myReaction = userId ? reactions.find(r => r.userId === userId) : undefined;
    return {
      totalClaps,
      reactionCount,
      emotions,
      myReaction: myReaction ? { claps: myReaction.claps, emotion: myReaction.emotion } : null,
    };
  }

  async getWorkReactions(workId: string) {
    const reactions = await this.prisma.episodeReaction.findMany({
      where: { workId },
      include: {
        episode: { select: { id: true, title: true, orderIndex: true } },
      },
    });

    const totalClaps = reactions.reduce((sum, r) => sum + r.claps, 0);
    const totalReactions = reactions.length;

    const byEpisodeMap: Record<string, { episodeId: string; title: string; orderIndex: number; claps: number; reactionCount: number }> = {};
    for (const r of reactions) {
      const key = r.episodeId;
      if (!byEpisodeMap[key]) {
        byEpisodeMap[key] = {
          episodeId: r.episodeId,
          title: r.episode.title,
          orderIndex: r.episode.orderIndex,
          claps: 0,
          reactionCount: 0,
        };
      }
      byEpisodeMap[key].claps += r.claps;
      byEpisodeMap[key].reactionCount += 1;
    }

    const byEpisode = Object.values(byEpisodeMap).sort((a, b) => a.orderIndex - b.orderIndex);

    return { byEpisode, totalClaps, totalReactions };
  }

  async getWorkReactionFeed(workId: string, limit = 20) {
    const feed = await this.prisma.episodeReaction.findMany({
      where: { workId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { displayName: true, name: true } },
        episode: { select: { title: true, orderIndex: true } },
      },
    });

    return feed.map(r => ({
      id: r.id,
      userDisplayName: r.user.displayName ?? r.user.name,
      episodeTitle: r.episode.title,
      episodeOrderIndex: r.episode.orderIndex,
      claps: r.claps,
      emotion: r.emotion,
      createdAt: r.createdAt,
    }));
  }
}

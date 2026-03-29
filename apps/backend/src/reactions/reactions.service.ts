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

  /** Get trending works (most reactions in last 24h) */
  async getTrendingWorks(limit = 5) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const reactions = await this.prisma.episodeReaction.groupBy({
      by: ['workId'],
      where: { createdAt: { gte: since } },
      _count: true,
      _sum: { claps: true },
      orderBy: { _count: { workId: 'desc' } },
      take: limit,
    });

    if (reactions.length === 0) return [];

    const workIds = reactions.map(r => r.workId);
    const works = await this.prisma.work.findMany({
      where: { id: { in: workIds }, status: 'PUBLISHED' },
      select: { id: true, title: true, genre: true, author: { select: { displayName: true, name: true } } },
    });
    const workMap = new Map(works.map(w => [w.id, w]));

    return reactions
      .filter(r => workMap.has(r.workId))
      .map(r => ({
        work: workMap.get(r.workId)!,
        reactionCount: r._count,
        totalClaps: r._sum.claps || 0,
      }));
  }

  /** Get reaction feed across ALL works by a specific author */
  async getAuthorReactionFeed(authorId: string, limit = 20) {
    const works = await this.prisma.work.findMany({
      where: { authorId },
      select: { id: true, title: true },
    });
    if (works.length === 0) return [];

    const workIds = works.map(w => w.id);
    const workMap = new Map(works.map(w => [w.id, w.title]));

    const [reactions, reviews] = await Promise.all([
      this.prisma.episodeReaction.findMany({
        where: { workId: { in: workIds } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: { select: { displayName: true, name: true } },
          episode: { select: { title: true, orderIndex: true } },
        },
      }),
      this.prisma.review.findMany({
        where: { workId: { in: workIds } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: { select: { displayName: true, name: true } },
        },
      }),
    ]);

    const reactionItems = reactions.map(r => ({
      id: r.id,
      type: 'reaction' as const,
      userDisplayName: r.user.displayName ?? r.user.name,
      workTitle: workMap.get(r.workId) || '',
      episodeTitle: r.episode.title,
      episodeOrderIndex: r.episode.orderIndex,
      claps: r.claps,
      emotion: r.emotion,
      content: null as string | null,
      createdAt: r.createdAt,
    }));

    const reviewItems = reviews.map(r => ({
      id: r.id,
      type: 'review' as const,
      userDisplayName: r.user.displayName ?? r.user.name,
      workTitle: workMap.get(r.workId) || '',
      episodeTitle: null as string | null,
      episodeOrderIndex: null as number | null,
      claps: 0,
      emotion: null as string | null,
      content: r.content,
      createdAt: r.createdAt,
    }));

    return [...reactionItems, ...reviewItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
}

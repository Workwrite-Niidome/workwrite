import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class DiscoverService {
  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
  ) {}

  async search(query: string, options?: { genre?: string; emotionTags?: string[]; limit?: number; offset?: number; sort?: string }) {
    return this.searchService.search(query, options);
  }

  async getTopPage() {
    const [popular, recent, hiddenGems, trendingTags, highImmersion, greatWorlds] = await Promise.all([
      this.getPopularWorks(6),
      this.getRecentWorks(6),
      this.getHiddenGems(6),
      this.getTrendingEmotionTags(),
      this.getHighImmersionWorks(6),
      this.getGreatWorldBuilding(6),
    ]);
    return { popular, recent, hiddenGems, trendingTags, highImmersion, greatWorlds };
  }

  async getPopularWorks(limit = 10) {
    return this.prisma.work.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { totalViews: 'desc' },
      take: limit,
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });
  }

  async getRecentWorks(limit = 10) {
    return this.prisma.work.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });
  }

  async getHiddenGems(limit = 6) {
    // Quality score top percentile but low views
    const highQualityThreshold = await this.prisma.qualityScore.aggregate({
      _avg: { overall: true },
    });
    const avgScore = highQualityThreshold._avg.overall ?? 50;

    return this.prisma.work.findMany({
      where: {
        status: 'PUBLISHED',
        qualityScore: { overall: { gte: avgScore * 1.2 } },
        totalViews: { lt: 100 },
      },
      orderBy: { qualityScore: { overall: 'desc' } },
      take: limit,
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });
  }

  async getTrendingEmotionTags() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const tags = await this.prisma.userEmotionTag.groupBy({
      by: ['tagId'],
      _count: { id: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
      orderBy: { _count: { id: 'desc' } },
      take: 15,
    });

    const tagDetails = await this.prisma.emotionTagMaster.findMany({
      where: { id: { in: tags.map((t) => t.tagId) } },
    });

    return tags.map((t) => {
      const detail = tagDetails.find((d) => d.id === t.tagId);
      return { ...detail, count: t._count.id };
    });
  }

  async getNextForMe(workId: string) {
    // Find emotion tags for the completed work, then find similar works
    const emotionTags = await this.prisma.userEmotionTag.findMany({
      where: { workId },
      include: { tag: true },
    });

    if (emotionTags.length === 0) {
      // Fallback: return popular works
      return this.getPopularWorks(3);
    }

    const tagIds = emotionTags.map((et) => et.tagId);

    // Find works that share emotion tags, excluding the current work
    const similarWorks = await this.prisma.work.findMany({
      where: {
        status: 'PUBLISHED',
        id: { not: workId },
        emotionTags: { some: { tagId: { in: tagIds } } },
      },
      orderBy: { qualityScore: { overall: 'desc' } },
      take: 3,
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });

    return similarWorks;
  }

  async getWorksByEmotionTag(tagName: string, limit = 20) {
    const tag = await this.prisma.emotionTagMaster.findUnique({ where: { name: tagName } });
    if (!tag) return [];

    return this.prisma.work.findMany({
      where: {
        status: 'PUBLISHED',
        emotionTags: { some: { tagId: tag.id } },
      },
      orderBy: { qualityScore: { overall: 'desc' } },
      take: limit,
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });
  }

  async getContinueReading(userId: string) {
    const entries = await this.prisma.bookshelfEntry.findMany({
      where: { userId, status: 'READING' },
      include: {
        work: {
          include: {
            episodes: { select: { id: true, title: true, orderIndex: true, wordCount: true }, orderBy: { orderIndex: 'asc' } },
            author: { select: { id: true, name: true, displayName: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    const results = [];
    for (const entry of entries) {
      const progress = await this.prisma.readingProgress.findMany({
        where: { userId, workId: entry.workId },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      });
      const latestProgress = progress[0];
      const currentEpisode = latestProgress
        ? entry.work.episodes.find(ep => ep.id === latestProgress.episodeId)
        : entry.work.episodes[0];
      results.push({
        work: entry.work,
        currentEpisode,
        progressPct: latestProgress?.progressPct ?? 0,
      });
    }
    return results;
  }

  async autocomplete(query: string) {
    if (!query || query.length < 2) return [];
    const works = await this.prisma.work.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { author: { name: { contains: query, mode: 'insensitive' } } },
          { author: { displayName: { contains: query, mode: 'insensitive' } } },
        ],
      },
      take: 5,
      select: {
        id: true,
        title: true,
        author: { select: { name: true, displayName: true } },
        genre: true,
      },
    });
    return works;
  }

  async getHighImmersionWorks(limit = 10) {
    return this.prisma.work.findMany({
      where: {
        status: 'PUBLISHED',
        qualityScore: { immersion: { gte: 70 } },
      },
      orderBy: { qualityScore: { immersion: 'desc' } },
      take: limit,
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true, immersion: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });
  }

  async getGreatWorldBuilding(limit = 10) {
    return this.prisma.work.findMany({
      where: {
        status: 'PUBLISHED',
        qualityScore: { worldBuilding: { gte: 70 } },
      },
      orderBy: { qualityScore: { worldBuilding: 'desc' } },
      take: limit,
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true, worldBuilding: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });
  }

  async getWorksByGenre(genre: string, limit = 20, cursor?: string) {
    return this.prisma.work.findMany({
      where: { status: 'PUBLISHED', genre },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });
  }
}

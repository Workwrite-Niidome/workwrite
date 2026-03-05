import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class DiscoverService {
  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
  ) {}

  async search(query: string, options?: { genre?: string; emotionTags?: string[]; limit?: number; offset?: number }) {
    return this.searchService.search(query, options);
  }

  async getTopPage() {
    const [popular, recent, hiddenGems, trendingTags] = await Promise.all([
      this.getPopularWorks(6),
      this.getRecentWorks(6),
      this.getHiddenGems(6),
      this.getTrendingEmotionTags(),
    ]);
    return { popular, recent, hiddenGems, trendingTags };
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

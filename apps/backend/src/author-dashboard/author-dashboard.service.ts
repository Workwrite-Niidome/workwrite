import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AuthorDashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview(authorId: string) {
    const works = await this.prisma.work.findMany({
      where: { authorId },
      include: {
        qualityScore: { select: { overall: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });

    const totalViews = works.reduce((sum, w) => sum + w.totalViews, 0);
    const totalReads = works.reduce((sum, w) => sum + w.totalReads, 0);
    const totalReviews = works.reduce((sum, w) => sum + w._count.reviews, 0);
    const avgScore = works.length > 0
      ? works.filter((w) => w.qualityScore).reduce((sum, w) => sum + (w.qualityScore?.overall ?? 0), 0) /
        works.filter((w) => w.qualityScore).length
      : 0;

    return {
      totalWorks: works.length,
      publishedWorks: works.filter((w) => w.status === 'PUBLISHED').length,
      totalViews,
      totalReads,
      totalReviews,
      avgScore: Math.round(avgScore),
      works,
    };
  }

  async getWorkAnalytics(workId: string) {
    const [work, emotionAgg, recentReviews, readingProgress] = await Promise.all([
      this.prisma.work.findUnique({
        where: { id: workId },
        include: {
          qualityScore: true,
          _count: { select: { reviews: true, episodes: true } },
          episodes: {
            orderBy: { orderIndex: 'asc' },
            select: { id: true, title: true, orderIndex: true, wordCount: true },
          },
        },
      }),
      this.getEmotionTagCloud(workId),
      this.prisma.review.findMany({
        where: { workId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
          _count: { select: { helpfuls: true } },
        },
      }),
      this.getEpisodeHeatmap(workId),
    ]);

    return { work, emotionCloud: emotionAgg, recentReviews, heatmap: readingProgress };
  }

  async getEmotionTagCloud(workId: string) {
    const tags = await this.prisma.userEmotionTag.groupBy({
      by: ['tagId'],
      where: { workId },
      _count: { id: true },
      _avg: { intensity: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const tagDetails = await this.prisma.emotionTagMaster.findMany({
      where: { id: { in: tags.map((t) => t.tagId) } },
    });

    return tags.map((t) => {
      const detail = tagDetails.find((d) => d.id === t.tagId);
      return {
        name: detail?.nameJa ?? '',
        nameEn: detail?.name ?? '',
        count: t._count.id,
        avgIntensity: Math.round((t._avg.intensity ?? 3) * 10) / 10,
      };
    });
  }

  async getEpisodeHeatmap(workId: string) {
    const episodes = await this.prisma.episode.findMany({
      where: { workId },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, title: true, orderIndex: true },
    });

    const progressData = await this.prisma.readingProgress.groupBy({
      by: ['episodeId'],
      where: { workId },
      _count: { id: true },
      _avg: { progressPct: true },
    });

    return episodes.map((ep) => {
      const data = progressData.find((p) => p.episodeId === ep.id);
      return {
        episodeId: ep.id,
        title: ep.title,
        orderIndex: ep.orderIndex,
        readers: data?._count.id ?? 0,
        avgProgress: Math.round((data?._avg.progressPct ?? 0) * 100),
      };
    });
  }

  async getRevenueOverview(authorId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { recipientId: authorId },
      orderBy: { createdAt: 'desc' },
    });

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const tipRevenue = payments.filter((p) => p.type === 'TIP').reduce((sum, p) => sum + p.amount, 0);
    const purchaseRevenue = payments.filter((p) => p.type === 'EPISODE_PURCHASE').reduce((sum, p) => sum + p.amount, 0);

    return {
      totalRevenue,
      tipRevenue,
      purchaseRevenue,
      recentPayments: payments.slice(0, 20),
    };
  }
}

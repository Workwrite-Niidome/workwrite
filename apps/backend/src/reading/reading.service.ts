import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { BatchProgressDto } from './dto/reading.dto';
import { COMPLETION_THRESHOLD } from '@workwrite/shared';

@Injectable()
export class ReadingService {
  constructor(private prisma: PrismaService) {}

  async batchUpdateProgress(userId: string, dto: BatchProgressDto) {
    const results = [];

    // Auto-transition: ensure bookshelf entry exists as READING
    const existingBookshelf = await this.prisma.bookshelfEntry.findUnique({
      where: { userId_workId: { userId, workId: dto.workId } },
    });
    if (!existingBookshelf) {
      await this.prisma.bookshelfEntry.create({
        data: { userId, workId: dto.workId, status: 'READING' },
      });
    } else if (existingBookshelf.status === 'WANT_TO_READ') {
      await this.prisma.bookshelfEntry.update({
        where: { userId_workId: { userId, workId: dto.workId } },
        data: { status: 'READING' },
      });
    }

    for (const entry of dto.entries) {
      const completed = entry.progressPct >= COMPLETION_THRESHOLD;

      const progress = await this.prisma.readingProgress.upsert({
        where: { userId_episodeId: { userId, episodeId: entry.episodeId } },
        update: {
          progressPct: entry.progressPct,
          readTimeMs: { increment: entry.readTimeMs },
          lastPosition: entry.lastPosition,
          completed,
        },
        create: {
          userId,
          workId: dto.workId,
          episodeId: entry.episodeId,
          progressPct: entry.progressPct,
          readTimeMs: entry.readTimeMs,
          lastPosition: entry.lastPosition,
          completed,
        },
      });

      // Update work stats on completion
      if (completed) {
        await this.prisma.work.update({
          where: { id: dto.workId },
          data: { totalReads: { increment: 1 } },
        });

        // Auto-update bookshelf to COMPLETED
        await this.prisma.bookshelfEntry.upsert({
          where: { userId_workId: { userId, workId: dto.workId } },
          update: { status: 'COMPLETED' },
          create: { userId, workId: dto.workId, status: 'COMPLETED' },
        });
      }

      results.push(progress);
    }

    return results;
  }

  async getProgress(userId: string, workId: string) {
    return this.prisma.readingProgress.findMany({
      where: { userId, workId },
      orderBy: { episode: { orderIndex: 'asc' } },
      include: { episode: { select: { id: true, title: true, orderIndex: true } } },
    });
  }

  async getStats(userId: string) {
    const [completedWorks, completedEpisodes, totalReadTime, emotionTags] = await Promise.all([
      this.prisma.bookshelfEntry.count({ where: { userId, status: 'COMPLETED' } }),
      this.prisma.readingProgress.count({ where: { userId, completed: true } }),
      this.prisma.readingProgress.aggregate({ where: { userId }, _sum: { readTimeMs: true } }),
      this.prisma.userEmotionTag.findMany({
        where: { userId },
        include: { tag: true },
      }),
    ]);

    // Genre distribution
    const completedBooks = await this.prisma.bookshelfEntry.findMany({
      where: { userId, status: 'COMPLETED' },
      include: { work: { select: { genre: true } } },
    });
    const genreMap: Record<string, number> = {};
    for (const entry of completedBooks) {
      const genre = entry.work.genre || 'other';
      genreMap[genre] = (genreMap[genre] || 0) + 1;
    }

    // Reading streak (consecutive days with reading activity)
    const recentProgress = await this.prisma.readingProgress.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
      take: 365,
    });
    const daySet = new Set(recentProgress.map(p => p.updatedAt.toISOString().split('T')[0]));
    let currentStreak = 0;
    let maxStreak = 0;
    const checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const dayStr = checkDate.toISOString().split('T')[0];
      if (daySet.has(dayStr)) {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        if (currentStreak > 0) break;
        // Allow skipping today (count from yesterday)
        if (i > 0) break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Top emotion tags
    const tagCounts: Record<string, { name: string; nameJa: string; count: number }> = {};
    for (const et of emotionTags) {
      const key = et.tagId;
      if (!tagCounts[key]) {
        tagCounts[key] = { name: et.tag.name, nameJa: et.tag.nameJa, count: 0 };
      }
      tagCounts[key].count++;
    }
    const topTags = Object.values(tagCounts).sort((a, b) => b.count - a.count).slice(0, 10);

    // Monthly activity (last 12 months) - single query instead of N+1
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const monthlyRaw = await this.prisma.readingProgress.findMany({
      where: {
        userId,
        updatedAt: { gte: twelveMonthsAgo },
      },
      select: { updatedAt: true },
    });

    // Build month counts
    const monthCounts: Record<string, number> = {};
    for (const r of monthlyRaw) {
      const d = r.updatedAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthCounts[key] = (monthCounts[key] || 0) + 1;
    }

    // Build ordered array for last 12 months
    const monthlyActivity: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyActivity.push({ month: monthStr, count: monthCounts[monthStr] || 0 });
    }

    return {
      completedWorks,
      completedEpisodes,
      totalReadTimeMs: totalReadTime._sum.readTimeMs || 0,
      currentStreak,
      maxStreak,
      genreDistribution: genreMap,
      topEmotionTags: topTags,
      monthlyActivity,
    };
  }

  async getResumePosition(userId: string, workId: string) {
    const latest = await this.prisma.readingProgress.findFirst({
      where: { userId, workId, completed: false },
      orderBy: { updatedAt: 'desc' },
      include: { episode: { select: { id: true, title: true, orderIndex: true } } },
    });

    if (latest) return latest;

    // All completed - return last episode
    return this.prisma.readingProgress.findFirst({
      where: { userId, workId },
      orderBy: { episode: { orderIndex: 'desc' } },
      include: { episode: { select: { id: true, title: true, orderIndex: true } } },
    });
  }
}

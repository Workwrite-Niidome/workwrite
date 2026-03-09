import { Injectable } from '@nestjs/common';
import { BookshelfStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class BookshelfService {
  constructor(private prisma: PrismaService) {}

  async getBookshelf(userId: string, status?: BookshelfStatus) {
    const entries = await this.prisma.bookshelfEntry.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { updatedAt: 'desc' },
      include: {
        work: {
          select: {
            id: true,
            title: true,
            coverUrl: true,
            genre: true,
            author: { select: { id: true, name: true, displayName: true } },
            qualityScore: { select: { overall: true } },
            _count: { select: { episodes: true } },
          },
        },
      },
    });

    // Enrich with reading progress
    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const totalEpisodes = entry.work._count.episodes;
        if (totalEpisodes === 0) {
          return { ...entry, progressPct: 0, currentEpisode: null };
        }

        const completedCount = await this.prisma.readingProgress.count({
          where: { userId, workId: entry.workId, completed: true },
        });

        const latestProgress = await this.prisma.readingProgress.findFirst({
          where: { userId, workId: entry.workId },
          orderBy: { updatedAt: 'desc' },
          include: { episode: { select: { id: true, title: true } } },
        });

        return {
          ...entry,
          progressPct: totalEpisodes > 0 ? completedCount / totalEpisodes : 0,
          currentEpisode: latestProgress?.episode ?? null,
        };
      }),
    );

    return enriched;
  }

  async addToBookshelf(userId: string, workId: string) {
    return this.prisma.bookshelfEntry.upsert({
      where: { userId_workId: { userId, workId } },
      update: {},
      create: { userId, workId, status: 'WANT_TO_READ' },
    });
  }

  async updateStatus(userId: string, workId: string, status: BookshelfStatus) {
    return this.prisma.bookshelfEntry.upsert({
      where: { userId_workId: { userId, workId } },
      update: { status },
      create: { userId, workId, status },
    });
  }

  async removeFromBookshelf(userId: string, workId: string) {
    await this.prisma.bookshelfEntry.deleteMany({
      where: { userId, workId },
    });
    return { deleted: true };
  }
}

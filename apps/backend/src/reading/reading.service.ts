import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { BatchProgressDto } from './dto/reading.dto';
import { COMPLETION_THRESHOLD } from '@ultra-reader/shared';

@Injectable()
export class ReadingService {
  constructor(private prisma: PrismaService) {}

  async batchUpdateProgress(userId: string, dto: BatchProgressDto) {
    const results = [];

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

import { Injectable, Logger } from '@nestjs/common';
import { BookshelfStatus, PostType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import { CreditService } from '../billing/credit.service';

const COMPLETION_REWARD_CR = 1;

@Injectable()
export class BookshelfService {
  private readonly logger = new Logger(BookshelfService.name);

  constructor(
    private prisma: PrismaService,
    private postsService: PostsService,
    private creditService: CreditService,
  ) {}

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
    // Check previous status
    const prev = await this.prisma.bookshelfEntry.findUnique({
      where: { userId_workId: { userId, workId } },
    });

    const entry = await this.prisma.bookshelfEntry.upsert({
      where: { userId_workId: { userId, workId } },
      update: { status },
      create: { userId, workId, status },
    });

    // Auto-post + Cr reward on reading completion
    if (status === 'COMPLETED' && prev?.status !== 'COMPLETED') {
      const work = await this.prisma.work.findUnique({
        where: { id: workId },
        select: { title: true },
      });
      if (work) {
        this.postsService.createAutoPost(userId, PostType.AUTO_READING, {
          content: `『${work.title}』を読了しました`,
          workId,
        }).catch((e) => this.logger.warn(`Auto-post failed: ${e}`));
      }

      // Grant 1Cr for reading completion
      this.grantCompletionReward(userId, workId).catch((e) =>
        this.logger.warn(`Completion reward failed: ${e}`),
      );
    }

    return entry;
  }

  private async grantCompletionReward(userId: string, workId: string) {
    await this.creditService.ensureCreditBalance(userId);
    const granted = await this.creditService.grantRewardCredits(
      userId,
      COMPLETION_REWARD_CR,
      'REVIEW_REWARD',
      `読了報酬 (${workId})`,
      5,            // 月5回まで
      '読了報酬',
    );
    if (granted) {
      this.logger.log(`Granted ${COMPLETION_REWARD_CR}Cr completion reward to ${userId} for work ${workId}`);
    }
  }

  async removeFromBookshelf(userId: string, workId: string) {
    await this.prisma.bookshelfEntry.deleteMany({
      where: { userId, workId },
    });
    return { deleted: true };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BookshelfStatus, WorkStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class DigestScheduler {
  private readonly logger = new Logger(DigestScheduler.name);

  constructor(private prisma: PrismaService) {}

  /** Send daily digest notifications at 9:00 AM JST (0:00 UTC) */
  @Cron('0 0 * * *')
  async sendDailyDigests() {
    this.logger.log('Starting daily digest notifications...');

    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    let processed = 0;
    let cursor: string | undefined;
    const batchSize = 100;

    while (true) {
      // Active users: logged in within last 30 days (using updatedAt as proxy)
      const users = await this.prisma.user.findMany({
        where: {
          isBanned: false,
          updatedAt: { gte: last30Days },
        },
        select: { id: true, displayName: true, name: true },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });

      if (users.length === 0) break;

      for (const user of users) {
        try {
          await this.processUserDigest(
            user,
            last24Hours,
            last7Days,
            threeDaysAgo,
          );
          processed++;
        } catch (e) {
          this.logger.error(
            `Failed to process digest for user ${user.id}`,
            e,
          );
        }
      }

      cursor = users[users.length - 1].id;

      if (users.length < batchSize) break;
    }

    this.logger.log(`Daily digest complete: ${processed} users processed`);
  }

  private async processUserDigest(
    user: { id: string; displayName: string | null; name: string },
    last24Hours: Date,
    last7Days: Date,
    threeDaysAgo: Date,
  ) {
    // 1. New episodes from followed authors
    const followUpdates = await this.prisma.episode.findMany({
      where: {
        publishedAt: { gte: last24Hours },
        author: {
          followers: {
            some: { followerId: user.id },
          },
        },
      },
      select: {
        id: true,
        title: true,
        workId: true,
        authorId: true,
        author: { select: { name: true, displayName: true } },
        work: { select: { title: true } },
      },
      take: 10,
    });

    // 2. Bookshelf reminders: READING works not accessed in 3+ days
    const readingReminders = await this.prisma.bookshelfEntry.findMany({
      where: {
        userId: user.id,
        status: BookshelfStatus.READING,
        updatedAt: { lte: threeDaysAgo },
      },
      select: {
        workId: true,
        work: { select: { title: true } },
        updatedAt: true,
      },
      take: 5,
    });

    // 3. New highly-rated works published in last 7 days
    const newWorks = await this.prisma.work.findMany({
      where: {
        status: WorkStatus.PUBLISHED,
        publishedAt: { gte: last7Days },
        qualityScore: {
          overall: { gte: 65 },
        },
        // Exclude works by the user themselves
        NOT: { authorId: user.id },
      },
      select: {
        id: true,
        title: true,
        authorId: true,
        author: { select: { name: true, displayName: true } },
        qualityScore: { select: { overall: true } },
      },
      orderBy: { qualityScore: { overall: 'desc' } },
      take: 5,
    });

    // Skip users with no relevant content
    if (
      followUpdates.length === 0 &&
      readingReminders.length === 0 &&
      newWorks.length === 0
    ) {
      return;
    }

    // Build notification body text
    const parts: string[] = [];

    if (followUpdates.length > 0) {
      const authorNames = [
        ...new Set(
          followUpdates.map(
            (e) => e.author.displayName ?? e.author.name,
          ),
        ),
      ];
      const authorLabel =
        authorNames.length === 1
          ? `${authorNames[0]}さん`
          : `${authorNames[0]}さんほか${authorNames.length - 1}名`;
      parts.push(`フォロー中の${authorLabel}が新話を公開`);
    }

    if (readingReminders.length > 0) {
      parts.push(`読みかけの作品が${readingReminders.length}件あります`);
    }

    if (newWorks.length > 0) {
      parts.push(`高評価の新作が${newWorks.length}件公開されました`);
    }

    const bodyText = parts.join(' / ');

    await this.prisma.notification.create({
      data: {
        userId: user.id,
        type: 'digest',
        title: 'あなたへのおすすめ',
        body: bodyText,
        data: { followUpdates, readingReminders, newWorks },
      },
    });
  }
}

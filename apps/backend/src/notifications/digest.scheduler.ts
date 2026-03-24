import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BookshelfStatus, WorkStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class DigestScheduler {
  private readonly logger = new Logger(DigestScheduler.name);

  constructor(private prisma: PrismaService) {}

  // ─── 朝8時 JST (UTC 23:00) — 新作おすすめ ───────────────────

  /** 高評価の新作おすすめを毎朝8時に配信 */
  @Cron('0 23 * * *')
  async sendMorningNewWorks() {
    this.logger.log('Starting morning new-works digest...');

    if (await this.alreadySentRecently('digest_new_works', 20)) return;

    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let processed = 0;
    for await (const user of this.activeUserBatches()) {
      try {
        const newWorks = await this.prisma.work.findMany({
          where: {
            status: WorkStatus.PUBLISHED,
            publishedAt: { gte: last7Days },
            qualityScore: { overall: { gte: 65 } },
            NOT: { authorId: user.id },
          },
          select: {
            id: true,
            title: true,
            synopsis: true,
            coverUrl: true,
            genre: true,
            authorId: true,
            author: { select: { name: true, displayName: true } },
            qualityScore: { select: { overall: true } },
          },
          orderBy: { qualityScore: { overall: 'desc' } },
          take: 5,
        });

        if (newWorks.length === 0) continue;

        const titles = newWorks.slice(0, 2).map((w) => `『${w.title}』`).join('、');
        const suffix = newWorks.length > 2 ? ` ほか${newWorks.length - 2}作品` : '';

        await this.prisma.notification.create({
          data: {
            userId: user.id,
            type: 'digest_new_works',
            title: '今週の注目作品',
            body: `${titles}${suffix}が公開されました`,
            data: { newWorks },
          },
        });
        processed++;
      } catch (e) {
        this.logger.error(`Failed morning digest for user ${user.id}`, e);
      }
    }

    this.logger.log(`Morning new-works digest complete: ${processed} users`);
  }

  // ─── 夕方18時 JST (UTC 9:00) — フォロー更新＋読みかけ ──────

  /** フォロー中の更新と読みかけリマインドを毎夕18時に配信 */
  @Cron('0 9 * * *')
  async sendEveningUpdates() {
    this.logger.log('Starting evening updates digest...');

    if (await this.alreadySentRecently('digest_updates', 20)) return;

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    let processed = 0;
    for await (const user of this.activeUserBatches()) {
      try {
        // New episodes from followed authors
        const followUpdates = await this.prisma.episode.findMany({
          where: {
            publishedAt: { gte: last24Hours },
            author: {
              followers: { some: { followerId: user.id } },
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

        // Bookshelf reminders: READING works not accessed in 3+ days
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

        if (followUpdates.length === 0 && readingReminders.length === 0) continue;

        const parts: string[] = [];
        if (followUpdates.length > 0) {
          const authorNames = [...new Set(
            followUpdates.map((e) => e.author.displayName ?? e.author.name),
          )];
          const authorLabel = authorNames.length === 1
            ? `${authorNames[0]}さん`
            : `${authorNames[0]}さんほか${authorNames.length - 1}名`;
          parts.push(`フォロー中の${authorLabel}が新話を公開`);
        }
        if (readingReminders.length > 0) {
          parts.push(`読みかけの作品が${readingReminders.length}件あります`);
        }

        await this.prisma.notification.create({
          data: {
            userId: user.id,
            type: 'digest_updates',
            title: 'フォロー中の更新',
            body: parts.join(' / '),
            data: { followUpdates, readingReminders },
          },
        });
        processed++;
      } catch (e) {
        this.logger.error(`Failed evening digest for user ${user.id}`, e);
      }
    }

    this.logger.log(`Evening updates digest complete: ${processed} users`);
  }

  // ─── Helpers ─────────────────────────────────────────────────

  /** Check if this type of notification was already sent recently */
  private async alreadySentRecently(type: string, hoursAgo: number): Promise<boolean> {
    const threshold = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const count = await this.prisma.notification.count({
      where: { type, createdAt: { gte: threshold } },
    });
    if (count > 0) {
      this.logger.log(`${type} already sent recently (${count} notifications). Skipping.`);
      return true;
    }
    return false;
  }

  /** Iterate active users in batches */
  private async *activeUserBatches() {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let cursor: string | undefined;
    const batchSize = 100;

    while (true) {
      const users = await this.prisma.user.findMany({
        where: { isBanned: false, updatedAt: { gte: last30Days } },
        select: { id: true, displayName: true, name: true },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });

      if (users.length === 0) break;

      for (const user of users) {
        yield user;
      }

      cursor = users[users.length - 1].id;
      if (users.length < batchSize) break;
    }
  }
}

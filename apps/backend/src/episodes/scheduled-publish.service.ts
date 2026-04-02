import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ScheduledPublishService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduledPublishService.name);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.intervalId = setInterval(() => this.processScheduled(), 60_000);
    this.logger.log('Scheduled publish service started (60s interval)');
  }

  onModuleDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async processScheduled() {
    try {
      const episodes = await this.prisma.episode.findMany({
        where: {
          scheduledAt: { lte: new Date() },
          publishedAt: null,
        },
        include: { work: { select: { authorId: true, title: true } } },
      });

      for (const ep of episodes) {
        await this.prisma.episode.update({
          where: { id: ep.id },
          data: { publishedAt: new Date() },
        });

        // Notify author
        await this.prisma.notification.create({
          data: {
            userId: ep.work.authorId,
            type: 'episode_published',
            title: '予約公開されました',
            body: `「${ep.work.title}」の「${ep.title}」が公開されました。`,
            data: { workId: ep.workId, episodeId: ep.id },
          },
        });

        this.logger.log(`Published scheduled episode: ${ep.id} (${ep.title})`);

        // Auto-update WorldCanon upToEpisode if World Fragments is enabled
        this.autoUpdateCanonEpisodeCount(ep.workId).catch((e2) =>
          this.logger.warn(`Canon auto-update failed for work ${ep.workId}: ${e2}`),
        );
      }
    } catch (e) {
      this.logger.error('Scheduled publish error', e);
    }
  }

  /** Auto-update WorldCanon upToEpisode when a new episode is published */
  private async autoUpdateCanonEpisodeCount(workId: string) {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { enableWorldFragments: true },
    });
    if (!work?.enableWorldFragments) return;

    const publishedCount = await this.prisma.episode.count({
      where: { workId, publishedAt: { not: null } },
    });

    await this.prisma.worldCanon.updateMany({
      where: { workId, upToEpisode: { lt: publishedCount } },
      data: { upToEpisode: publishedCount },
    });

    this.logger.log(`WorldCanon for work ${workId} updated to upToEpisode=${publishedCount}`);
  }
}

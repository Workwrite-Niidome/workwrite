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
      }
    } catch (e) {
      this.logger.error('Scheduled publish error', e);
    }
  }
}

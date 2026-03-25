import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class PendingLetterCleanupScheduler {
  private readonly logger = new Logger(PendingLetterCleanupScheduler.name);

  constructor(private prisma: PrismaService) {}

  /** Clean up expired PendingLetters every 10 minutes */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanup() {
    const result = await this.prisma.pendingLetter.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired pending letters`);
    }
  }
}

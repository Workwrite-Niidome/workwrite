import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreditService } from './credit.service';

@Injectable()
export class CreditGrantScheduler {
  private readonly logger = new Logger(CreditGrantScheduler.name);

  constructor(
    private prisma: PrismaService,
    private creditService: CreditService,
  ) {}

  /** Grant 20cr to all free users on the 1st of each month */
  @Cron('0 0 1 * *')
  async grantFreeCredits() {
    this.logger.log('Starting monthly free credit grant...');

    let processed = 0;
    let cursor: string | undefined;
    const batchSize = 100;

    while (true) {
      // Find users without active subscriptions (free users)
      const users = await this.prisma.user.findMany({
        where: {
          subscription: {
            OR: [
              { is: null } as any,
              { status: { not: 'active' } },
            ],
          },
        },
        select: { id: true },
        take: batchSize,
        ...(cursor
          ? { skip: 1, cursor: { id: cursor } }
          : {}),
        orderBy: { id: 'asc' },
      });

      if (users.length === 0) break;

      for (const user of users) {
        try {
          await this.creditService.grantMonthlyCredits(user.id, 20, 'free');
          processed++;
        } catch (e) {
          this.logger.error(
            `Failed to grant credits to user ${user.id}`,
            e,
          );
        }
      }

      cursor = users[users.length - 1].id;

      if (users.length < batchSize) break;
    }

    this.logger.log(`Monthly free credit grant complete: ${processed} users`);
  }
}

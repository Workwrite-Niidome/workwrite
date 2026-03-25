import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { StripeService } from './stripe.service';

const MIN_PAYOUT_YEN = 500;
const BATCH_SIZE = 50;

@Injectable()
export class AuthorPayoutService {
  private readonly logger = new Logger(AuthorPayoutService.name);

  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
  ) {}

  /**
   * Monthly payout: aggregate unpaid CharacterTalkRevenue and transfer to authors.
   * Runs at 03:00 on the 1st of each month.
   */
  @Cron('0 3 1 * *')
  async processMonthlyPayouts(): Promise<{ processed: number; failed: number }> {
    this.logger.log('Starting monthly author payout processing...');

    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1); // 1st of current month
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - 1); // 1st of previous month

    // Get authors with unpaid revenue above threshold
    const authorSums = await this.prisma.$queryRaw<
      { authorId: string; totalYen: number }[]
    >`
      SELECT "authorId", COALESCE(SUM("revenueYen"), 0)::int as "totalYen"
      FROM "CharacterTalkRevenue"
      WHERE "payoutId" IS NULL
        AND "createdAt" < ${periodEnd}
      GROUP BY "authorId"
      HAVING SUM("revenueYen") >= ${MIN_PAYOUT_YEN}
    `;

    if (authorSums.length === 0) {
      this.logger.log('No authors with payable revenue found.');
      return { processed: 0, failed: 0 };
    }

    this.logger.log(`Found ${authorSums.length} authors with payable revenue.`);
    let processed = 0;
    let failed = 0;

    for (const { authorId, totalYen } of authorSums) {
      try {
        await this.processAuthorPayout(authorId, totalYen, periodStart, periodEnd);
        processed++;
      } catch (e: any) {
        this.logger.error(`Payout failed for author ${authorId}: ${e.message}`);
        failed++;
      }
    }

    this.logger.log(`Monthly payout complete: ${processed} processed, ${failed} failed out of ${authorSums.length} authors.`);
    return { processed, failed };
  }

  private async processAuthorPayout(
    authorId: string,
    amount: number,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<void> {
    // Check author has a Connect account with payouts enabled
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { stripeAccountId: true },
    });

    if (!author?.stripeAccountId) {
      this.logger.warn(`Author ${authorId} has no Connect account, skipping payout of ${amount} yen`);
      return;
    }

    // Create payout record first
    const payout = await this.prisma.authorPayout.create({
      data: {
        authorId,
        amount,
        periodStart,
        periodEnd,
        status: 'processing',
      },
    });

    try {
      // Create Stripe transfer
      const idempotencyKey = `payout_${payout.id}`;
      const { transferId } = await this.stripeService.createTransfer(
        amount,
        author.stripeAccountId,
        { payoutId: payout.id, authorId },
        idempotencyKey,
      );

      // Atomically mark payout as completed and link revenue records
      await this.prisma.$transaction(async (tx) => {
        await tx.authorPayout.update({
          where: { id: payout.id },
          data: { status: 'completed', stripeTransferId: transferId },
        });

        // Link unpaid revenue records to this payout in batches
        let updated = 0;
        do {
          const batch = await tx.characterTalkRevenue.findMany({
            where: {
              authorId,
              payoutId: null,
              createdAt: { lt: periodEnd },
            },
            select: { id: true },
            take: BATCH_SIZE,
          });

          if (batch.length === 0) break;

          await tx.characterTalkRevenue.updateMany({
            where: { id: { in: batch.map((r) => r.id) } },
            data: { payoutId: payout.id },
          });

          updated += batch.length;
        } while (true);

        this.logger.log(`Payout ${payout.id}: transferred ${amount} yen to author ${authorId}, linked ${updated} revenue records`);
      });
    } catch (e: any) {
      // Mark payout as failed
      await this.prisma.authorPayout.update({
        where: { id: payout.id },
        data: { status: 'failed', failureReason: e.message },
      });
      throw e;
    }
  }

  /** Get payout history for an author */
  async getPayoutHistory(authorId: string) {
    return this.prisma.authorPayout.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
      take: 24, // 2 years of monthly payouts
    });
  }
}

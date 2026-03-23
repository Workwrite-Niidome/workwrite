import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CharacterTalkRevenueService {
  private readonly logger = new Logger(CharacterTalkRevenueService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Record revenue for a character talk session.
   * Only records if purchasedCreditsUsed > 0 (monthly free credits do not generate revenue).
   */
  async recordRevenue(
    authorId: string,
    readerId: string,
    workId: string,
    characterId: string | null,
    mode: string,
    creditAmount: number,
    purchasedCreditsUsed: number,
    creditTxId?: string,
  ): Promise<void> {
    if (purchasedCreditsUsed <= 0) return;

    // Revenue calculation: 9.8 yen per credit, platform takes 30%
    const revenueYen = Math.floor(purchasedCreditsUsed * 9.8 * 0.7);

    try {
      await this.prisma.characterTalkRevenue.create({
        data: {
          authorId,
          readerId,
          workId,
          characterId,
          mode,
          creditAmount,
          revenueYen,
          creditTxId: creditTxId || null,
        },
      });
      this.logger.log(
        `Revenue recorded: author=${authorId}, reader=${readerId}, work=${workId}, ` +
        `credits=${creditAmount}, purchased=${purchasedCreditsUsed}, revenueYen=${revenueYen}`,
      );
    } catch (e) {
      this.logger.error('Failed to record revenue', e);
    }
  }

  /**
   * Get earnings summary for an author.
   */
  async getAuthorEarnings(authorId: string): Promise<{
    totalRevenue: number;
    monthlyRevenue: number;
    totalSessions: number;
    monthlySessions: number;
    platformCutRate: number;
  }> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalResult, monthlyResult] = await Promise.all([
      this.prisma.$queryRaw<{ sum: number | null; count: bigint }[]>`
        SELECT COALESCE(SUM("revenueYen"), 0) as sum, COUNT(*)::bigint as count
        FROM "CharacterTalkRevenue"
        WHERE "authorId" = ${authorId}
      `,
      this.prisma.$queryRaw<{ sum: number | null; count: bigint }[]>`
        SELECT COALESCE(SUM("revenueYen"), 0) as sum, COUNT(*)::bigint as count
        FROM "CharacterTalkRevenue"
        WHERE "authorId" = ${authorId} AND "createdAt" >= ${monthStart}
      `,
    ]);

    return {
      totalRevenue: Number(totalResult[0]?.sum ?? 0),
      monthlyRevenue: Number(monthlyResult[0]?.sum ?? 0),
      totalSessions: Number(totalResult[0]?.count ?? 0),
      monthlySessions: Number(monthlyResult[0]?.count ?? 0),
      platformCutRate: 0.3,
    };
  }
}

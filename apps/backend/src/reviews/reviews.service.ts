import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import { CreditService } from '../billing/credit.service';
import { PostType } from '@prisma/client';

const REVIEW_REWARD_CR = 5;
const MIN_REVIEW_LENGTH = 20;

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private prisma: PrismaService,
    private postsService: PostsService,
    private creditService: CreditService,
  ) {}

  async create(userId: string, data: { workId: string; content: string }) {
    // Check if this is a new review (not an update)
    const existing = await this.prisma.review.findUnique({
      where: { userId_workId: { userId, workId: data.workId } },
    });

    const review = await this.prisma.review.upsert({
      where: { userId_workId: { userId, workId: data.workId } },
      update: { content: data.content },
      create: { userId, workId: data.workId, content: data.content },
      include: {
        user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        work: { select: { id: true, title: true } },
        _count: { select: { helpfuls: true } },
      },
    });

    // Auto-post only for new reviews (not updates)
    if (!existing) {
      const title = review.work?.title || '';
      const excerpt = data.content.slice(0, 100);
      this.postsService.createAutoPost(userId, PostType.AUTO_REVIEW, {
        content: `『${title}』にレビューを投稿しました\n\n${excerpt}${data.content.length > 100 ? '...' : ''}`,
        workId: data.workId,
      }).catch((e) => this.logger.warn(`Auto-post failed: ${e}`));

      // Grant Cr reward for new review (minimum length required)
      if (data.content.length >= MIN_REVIEW_LENGTH) {
        this.grantReviewReward(userId, data.workId).catch((e) =>
          this.logger.warn(`Review reward failed: ${e}`),
        );
      }
    }

    return review;
  }

  /**
   * Grant Cr reward for writing a review.
   * Immediate grant — spam detection is done asynchronously (future).
   */
  private async grantReviewReward(userId: string, workId: string) {
    try {
      // Ensure credit balance exists
      await this.creditService.ensureCreditBalance(userId);

      // Atomic: lock + check + grant inside single transaction
      await this.prisma.$transaction(async (tx) => {
        // Lock the balance row to prevent concurrent grants
        await tx.$queryRawUnsafe(
          'SELECT * FROM "CreditBalance" WHERE "userId" = $1 FOR UPDATE', userId,
        );

        // Check if already rewarded (inside transaction = race-safe)
        const existingTx = await tx.creditTransaction.findFirst({
          where: { userId, type: 'REVIEW_REWARD', description: `レビュー報酬 (${workId})` },
        });
        if (existingTx) return;

        const balance = await tx.creditBalance.update({
          where: { userId },
          data: {
            balance: { increment: REVIEW_REWARD_CR },
            purchasedBalance: { increment: REVIEW_REWARD_CR },
          },
        });

        await tx.creditTransaction.create({
          data: {
            userId,
            amount: REVIEW_REWARD_CR,
            type: 'REVIEW_REWARD',
            status: 'confirmed',
            balance: balance.balance,
            description: `レビュー報酬 (${workId})`,
          },
        });
      });

      this.logger.log(`Granted ${REVIEW_REWARD_CR}Cr review reward to user ${userId} for work ${workId}`);
    } catch (e) {
      this.logger.error(`Failed to grant review reward: ${e}`);
    }
  }

  async findByWork(workId: string) {
    return this.prisma.review.findMany({
      where: { workId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        _count: { select: { helpfuls: true } },
      },
    });
  }

  async toggleHelpful(userId: string, reviewId: string) {
    const existing = await this.prisma.reviewHelpful.findUnique({
      where: { userId_reviewId: { userId, reviewId } },
    });
    if (existing) {
      await this.prisma.reviewHelpful.delete({ where: { id: existing.id } });
      return { helpful: false };
    }
    await this.prisma.reviewHelpful.create({ data: { userId, reviewId } });
    return { helpful: true };
  }

  async delete(id: string, userId: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException();
    if (review.userId !== userId) throw new ForbiddenException();
    await this.prisma.review.delete({ where: { id } });
    return { deleted: true };
  }
}

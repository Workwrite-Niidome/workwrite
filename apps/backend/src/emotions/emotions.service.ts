import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreditService } from '../billing/credit.service';

const EMOTION_TAG_REWARD_CR = 1;

@Injectable()
export class EmotionsService {
  private readonly logger = new Logger(EmotionsService.name);

  constructor(
    private prisma: PrismaService,
    private creditService: CreditService,
  ) {}

  async getAllTags() {
    return this.prisma.emotionTagMaster.findMany({
      orderBy: { category: 'asc' },
    });
  }

  async addEmotionTag(userId: string, data: { workId: string; tagId: string; intensity?: number }) {
    return this.prisma.userEmotionTag.upsert({
      where: {
        userId_workId_tagId: {
          userId,
          workId: data.workId,
          tagId: data.tagId,
        },
      },
      update: { intensity: data.intensity ?? 3 },
      create: {
        userId,
        workId: data.workId,
        tagId: data.tagId,
        intensity: data.intensity ?? 3,
      },
      include: { tag: true },
    });
  }

  async addMultipleEmotionTags(userId: string, workId: string, tags: { tagId: string; intensity?: number }[]) {
    const results = await Promise.all(
      tags.map((t) => this.addEmotionTag(userId, { workId, tagId: t.tagId, intensity: t.intensity })),
    );

    // Grant 1Cr for emotion tagging (1 per work, fire-and-forget)
    if (tags.length > 0) {
      this.grantEmotionTagReward(userId, workId).catch((e) =>
        this.logger.warn(`Emotion tag reward failed: ${e}`),
      );
    }

    return results;
  }

  private async grantEmotionTagReward(userId: string, workId: string) {
    await this.creditService.ensureCreditBalance(userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT * FROM "CreditBalance" WHERE "userId" = $1 FOR UPDATE', userId);
      const existing = await tx.creditTransaction.findFirst({
        where: { userId, type: 'REVIEW_REWARD', description: `感情タグ報酬 (${workId})` },
      });
      if (existing) return;
      const balance = await tx.creditBalance.update({
        where: { userId },
        data: { balance: { increment: EMOTION_TAG_REWARD_CR }, purchasedBalance: { increment: EMOTION_TAG_REWARD_CR } },
      });
      await tx.creditTransaction.create({
        data: { userId, amount: EMOTION_TAG_REWARD_CR, type: 'REVIEW_REWARD', status: 'confirmed', balance: balance.balance, description: `感情タグ報酬 (${workId})` },
      });
    });
    this.logger.log(`Granted ${EMOTION_TAG_REWARD_CR}Cr emotion tag reward to ${userId} for work ${workId}`);
  }

  async getEmotionTagsForWork(workId: string) {
    return this.prisma.userEmotionTag.findMany({
      where: { workId },
      include: { tag: true },
    });
  }

  async getAggregatedEmotionTags(workId: string) {
    const tags = await this.prisma.userEmotionTag.groupBy({
      by: ['tagId'],
      where: { workId },
      _count: { id: true },
      _avg: { intensity: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const tagDetails = await this.prisma.emotionTagMaster.findMany({
      where: { id: { in: tags.map((t) => t.tagId) } },
    });

    return tags.map((t) => {
      const detail = tagDetails.find((d) => d.id === t.tagId);
      return {
        tag: detail,
        count: t._count.id,
        avgIntensity: Math.round((t._avg.intensity ?? 3) * 10) / 10,
      };
    });
  }

  async getUserEmotionTagsForWork(userId: string, workId: string) {
    return this.prisma.userEmotionTag.findMany({
      where: { userId, workId },
      include: { tag: true },
    });
  }
}

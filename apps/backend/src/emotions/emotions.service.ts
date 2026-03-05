import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class EmotionsService {
  constructor(private prisma: PrismaService) {}

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
    return results;
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

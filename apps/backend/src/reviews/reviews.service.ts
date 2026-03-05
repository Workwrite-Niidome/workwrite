import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: { workId: string; content: string }) {
    return this.prisma.review.upsert({
      where: { userId_workId: { userId, workId: data.workId } },
      update: { content: data.content },
      create: { userId, workId: data.workId, content: data.content },
      include: {
        user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        _count: { select: { helpfuls: true } },
      },
    });
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

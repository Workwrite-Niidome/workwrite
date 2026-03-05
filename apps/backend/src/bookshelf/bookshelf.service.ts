import { Injectable } from '@nestjs/common';
import { BookshelfStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class BookshelfService {
  constructor(private prisma: PrismaService) {}

  async getBookshelf(userId: string, status?: BookshelfStatus) {
    return this.prisma.bookshelfEntry.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { updatedAt: 'desc' },
      include: {
        work: {
          select: {
            id: true,
            title: true,
            coverUrl: true,
            genre: true,
            author: { select: { id: true, name: true, displayName: true } },
            qualityScore: { select: { overall: true } },
            _count: { select: { episodes: true } },
          },
        },
      },
    });
  }

  async addToBookshelf(userId: string, workId: string) {
    return this.prisma.bookshelfEntry.upsert({
      where: { userId_workId: { userId, workId } },
      update: {},
      create: { userId, workId, status: 'WANT_TO_READ' },
    });
  }

  async updateStatus(userId: string, workId: string, status: BookshelfStatus) {
    return this.prisma.bookshelfEntry.upsert({
      where: { userId_workId: { userId, workId } },
      update: { status },
      create: { userId, workId, status },
    });
  }

  async removeFromBookshelf(userId: string, workId: string) {
    await this.prisma.bookshelfEntry.deleteMany({
      where: { userId, workId },
    });
    return { deleted: true };
  }
}

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: { episodeId: string; content: string; paragraphId?: string; parentId?: string }) {
    return this.prisma.comment.create({
      data: { userId, ...data },
      include: {
        user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        replies: {
          include: {
            user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });
  }

  async findByEpisode(episodeId: string) {
    return this.prisma.comment.findMany({
      where: { episodeId, parentId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    });
  }

  async delete(id: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException();
    if (comment.userId !== userId) throw new ForbiddenException();
    await this.prisma.comment.delete({ where: { id } });
    return { deleted: true };
  }
}

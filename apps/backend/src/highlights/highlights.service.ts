import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class HighlightsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: {
    episodeId: string;
    startPos: number;
    endPos: number;
    color?: string;
    memo?: string;
  }) {
    return this.prisma.highlight.create({
      data: { userId, ...data },
    });
  }

  async findByEpisode(userId: string, episodeId: string) {
    return this.prisma.highlight.findMany({
      where: { userId, episodeId },
      orderBy: { startPos: 'asc' },
    });
  }

  async findByWork(userId: string, workId: string) {
    return this.prisma.highlight.findMany({
      where: {
        userId,
        episode: { workId },
      },
      orderBy: { createdAt: 'desc' },
      include: { episode: { select: { id: true, title: true } } },
    });
  }

  async delete(id: string, userId: string) {
    const hl = await this.prisma.highlight.findUnique({ where: { id } });
    if (!hl || hl.userId !== userId) throw new NotFoundException();
    await this.prisma.highlight.delete({ where: { id } });
    return { deleted: true };
  }
}

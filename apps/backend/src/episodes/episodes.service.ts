import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEpisodeDto, UpdateEpisodeDto } from './dto/episode.dto';

@Injectable()
export class EpisodesService {
  constructor(private prisma: PrismaService) {}

  async create(workId: string, userId: string, dto: CreateEpisodeDto) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('Work not found');
    if (work.authorId !== userId) throw new ForbiddenException();

    // Auto-assign orderIndex if not provided
    let orderIndex = dto.orderIndex;
    if (orderIndex === undefined) {
      const lastEp = await this.prisma.episode.findFirst({
        where: { workId },
        orderBy: { orderIndex: 'desc' },
      });
      orderIndex = (lastEp?.orderIndex ?? -1) + 1;
    }

    const wordCount = dto.content.length;

    return this.prisma.episode.create({
      data: {
        workId,
        authorId: userId,
        title: dto.title,
        content: dto.content,
        orderIndex,
        wordCount,
        publishedAt: dto.scheduledAt ? null : new Date(),
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      },
    });
  }

  async findByWork(workId: string) {
    return this.prisma.episode.findMany({
      where: { workId },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        title: true,
        orderIndex: true,
        wordCount: true,
        publishedAt: true,
        scheduledAt: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id },
      include: {
        work: { select: { id: true, title: true, authorId: true } },
      },
    });
    if (!episode) throw new NotFoundException('Episode not found');
    return episode;
  }

  async update(id: string, userId: string, dto: UpdateEpisodeDto) {
    const episode = await this.prisma.episode.findUnique({
      where: { id },
      include: { work: { select: { authorId: true } } },
    });
    if (!episode) throw new NotFoundException('Episode not found');
    if (episode.work.authorId !== userId) throw new ForbiddenException();

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.content !== undefined) {
      data.content = dto.content;
      data.wordCount = dto.content.length;
    }
    if (dto.orderIndex !== undefined) data.orderIndex = dto.orderIndex;
    if (dto.scheduledAt !== undefined) data.scheduledAt = new Date(dto.scheduledAt);

    return this.prisma.episode.update({ where: { id }, data });
  }

  async delete(id: string, userId: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id },
      include: { work: { select: { authorId: true } } },
    });
    if (!episode) throw new NotFoundException('Episode not found');
    if (episode.work.authorId !== userId) throw new ForbiddenException();
    await this.prisma.episode.delete({ where: { id } });
    return { deleted: true };
  }
}

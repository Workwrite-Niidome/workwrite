import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateEpisodeDto, UpdateEpisodeDto } from './dto/episode.dto';
import { ReorderEpisodesDto } from './dto/reorder-episodes.dto';

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

  async reorder(workId: string, userId: string, dto: ReorderEpisodesDto) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('Work not found');
    if (work.authorId !== userId) throw new ForbiddenException();

    // Use negative indices first to avoid unique constraint conflicts
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < dto.items.length; i++) {
        await tx.episode.update({
          where: { id: dto.items[i].id },
          data: { orderIndex: -(i + 1) },
        });
      }
      for (const item of dto.items) {
        await tx.episode.update({
          where: { id: item.id },
          data: { orderIndex: item.orderIndex },
        });
      }
    });

    return this.findByWork(workId);
  }

  async publish(id: string, userId: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id },
      include: { work: { select: { authorId: true } } },
    });
    if (!episode) throw new NotFoundException('Episode not found');
    if (episode.work.authorId !== userId) throw new ForbiddenException();

    // Auto-snapshot on publish
    await this.createSnapshot(id, userId, 'Auto: Published');

    return this.prisma.episode.update({
      where: { id },
      data: { publishedAt: new Date(), scheduledAt: null },
    });
  }

  async unpublish(id: string, userId: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id },
      include: { work: { select: { authorId: true } } },
    });
    if (!episode) throw new NotFoundException('Episode not found');
    if (episode.work.authorId !== userId) throw new ForbiddenException();

    return this.prisma.episode.update({
      where: { id },
      data: { publishedAt: null },
    });
  }

  async schedule(id: string, userId: string, scheduledAt: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id },
      include: { work: { select: { authorId: true } } },
    });
    if (!episode) throw new NotFoundException('Episode not found');
    if (episode.work.authorId !== userId) throw new ForbiddenException();

    return this.prisma.episode.update({
      where: { id },
      data: { scheduledAt: new Date(scheduledAt), publishedAt: null },
    });
  }

  // Snapshot methods
  async createSnapshot(episodeId: string, userId: string, label?: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: { work: { select: { authorId: true } } },
    });
    if (!episode) throw new NotFoundException('Episode not found');
    if (episode.work.authorId !== userId) throw new ForbiddenException();

    return this.prisma.episodeSnapshot.create({
      data: {
        episodeId,
        userId,
        title: episode.title,
        content: episode.content,
        wordCount: episode.wordCount,
        label,
      },
    });
  }

  async getSnapshots(episodeId: string) {
    return this.prisma.episodeSnapshot.findMany({
      where: { episodeId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        wordCount: true,
        label: true,
        createdAt: true,
      },
    });
  }

  async getSnapshotContent(snapshotId: string) {
    const snapshot = await this.prisma.episodeSnapshot.findUnique({
      where: { id: snapshotId },
    });
    if (!snapshot) throw new NotFoundException('Snapshot not found');
    return snapshot;
  }

  async restoreSnapshot(snapshotId: string, userId: string) {
    const snapshot = await this.prisma.episodeSnapshot.findUnique({
      where: { id: snapshotId },
    });
    if (!snapshot) throw new NotFoundException('Snapshot not found');

    const episode = await this.prisma.episode.findUnique({
      where: { id: snapshot.episodeId },
      include: { work: { select: { authorId: true } } },
    });
    if (!episode) throw new NotFoundException('Episode not found');
    if (episode.work.authorId !== userId) throw new ForbiddenException();

    // Save current state before restoring
    await this.createSnapshot(episode.id, userId, 'Auto: Before restore');

    return this.prisma.episode.update({
      where: { id: snapshot.episodeId },
      data: {
        title: snapshot.title,
        content: snapshot.content,
        wordCount: snapshot.wordCount,
      },
    });
  }
}

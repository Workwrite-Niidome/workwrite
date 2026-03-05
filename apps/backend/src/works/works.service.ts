import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateWorkDto, UpdateWorkDto } from './dto/work.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class WorksService {
  constructor(private prisma: PrismaService) {}

  async create(authorId: string, dto: CreateWorkDto) {
    const work = await this.prisma.work.create({
      data: {
        authorId,
        title: dto.title,
        synopsis: dto.synopsis,
        coverUrl: dto.coverUrl,
        genre: dto.genre,
      },
      include: { tags: true },
    });

    if (dto.tags?.length) {
      await this.prisma.workTag.createMany({
        data: dto.tags.map((tag) => ({
          workId: work.id,
          tag,
          type: 'KEYWORD' as const,
        })),
      });
    }

    return this.findOne(work.id);
  }

  async findAll(query: PaginationDto & { genre?: string; status?: string }) {
    const where: Record<string, unknown> = { status: 'PUBLISHED' };
    if (query.genre) where.genre = query.genre;

    const [items, total] = await Promise.all([
      this.prisma.work.findMany({
        where,
        take: query.limit,
        orderBy: { publishedAt: 'desc' },
        include: {
          author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
          tags: true,
          qualityScore: { select: { overall: true } },
          _count: { select: { reviews: true, episodes: true } },
        },
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.prisma.work.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        cursor: items[items.length - 1]?.id,
        hasMore: items.length === query.limit,
      },
    };
  }

  async findOne(id: string) {
    const work = await this.prisma.work.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        episodes: {
          orderBy: { orderIndex: 'asc' },
          select: { id: true, title: true, orderIndex: true, wordCount: true, publishedAt: true },
        },
        qualityScore: true,
        _count: { select: { reviews: true, bookshelfEntries: true } },
      },
    });
    if (!work) throw new NotFoundException('Work not found');
    return work;
  }

  async findByAuthor(authorId: string) {
    return this.prisma.work.findMany({
      where: { authorId },
      orderBy: { updatedAt: 'desc' },
      include: {
        tags: true,
        qualityScore: { select: { overall: true } },
        _count: { select: { episodes: true, reviews: true } },
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateWorkDto) {
    const work = await this.prisma.work.findUnique({ where: { id } });
    if (!work) throw new NotFoundException('Work not found');
    if (work.authorId !== userId) throw new ForbiddenException();

    const updateData: Record<string, unknown> = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.synopsis !== undefined) updateData.synopsis = dto.synopsis;
    if (dto.coverUrl !== undefined) updateData.coverUrl = dto.coverUrl;
    if (dto.genre !== undefined) updateData.genre = dto.genre;
    if (dto.status !== undefined) {
      updateData.status = dto.status;
      if (dto.status === 'PUBLISHED' && !work.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    const updated = await this.prisma.work.update({
      where: { id },
      data: updateData,
    });

    if (dto.tags) {
      await this.prisma.workTag.deleteMany({ where: { workId: id, type: 'KEYWORD' } });
      await this.prisma.workTag.createMany({
        data: dto.tags.map((tag) => ({ workId: id, tag, type: 'KEYWORD' as const })),
      });
    }

    return this.findOne(updated.id);
  }

  async delete(id: string, userId: string) {
    const work = await this.prisma.work.findUnique({ where: { id } });
    if (!work) throw new NotFoundException('Work not found');
    if (work.authorId !== userId) throw new ForbiddenException();
    await this.prisma.work.delete({ where: { id } });
    return { deleted: true };
  }
}

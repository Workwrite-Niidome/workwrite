import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import { ScoringService } from '../scoring/scoring.service';
import { SearchService } from '../search/search.service';
import { EmotionsService } from '../emotions/emotions.service';
import { CreateWorkDto, UpdateWorkDto } from './dto/work.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PostType } from '@prisma/client';

@Injectable()
export class WorksService {
  private readonly logger = new Logger(WorksService.name);

  constructor(
    private prisma: PrismaService,
    private postsService: PostsService,
    private scoringService: ScoringService,
    private searchService: SearchService,
    private emotionsService: EmotionsService,
  ) {}

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

  async findOne(id: string, userId?: string) {
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

    // If the viewer is not the author, filter out unpublished episodes
    if (work.authorId !== userId) {
      (work as any).episodes = work.episodes.filter((ep) => ep.publishedAt !== null);
    }

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

  async findPublishedByAuthor(authorId: string) {
    return this.prisma.work.findMany({
      where: { authorId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      include: {
        tags: true,
        qualityScore: { select: { overall: true } },
        _count: { select: { episodes: { where: { publishedAt: { not: null } } }, reviews: true } },
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
    if (dto.prologue !== undefined) updateData.prologue = dto.prologue;
    if (dto.coverUrl !== undefined) updateData.coverUrl = dto.coverUrl;
    if (dto.genre !== undefined) updateData.genre = dto.genre;
    if (dto.status !== undefined) {
      updateData.status = dto.status;
      if (dto.status === 'PUBLISHED' && !work.publishedAt) {
        updateData.publishedAt = new Date();
        // Auto-post to SNS
        this.postsService.createAutoPost(userId, PostType.AUTO_WORK, {
          content: `新作『${dto.title || work.title}』を公開しました`,
          workId: id,
        }).catch((e) => this.logger.warn(`Auto-post failed: ${e}`));
        // Auto-scoring, search indexing, emotion tag generation
        this.autoProcessWork(id).catch((e) => this.logger.warn(`Auto-process failed: ${e}`));
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

  /** Auto-score, generate emotion tags, and index to search after publishing */
  async autoProcessWork(workId: string) {
    // 1. Score the work
    const score = await this.scoringService.scoreWork(workId);
    this.logger.log(`Auto-scored work ${workId}: overall=${score?.overall}`);

    // 2. Generate emotion tags from scoring result
    if (score && (score as any).emotionTags?.length) {
      const allTags = await this.prisma.emotionTagMaster.findMany();
      const tagMap = new Map(allTags.map((t) => [t.name, t.id]));
      const work = await this.prisma.work.findUnique({ where: { id: workId }, select: { authorId: true } });
      if (work) {
        const tagsToAdd = ((score as any).emotionTags as string[])
          .filter((name) => tagMap.has(name))
          .map((name) => ({ tagId: tagMap.get(name)! }));
        if (tagsToAdd.length > 0) {
          await this.emotionsService.addMultipleEmotionTags(work.authorId, workId, tagsToAdd);
          this.logger.log(`Auto-generated ${tagsToAdd.length} emotion tags for work ${workId}`);
        }
      }
    }

    // 3. Index to Meilisearch
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      include: {
        author: { select: { displayName: true, name: true } },
        tags: true,
        qualityScore: { select: { overall: true } },
      },
    });
    if (work) {
      const emotionTags = await this.emotionsService.getAggregatedEmotionTags(workId);
      await this.searchService.indexWork({
        id: work.id,
        title: work.title,
        synopsis: work.synopsis || '',
        genre: work.genre || '',
        authorName: work.author.displayName || work.author.name,
        tags: work.tags.map((t) => t.tag),
        emotionTags: emotionTags.map((et) => et.tag?.name || '').filter(Boolean),
        qualityScore: work.qualityScore?.overall || 0,
        totalViews: work.totalViews,
        totalReads: work.totalReads,
        publishedAt: work.publishedAt?.getTime() || 0,
      });
      this.logger.log(`Indexed work ${workId} to search`);
    }
  }
}

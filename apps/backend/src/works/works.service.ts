import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import { ScoringService } from '../scoring/scoring.service';
import { SearchService } from '../search/search.service';
import { EmotionsService } from '../emotions/emotions.service';
import { EmotionMappingService } from '../emotions/emotion-mapping.service';
import { ReferralService } from '../referral/referral.service';
import { EpisodeAnalysisService } from '../ai-assist/episode-analysis.service';
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
    private emotionMappingService: EmotionMappingService,
    private referralService: ReferralService,
    private episodeAnalysisService: EpisodeAnalysisService,
  ) {}

  async create(authorId: string, dto: CreateWorkDto) {
    const work = await this.prisma.work.create({
      data: {
        authorId,
        title: dto.title,
        synopsis: dto.synopsis,
        coverUrl: dto.coverUrl,
        genre: dto.genre,
        isAiGenerated: dto.isAiGenerated || false,
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

    // Add reader counts (bookshelf status breakdown)
    const readerCounts = await this.prisma.bookshelfEntry.groupBy({
      by: ['status'],
      where: { workId: id },
      _count: true,
    });
    const readers: Record<string, number> = {};
    for (const r of readerCounts) {
      readers[r.status] = r._count;
    }
    (work as any).readerCounts = readers;

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
    if (dto.completionStatus !== undefined) updateData.completionStatus = dto.completionStatus;
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
        // Referral reward: first work published
        this.referralService.checkAndReward(userId, 'first_work_published')
          .catch((e) => this.logger.warn(`Referral reward failed: ${e}`));
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

  async getWorkReaderStats(workId: string, authorId: string) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('Work not found');
    if (work.authorId !== authorId) throw new ForbiddenException('Not your work');

    const [
      statusCounts,
      totalReaders,
      recentReaders7d,
      episodeStats,
      completionRate,
      avgReadTime,
      dailyReaders,
    ] = await Promise.all([
      // Reader count by status
      this.prisma.bookshelfEntry.groupBy({
        by: ['status'],
        where: { workId },
        _count: true,
      }),
      // Total unique readers
      this.prisma.readingProgress.findMany({
        where: { workId },
        distinct: ['userId'],
        select: { userId: true },
      }),
      // New readers in last 7 days
      this.prisma.bookshelfEntry.count({
        where: { workId, addedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      }),
      // Per-episode reader stats
      this.prisma.readingProgress.groupBy({
        by: ['episodeId'],
        where: { workId },
        _count: true,
        _avg: { progressPct: true },
        _sum: { readTimeMs: true },
      }),
      // Completion rate (completed readers / total readers)
      this.prisma.bookshelfEntry.count({
        where: { workId, status: 'COMPLETED' },
      }),
      // Average total read time per reader
      this.prisma.readingProgress.aggregate({
        where: { workId },
        _sum: { readTimeMs: true },
      }),
      // Daily new readers (last 30 days)
      this.prisma.bookshelfEntry.findMany({
        where: { workId, addedAt: { gte: new Date(Date.now() - 30 * 86400000) } },
        select: { addedAt: true },
      }),
    ]);

    // Build status breakdown
    const statusBreakdown: Record<string, number> = {};
    for (const s of statusCounts) {
      statusBreakdown[s.status] = s._count;
    }

    // Build episode stats with titles
    const episodes = await this.prisma.episode.findMany({
      where: { workId },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, title: true, orderIndex: true },
    });
    const episodeMap = new Map(episodes.map(e => [e.id, e]));
    const episodeAnalytics = episodeStats.map(es => ({
      episodeId: es.episodeId,
      title: episodeMap.get(es.episodeId)?.title || '',
      orderIndex: episodeMap.get(es.episodeId)?.orderIndex ?? 0,
      readers: es._count,
      avgProgress: Math.round((es._avg.progressPct || 0) * 100),
      totalReadTimeMs: es._sum.readTimeMs || 0,
    })).sort((a, b) => a.orderIndex - b.orderIndex);

    // Build daily reader chart (last 30 days)
    const dailyMap: Record<string, number> = {};
    for (const r of dailyReaders) {
      const day = r.addedAt.toISOString().split('T')[0];
      dailyMap[day] = (dailyMap[day] || 0) + 1;
    }
    const dailyChart: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dayStr = d.toISOString().split('T')[0];
      dailyChart.push({ date: dayStr, count: dailyMap[dayStr] || 0 });
    }

    // Calculate drop-off rate between episodes
    const dropOff = episodeAnalytics.map((ep, i) => ({
      ...ep,
      dropOffPct: i === 0 ? 0 : (episodeAnalytics[0].readers > 0
        ? Math.round((1 - ep.readers / episodeAnalytics[0].readers) * 100)
        : 0),
    }));

    const totalUniqueReaders = totalReaders.length;
    const totalReadTimeMs = avgReadTime._sum.readTimeMs || 0;

    return {
      totalViews: work.totalViews,
      totalReads: work.totalReads,
      totalUniqueReaders,
      recentReaders7d,
      completionRate: totalUniqueReaders > 0 ? Math.round((completionRate / totalUniqueReaders) * 100) : 0,
      avgReadTimePerReader: totalUniqueReaders > 0 ? Math.round(totalReadTimeMs / totalUniqueReaders) : 0,
      statusBreakdown,
      episodeAnalytics: dropOff,
      dailyNewReaders: dailyChart,
    };
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

    // 2.5 Apply author emotion tags from emotionBlueprint
    try {
      const creationPlanForEmotions = await this.prisma.workCreationPlan.findUnique({
        where: { workId },
        select: { emotionBlueprint: true },
      });
      if (creationPlanForEmotions?.emotionBlueprint) {
        const workForAuthor = await this.prisma.work.findUnique({
          where: { id: workId },
          select: { authorId: true },
        });
        if (workForAuthor) {
          const mapped = await this.emotionMappingService.applyAuthorEmotionTags(
            workId,
            workForAuthor.authorId,
            creationPlanForEmotions.emotionBlueprint,
          );
          if (mapped > 0) {
            this.logger.log(`Auto-mapped ${mapped} author emotion tags for work ${workId}`);
          }
        }
      }
    } catch (e) {
      this.logger.warn(`Failed to apply author emotion tags: ${e}`);
    }

    // 3. Index to Meilisearch (with structured data)
    const [work, worldSettings, storyArc, plan] = await Promise.all([
      this.prisma.work.findUnique({
        where: { id: workId },
        include: {
          author: { select: { displayName: true, name: true } },
          tags: true,
          qualityScore: { select: { overall: true, immersion: true, worldBuilding: true } },
        },
      }),
      this.prisma.worldSetting.findMany({
        where: { workId, isActive: true },
        select: { name: true, category: true },
        take: 20,
      }),
      this.prisma.storyArc.findUnique({
        where: { workId },
        select: { premise: true },
      }),
      this.prisma.workCreationPlan.findUnique({
        where: { workId },
        select: { emotionBlueprint: true, worldBuildingData: true },
      }),
    ]);
    if (work) {
      const emotionTags = await this.emotionsService.getAggregatedEmotionTags(workId);

      // Build world keywords from WorldSetting + worldBuildingData
      const worldKeywords: string[] = worldSettings.map((ws) => ws.name);
      const wb = plan?.worldBuildingData as any;
      if (wb) {
        if (wb.basics?.era) worldKeywords.push(wb.basics.era);
        if (wb.basics?.setting) worldKeywords.push(wb.basics.setting);
        for (const term of (wb.terminology || []).slice(0, 10)) {
          if (term.term) worldKeywords.push(term.term);
        }
      }

      // Build emotion keywords from emotionBlueprint
      const emotionKeywords: string[] = [];
      const eb = plan?.emotionBlueprint as any;
      if (eb) {
        if (eb.targetEmotions) emotionKeywords.push(eb.targetEmotions);
        if (eb.coreMessage) emotionKeywords.push(eb.coreMessage);
      }

      await this.searchService.indexWork({
        id: work.id,
        title: work.title,
        synopsis: work.synopsis || '',
        genre: work.genre || '',
        authorName: work.author.displayName || work.author.name,
        tags: work.tags.map((t) => t.tag),
        emotionTags: emotionTags.map((et) => et.tag?.name || '').filter(Boolean),
        worldKeywords: [...new Set(worldKeywords)],
        emotionKeywords,
        premise: storyArc?.premise || '',
        qualityScore: work.qualityScore?.overall || 0,
        immersionScore: work.qualityScore?.immersion || 0,
        worldBuildingScore: work.qualityScore?.worldBuilding || 0,
        totalViews: work.totalViews,
        totalReads: work.totalReads,
        publishedAt: work.publishedAt?.getTime() || 0,
      });
      this.logger.log(`Indexed work ${workId} to search`);
    }
  }

  async getEmotionProfile(workId: string) {
    const plan = await this.prisma.workCreationPlan.findUnique({
      where: { workId },
      select: { emotionBlueprint: true },
    });

    const authorTagNames = plan
      ? this.emotionMappingService.mapBlueprintToTags(plan.emotionBlueprint)
      : [];

    const allTags = await this.prisma.emotionTagMaster.findMany();
    const tagNameJaMap = new Map(allTags.map((t) => [t.name, t.nameJa || t.name]));

    const authorEmotions = authorTagNames.map((name) => ({
      tag: name,
      tagJa: tagNameJaMap.get(name) || name,
    }));

    const readerEmotions = await this.emotionsService.getAggregatedEmotionTags(workId);

    return {
      authorEmotions,
      readerEmotions: readerEmotions.map((re: any) => ({
        tag: re.tag?.name || '',
        tagJa: re.tag?.nameJa || re.tag?.name || '',
        count: re.count,
        avgIntensity: re.avgIntensity,
      })),
    };
  }

  async getEmotionArc(workId: string) {
    const plan = await this.prisma.workCreationPlan.findUnique({
      where: { workId },
      select: { emotionBlueprint: true, isEmotionPublic: true },
    });

    let authorArc: { phase: string; emotion: string; intensity: number }[] = [];
    if (plan?.isEmotionPublic && plan.emotionBlueprint) {
      const eb = plan.emotionBlueprint as any;
      if (eb.readerJourney) {
        const lines = String(eb.readerJourney).split(/[→、,\n]/).map((s: string) => s.trim()).filter(Boolean);
        const phases = ['序', '破', '急'];
        authorArc = lines.slice(0, 3).map((line: string, i: number) => ({
          phase: phases[i] || `${i + 1}`,
          emotion: line,
          intensity: Math.round(((i + 1) / Math.max(lines.length, 1)) * 10),
        }));
      }
    }

    const readerEmotions = await this.emotionsService.getAggregatedEmotionTags(workId);
    const allTags = await this.prisma.emotionTagMaster.findMany();
    const tagNameJaMap = new Map(allTags.map((t) => [t.name, t.nameJa || t.name]));

    return {
      authorArc,
      readerTags: readerEmotions.map((re: any) => ({
        tag: re.tag?.name || '',
        tagJa: tagNameJaMap.get(re.tag?.name) || re.tag?.name || '',
        count: re.count,
        avgIntensity: re.avgIntensity,
      })),
    };
  }
}

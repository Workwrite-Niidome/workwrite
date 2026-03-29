import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { MeiliSearch, Index } from 'meilisearch';

export interface WorkDocument {
  id: string;
  title: string;
  synopsis: string;
  genre: string;
  authorName: string;
  tags: string[];
  emotionTags: string[];
  worldKeywords: string[];
  emotionKeywords: string[];
  premise: string;
  qualityScore: number;
  immersionScore: number;
  worldBuildingScore: number;
  totalViews: number;
  totalReads: number;
  publishedAt: number;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private client: MeiliSearch;
  private worksIndex: Index | null = null;
  private meiliAvailable = false;
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.client = new MeiliSearch({
      host: this.config.get('MEILI_HOST', 'http://localhost:7700'),
      apiKey: this.config.get('MEILI_MASTER_KEY'),
    });
  }

  async onModuleInit() {
    try {
      this.worksIndex = this.client.index('works');
      await this.client.createIndex('works', { primaryKey: 'id' });
      await this.worksIndex.updateSettings({
        searchableAttributes: ['title', 'synopsis', 'authorName', 'tags', 'emotionTags', 'worldKeywords', 'emotionKeywords', 'premise'],
        filterableAttributes: ['genre', 'tags', 'emotionTags', 'qualityScore', 'totalViews', 'immersionScore', 'worldBuildingScore'],
        sortableAttributes: ['qualityScore', 'totalViews', 'totalReads', 'publishedAt', 'immersionScore', 'worldBuildingScore'],
        rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
      });
      this.meiliAvailable = true;
      this.logger.log('Meilisearch connected and configured');
    } catch (e) {
      this.meiliAvailable = false;
      this.logger.warn('Meilisearch not available, using PostgreSQL fallback for search');
    }
  }

  async indexWork(doc: WorkDocument) {
    if (!this.meiliAvailable || !this.worksIndex) return;
    try {
      await this.worksIndex.addDocuments([doc]);
    } catch (e) {
      this.logger.warn('Failed to index work', e);
    }
  }

  async removeWork(id: string) {
    if (!this.meiliAvailable || !this.worksIndex) return;
    try {
      await this.worksIndex.deleteDocument(id);
    } catch (e) {
      this.logger.warn('Failed to remove work from index', e);
    }
  }

  async search(query: string, options?: {
    genre?: string;
    emotionTags?: string[];
    limit?: number;
    offset?: number;
    sort?: string;
    category?: string;
    aiGenerated?: boolean;
  }) {
    // Category/AI filters require Postgres (Meili doesn't have these fields)
    // Popular sort uses ReadingProgress data which only exists in Postgres
    if (options?.category || options?.aiGenerated || options?.sort === 'popular') {
      return this.searchPostgres(query, options);
    }
    if (this.meiliAvailable && this.worksIndex) {
      return this.searchMeili(query, options);
    }
    return this.searchPostgres(query, options);
  }

  private async searchMeili(query: string, options?: {
    genre?: string;
    emotionTags?: string[];
    limit?: number;
    offset?: number;
    sort?: string;
  }) {
    try {
      const filter: string[] = [];
      if (options?.genre) filter.push(`genre = "${options.genre}"`);
      if (options?.emotionTags?.length) {
        const tagFilters = options.emotionTags.map((t) => `emotionTags = "${t}"`);
        filter.push(`(${tagFilters.join(' OR ')})`);
      }

      const sortMap: Record<string, string[]> = {
        newest: ['publishedAt:desc'],
        score: ['qualityScore:desc'],
      };

      const result = await this.worksIndex!.search(query, {
        limit: options?.limit ?? 20,
        offset: options?.offset ?? 0,
        filter: filter.length > 0 ? filter.join(' AND ') : undefined,
        sort: options?.sort && sortMap[options.sort] ? sortMap[options.sort] : undefined,
      });

      return {
        hits: result.hits,
        total: result.estimatedTotalHits ?? 0,
        processingTimeMs: result.processingTimeMs,
      };
    } catch {
      // Meilisearch failed at runtime, fall back to Postgres
      this.logger.warn('Meilisearch search failed, falling back to PostgreSQL');
      return this.searchPostgres(query, options);
    }
  }

  private async searchPostgres(query: string, options?: {
    genre?: string;
    emotionTags?: string[];
    limit?: number;
    offset?: number;
    sort?: string;
    category?: string;
    aiGenerated?: boolean;
  }) {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const where: any = { status: 'PUBLISHED' };

    // Only apply text search if query is non-empty
    if (query && query.trim()) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { synopsis: { contains: query, mode: 'insensitive' } },
        { author: { name: { contains: query, mode: 'insensitive' } } },
        { author: { displayName: { contains: query, mode: 'insensitive' } } },
        { tags: { some: { tag: { contains: query, mode: 'insensitive' } } } },
      ];
    }

    if (options?.genre) {
      where.genre = options.genre;
    }

    // Category filters
    if (options?.category === 'hidden-gems') {
      const allScores = await this.prisma.qualityScore.findMany({
        select: { overall: true },
        orderBy: { overall: 'asc' },
      });
      const median = allScores.length > 0
        ? allScores[Math.floor(allScores.length / 2)].overall
        : 50;
      const threshold = Math.max(median * 1.1, 50);
      where.qualityScore = { overall: { gte: threshold } };
      where.totalViews = { lt: 300 };
    }

    if (options?.aiGenerated === true || options?.category === 'ai') {
      where.isAiGenerated = true;
    }

    // Popular sort: use 30-day distinct reader count (same as top page)
    if (options?.sort === 'popular') {
      return this.searchPopularPostgres(query, where, limit, offset);
    }

    let orderBy: any = { publishedAt: 'desc' };
    let scoreSort = false;
    if (options?.sort === 'score') {
      orderBy = { qualityScore: { overall: 'desc' } };
      scoreSort = true;
    } else if (options?.sort === 'newest') {
      orderBy = { publishedAt: 'desc' };
    }

    const [works, total] = await Promise.all([
      this.prisma.work.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
          tags: true,
          qualityScore: { select: { overall: true } },
          _count: { select: { episodes: true, reviews: true } },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.work.count({ where }),
    ]);

    // When sorting by score, push works without scores to the end
    const sorted = scoreSort
      ? [...works].sort((a, b) => {
          const sa = a.qualityScore?.overall ?? -1;
          const sb = b.qualityScore?.overall ?? -1;
          return sb - sa;
        })
      : works;

    return {
      hits: sorted.map((w) => ({
        ...w,
        authorName: w.author?.displayName || w.author?.name || '',
        publishedAt: w.publishedAt?.getTime() || 0,
      })),
      total,
      processingTimeMs: 0,
    };
  }

  private async searchPopularPostgres(query: string, where: any, limit: number, offset: number) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get work IDs ranked by distinct readers in last 30 days
    // Identical to DiscoverService.getPopularWorks: LIMIT, filter, fallback
    const fetchLimit = (limit + offset) * 2;
    const recentActivity = await this.prisma.$queryRaw<
      { workId: string; userCount: bigint }[]
    >`
      SELECT "workId", COUNT(DISTINCT "userId") AS "userCount"
      FROM "ReadingProgress"
      WHERE "updatedAt" >= ${thirtyDaysAgo}
      GROUP BY "workId"
      ORDER BY "userCount" DESC
      LIMIT ${fetchLimit}
    `;

    // Fallback: no reading activity at all → sort by totalViews
    const qualityWhere = { ...where, qualityScore: { overall: { gte: 70 } } };

    if (recentActivity.length === 0) {
      const [works, total] = await Promise.all([
        this.prisma.work.findMany({
          where: qualityWhere,
          include: {
            author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
            tags: true,
            qualityScore: { select: { overall: true } },
            _count: { select: { episodes: true, reviews: true } },
          },
          orderBy: { totalViews: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.work.count({ where: qualityWhere }),
      ]);
      return {
        hits: works.map((w) => ({
          ...w,
          authorName: w.author?.displayName || w.author?.name || '',
          publishedAt: w.publishedAt?.getTime() || 0,
        })),
        total,
        processingTimeMs: 0,
      };
    }

    // Filter: at least 2 distinct readers, fallback to all if none qualify
    const qualifiedActivity = recentActivity.filter((r) => Number(r.userCount) >= 2);
    const popularWorkIds = (qualifiedActivity.length > 0 ? qualifiedActivity : recentActivity).map((r) => r.workId);

    // Fetch works matching both search filters and popular IDs
    const popularWhere = {
      ...qualityWhere,
      id: { in: popularWorkIds },
    };
    const [works, total] = await Promise.all([
      this.prisma.work.findMany({
        where: popularWhere,
        include: {
          author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
          tags: true,
          qualityScore: { select: { overall: true } },
          _count: { select: { episodes: true, reviews: true } },
        },
      }),
      this.prisma.work.count({ where: popularWhere }),
    ]);

    // Sort by reader count order (same as top page)
    const workMap = new Map(works.map((w) => [w.id, w]));
    const sorted = popularWorkIds
      .map((id) => workMap.get(id))
      .filter(Boolean)
      .slice(offset, offset + limit) as typeof works;

    return {
      hits: sorted.map((w) => ({
        ...w,
        authorName: w.author?.displayName || w.author?.name || '',
        publishedAt: w.publishedAt?.getTime() || 0,
      })),
      total,
      processingTimeMs: 0,
    };
  }
}

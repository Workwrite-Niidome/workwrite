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
    if (options?.category || options?.aiGenerated) {
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
        popular: ['totalViews:desc'],
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
      const avg = await this.prisma.qualityScore.aggregate({ _avg: { overall: true } });
      where.qualityScore = { overall: { gte: (avg._avg.overall ?? 50) * 1.2 } };
      where.totalViews = { lt: 100 };
    }

    if (options?.aiGenerated === true || options?.category === 'ai') {
      where.isAiGenerated = true;
    }

    let orderBy: any = { publishedAt: 'desc' };
    let scoreSort = false;
    if (options?.sort === 'score') {
      orderBy = { qualityScore: { overall: 'desc' } };
      scoreSort = true;
    } else if (options?.sort === 'newest') {
      orderBy = { publishedAt: 'desc' };
    } else if (options?.sort === 'popular') {
      orderBy = { totalViews: 'desc' };
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
}

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch, Index } from 'meilisearch';

export interface WorkDocument {
  id: string;
  title: string;
  synopsis: string;
  genre: string;
  authorName: string;
  tags: string[];
  emotionTags: string[];
  qualityScore: number;
  totalViews: number;
  totalReads: number;
  publishedAt: number;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private client: MeiliSearch;
  private worksIndex: Index;
  private readonly logger = new Logger(SearchService.name);

  constructor(private config: ConfigService) {
    this.client = new MeiliSearch({
      host: this.config.get('MEILI_HOST', 'http://localhost:7700'),
      apiKey: this.config.get('MEILI_MASTER_KEY', 'ultra_reader_meili_dev_key'),
    });
  }

  async onModuleInit() {
    try {
      this.worksIndex = this.client.index('works');
      await this.client.createIndex('works', { primaryKey: 'id' });
      await this.worksIndex.updateSettings({
        searchableAttributes: ['title', 'synopsis', 'authorName', 'tags', 'emotionTags'],
        filterableAttributes: ['genre', 'tags', 'emotionTags', 'qualityScore', 'totalViews'],
        sortableAttributes: ['qualityScore', 'totalViews', 'totalReads', 'publishedAt'],
        rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
      });
    } catch (e) {
      this.logger.warn('Meilisearch initialization failed (service may not be running)', e);
    }
  }

  async indexWork(doc: WorkDocument) {
    try {
      await this.worksIndex.addDocuments([doc]);
    } catch (e) {
      this.logger.warn('Failed to index work', e);
    }
  }

  async removeWork(id: string) {
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
  }) {
    try {
      const filter: string[] = [];
      if (options?.genre) filter.push(`genre = "${options.genre}"`);
      if (options?.emotionTags?.length) {
        const tagFilters = options.emotionTags.map((t) => `emotionTags = "${t}"`);
        filter.push(`(${tagFilters.join(' OR ')})`);
      }

      const result = await this.worksIndex.search(query, {
        limit: options?.limit ?? 20,
        offset: options?.offset ?? 0,
        filter: filter.length > 0 ? filter.join(' AND ') : undefined,
      });

      return {
        hits: result.hits,
        total: result.estimatedTotalHits ?? 0,
        processingTimeMs: result.processingTimeMs,
      };
    } catch {
      return { hits: [], total: 0, processingTimeMs: 0 };
    }
  }
}

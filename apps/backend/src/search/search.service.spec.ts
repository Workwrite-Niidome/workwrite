import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';

// Mock MeiliSearch before importing
jest.mock('meilisearch', () => {
  const mockSearch = jest.fn();
  const mockAddDocuments = jest.fn();
  const mockDeleteDocument = jest.fn();
  const mockUpdateSettings = jest.fn();
  const mockIndex = jest.fn(() => ({
    search: mockSearch,
    addDocuments: mockAddDocuments,
    deleteDocument: mockDeleteDocument,
    updateSettings: mockUpdateSettings,
  }));
  return {
    MeiliSearch: jest.fn(() => ({
      index: mockIndex,
      createIndex: jest.fn(),
    })),
    Index: jest.fn(),
    __mockSearch: mockSearch,
    __mockAddDocuments: mockAddDocuments,
    __mockDeleteDocument: mockDeleteDocument,
  };
});

const { __mockSearch, __mockAddDocuments, __mockDeleteDocument } = require('meilisearch');

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: string) => defaultValue),
          },
        },
        { provide: PrismaService, useValue: {
          work: {
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
          },
        } },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    // Initialize the index
    await service.onModuleInit();
  });

  describe('search', () => {
    it('should search with default options', async () => {
      __mockSearch.mockResolvedValue({
        hits: [{ id: '1', title: 'Test' }],
        estimatedTotalHits: 1,
        processingTimeMs: 5,
      });

      const result = await service.search('test');

      expect(result.hits).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(__mockSearch).toHaveBeenCalledWith('test', {
        limit: 20,
        offset: 0,
        filter: undefined,
        sort: undefined,
      });
    });

    it('should apply genre filter', async () => {
      __mockSearch.mockResolvedValue({ hits: [], estimatedTotalHits: 0, processingTimeMs: 1 });

      await service.search('test', { genre: 'fantasy' });

      expect(__mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({
        filter: 'genre = "fantasy"',
      }));
    });

    it('should apply sort for newest', async () => {
      __mockSearch.mockResolvedValue({ hits: [], estimatedTotalHits: 0, processingTimeMs: 1 });

      await service.search('test', { sort: 'newest' });

      expect(__mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({
        sort: ['publishedAt:desc'],
      }));
    });

    it('should apply sort for score', async () => {
      __mockSearch.mockResolvedValue({ hits: [], estimatedTotalHits: 0, processingTimeMs: 1 });

      await service.search('test', { sort: 'score' });

      expect(__mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({
        sort: ['qualityScore:desc'],
      }));
    });

    it('should not apply sort for unknown sort value', async () => {
      __mockSearch.mockResolvedValue({ hits: [], estimatedTotalHits: 0, processingTimeMs: 1 });

      await service.search('test', { sort: 'relevance' });

      expect(__mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({
        sort: undefined,
      }));
    });

    it('should apply pagination', async () => {
      __mockSearch.mockResolvedValue({ hits: [], estimatedTotalHits: 0, processingTimeMs: 1 });

      await service.search('test', { limit: 10, offset: 20 });

      expect(__mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({
        limit: 10,
        offset: 20,
      }));
    });

    it('should apply emotion tag filters', async () => {
      __mockSearch.mockResolvedValue({ hits: [], estimatedTotalHits: 0, processingTimeMs: 1 });

      await service.search('test', { emotionTags: ['exciting', 'sad'] });

      expect(__mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({
        filter: '(emotionTags = "exciting" OR emotionTags = "sad")',
      }));
    });

    it('should return empty results on error', async () => {
      __mockSearch.mockRejectedValue(new Error('Connection failed'));

      const result = await service.search('test');

      expect(result).toEqual({ hits: [], total: 0, processingTimeMs: 0 });
    });
  });

  describe('indexWork', () => {
    it('should index a work document', async () => {
      __mockAddDocuments.mockResolvedValue({ taskUid: 1 });

      await service.indexWork({
        id: '1',
        title: 'Test',
        synopsis: '',
        genre: 'fantasy',
        authorName: 'Author',
        tags: [],
        emotionTags: [],
        worldKeywords: [],
        emotionKeywords: [],
        premise: '',
        qualityScore: 80,
        immersionScore: 0,
        worldBuildingScore: 0,
        totalViews: 100,
        totalReads: 50,
        publishedAt: Date.now(),
      });

      expect(__mockAddDocuments).toHaveBeenCalled();
    });
  });

  describe('removeWork', () => {
    it('should remove a work from index', async () => {
      __mockDeleteDocument.mockResolvedValue({ taskUid: 2 });

      await service.removeWork('1');

      expect(__mockDeleteDocument).toHaveBeenCalledWith('1');
    });
  });
});

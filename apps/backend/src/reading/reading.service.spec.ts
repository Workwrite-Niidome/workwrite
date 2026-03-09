import { Test, TestingModule } from '@nestjs/testing';
import { ReadingService } from './reading.service';
import { PrismaService } from '../common/prisma/prisma.service';

const mockPrismaService = () => ({
  readingProgress: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  bookshelfEntry: {
    upsert: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  work: {
    update: jest.fn(),
  },
  userEmotionTag: {
    findMany: jest.fn(),
  },
});

describe('ReadingService', () => {
  let service: ReadingService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ReadingService>(ReadingService);
  });

  describe('getStats', () => {
    it('should return aggregated reading statistics', async () => {
      prisma.bookshelfEntry.count.mockResolvedValue(5);
      prisma.readingProgress.count
        .mockResolvedValueOnce(20) // completedEpisodes
        .mockResolvedValue(0); // monthly counts
      prisma.readingProgress.aggregate.mockResolvedValue({ _sum: { readTimeMs: 3600000 } });
      prisma.userEmotionTag.findMany.mockResolvedValue([
        { tagId: 't-1', tag: { name: 'exciting', nameJa: 'ワクワク' } },
        { tagId: 't-1', tag: { name: 'exciting', nameJa: 'ワクワク' } },
        { tagId: 't-2', tag: { name: 'sad', nameJa: '切ない' } },
      ]);
      prisma.bookshelfEntry.findMany.mockResolvedValue([
        { work: { genre: 'fantasy' } },
        { work: { genre: 'fantasy' } },
        { work: { genre: 'romance' } },
      ]);
      prisma.readingProgress.findMany.mockResolvedValue([]);

      const result = await service.getStats('user-1');

      expect(result.completedWorks).toBe(5);
      expect(result.completedEpisodes).toBe(20);
      expect(result.totalReadTimeMs).toBe(3600000);
      expect(result.genreDistribution).toEqual({ fantasy: 2, romance: 1 });
      expect(result.topEmotionTags).toHaveLength(2);
      expect(result.topEmotionTags[0]).toEqual({ name: 'exciting', nameJa: 'ワクワク', count: 2 });
      expect(result.monthlyActivity).toHaveLength(12);
    });

    it('should return 0 totalReadTimeMs when no reading data', async () => {
      prisma.bookshelfEntry.count.mockResolvedValue(0);
      prisma.readingProgress.count.mockResolvedValue(0);
      prisma.readingProgress.aggregate.mockResolvedValue({ _sum: { readTimeMs: null } });
      prisma.userEmotionTag.findMany.mockResolvedValue([]);
      prisma.bookshelfEntry.findMany.mockResolvedValue([]);
      prisma.readingProgress.findMany.mockResolvedValue([]);

      const result = await service.getStats('user-1');

      expect(result.totalReadTimeMs).toBe(0);
      expect(result.completedWorks).toBe(0);
      expect(result.genreDistribution).toEqual({});
      expect(result.topEmotionTags).toEqual([]);
    });

    it('should calculate reading streaks from consecutive days', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      prisma.bookshelfEntry.count.mockResolvedValue(0);
      prisma.readingProgress.count.mockResolvedValue(0);
      prisma.readingProgress.aggregate.mockResolvedValue({ _sum: { readTimeMs: null } });
      prisma.userEmotionTag.findMany.mockResolvedValue([]);
      prisma.bookshelfEntry.findMany.mockResolvedValue([]);
      prisma.readingProgress.findMany.mockResolvedValue([
        { updatedAt: today },
        { updatedAt: yesterday },
        { updatedAt: twoDaysAgo },
      ]);

      const result = await service.getStats('user-1');

      expect(result.currentStreak).toBe(3);
      expect(result.maxStreak).toBe(3);
    });
  });

  describe('getProgress', () => {
    it('should return reading progress for a work', async () => {
      const mockProgress = [
        { episodeId: 'ep-1', progressPct: 1.0, completed: true, episode: { id: 'ep-1', title: 'Ch 1', orderIndex: 0 } },
        { episodeId: 'ep-2', progressPct: 0.5, completed: false, episode: { id: 'ep-2', title: 'Ch 2', orderIndex: 1 } },
      ];
      prisma.readingProgress.findMany.mockResolvedValue(mockProgress);

      const result = await service.getProgress('user-1', 'work-1');

      expect(result).toEqual(mockProgress);
    });
  });

  describe('getResumePosition', () => {
    it('should return the latest incomplete episode', async () => {
      prisma.readingProgress.findFirst.mockResolvedValueOnce({
        episodeId: 'ep-3',
        completed: false,
        episode: { id: 'ep-3', title: 'Ch 3', orderIndex: 2 },
      });

      const result = await service.getResumePosition('user-1', 'work-1');

      expect(result?.episodeId).toBe('ep-3');
    });

    it('should return last completed episode when all are done', async () => {
      prisma.readingProgress.findFirst
        .mockResolvedValueOnce(null) // no incomplete
        .mockResolvedValueOnce({
          episodeId: 'ep-5',
          completed: true,
          episode: { id: 'ep-5', title: 'Ch 5', orderIndex: 4 },
        });

      const result = await service.getResumePosition('user-1', 'work-1');

      expect(result?.episodeId).toBe('ep-5');
    });
  });
});

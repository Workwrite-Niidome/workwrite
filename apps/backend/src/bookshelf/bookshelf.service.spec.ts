import { Test, TestingModule } from '@nestjs/testing';
import { BookshelfService } from './bookshelf.service';
import { PrismaService } from '../common/prisma/prisma.service';

const mockPrismaService = () => ({
  bookshelfEntry: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  readingProgress: {
    count: jest.fn(),
    findFirst: jest.fn(),
  },
});

describe('BookshelfService', () => {
  let service: BookshelfService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookshelfService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<BookshelfService>(BookshelfService);
  });

  describe('getBookshelf', () => {
    it('should return bookshelf entries enriched with progress', async () => {
      prisma.bookshelfEntry.findMany.mockResolvedValue([
        {
          workId: 'work-1',
          status: 'READING',
          work: {
            id: 'work-1',
            title: 'Novel A',
            _count: { episodes: 10 },
            author: { id: 'a-1', name: 'Author', displayName: null },
            qualityScore: { overall: 85 },
          },
        },
      ]);
      prisma.readingProgress.count.mockResolvedValue(3);
      prisma.readingProgress.findFirst.mockResolvedValue({
        episode: { id: 'ep-5', title: 'Chapter 5' },
      });

      const result = await service.getBookshelf('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].progressPct).toBe(0.3); // 3/10
      expect(result[0].currentEpisode).toEqual({ id: 'ep-5', title: 'Chapter 5' });
    });

    it('should return 0 progress when work has no episodes', async () => {
      prisma.bookshelfEntry.findMany.mockResolvedValue([
        {
          workId: 'work-2',
          status: 'WANT_TO_READ',
          work: { id: 'work-2', title: 'Novel B', _count: { episodes: 0 } },
        },
      ]);

      const result = await service.getBookshelf('user-1');

      expect(result[0].progressPct).toBe(0);
      expect(result[0].currentEpisode).toBeNull();
    });

    it('should filter by status when provided', async () => {
      prisma.bookshelfEntry.findMany.mockResolvedValue([]);

      await service.getBookshelf('user-1', 'COMPLETED' as any);

      expect(prisma.bookshelfEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: 'COMPLETED' },
        }),
      );
    });
  });

  describe('addToBookshelf', () => {
    it('should add work with WANT_TO_READ status', async () => {
      prisma.bookshelfEntry.upsert.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'WANT_TO_READ',
      });

      const result = await service.addToBookshelf('user-1', 'work-1');

      expect(result.status).toBe('WANT_TO_READ');
      expect(prisma.bookshelfEntry.upsert).toHaveBeenCalledWith({
        where: { userId_workId: { userId: 'user-1', workId: 'work-1' } },
        update: {},
        create: { userId: 'user-1', workId: 'work-1', status: 'WANT_TO_READ' },
      });
    });
  });

  describe('updateStatus', () => {
    it('should update bookshelf status', async () => {
      prisma.bookshelfEntry.upsert.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'READING',
      });

      const result = await service.updateStatus('user-1', 'work-1', 'READING' as any);

      expect(result.status).toBe('READING');
    });
  });

  describe('removeFromBookshelf', () => {
    it('should remove work from bookshelf', async () => {
      prisma.bookshelfEntry.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removeFromBookshelf('user-1', 'work-1');

      expect(result).toEqual({ deleted: true });
    });
  });
});

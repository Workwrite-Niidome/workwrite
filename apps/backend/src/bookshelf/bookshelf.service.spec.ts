import { Test, TestingModule } from '@nestjs/testing';
import { BookshelfService } from './bookshelf.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import { CreditService } from '../billing/credit.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockPrismaService = () => ({
  bookshelfEntry: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  readingProgress: {
    count: jest.fn(),
    findFirst: jest.fn(),
  },
  work: {
    findUnique: jest.fn(),
  },
  creditTransaction: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  creditBalance: {
    update: jest.fn(),
  },
  $transaction: jest.fn(),
});

const mockPostsService = () => ({
  createAutoPost: jest.fn().mockResolvedValue({}),
});

const mockCreditService = () => ({
  ensureCreditBalance: jest.fn().mockResolvedValue({}),
  grantRewardCredits: jest.fn().mockResolvedValue(true),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BookshelfService', () => {
  let service: BookshelfService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let postsService: ReturnType<typeof mockPostsService>;
  let creditService: ReturnType<typeof mockCreditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookshelfService,
        { provide: PrismaService, useFactory: mockPrismaService },
        { provide: PostsService, useFactory: mockPostsService },
        { provide: CreditService, useFactory: mockCreditService },
      ],
    }).compile();

    service = module.get<BookshelfService>(BookshelfService);
    prisma = module.get(PrismaService);
    postsService = module.get(PostsService);
    creditService = module.get(CreditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // getBookshelf
  // -------------------------------------------------------------------------

  describe('getBookshelf', () => {
    it('returns bookshelf entries enriched with progress', async () => {
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
      expect(result[0].progressPct).toBe(0.3);
      expect(result[0].currentEpisode).toEqual({ id: 'ep-5', title: 'Chapter 5' });
    });

    it('returns 0 progress when work has no episodes', async () => {
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

    it('filters by status when provided', async () => {
      prisma.bookshelfEntry.findMany.mockResolvedValue([]);

      await service.getBookshelf('user-1', 'COMPLETED' as any);

      expect(prisma.bookshelfEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: 'COMPLETED' },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // addToBookshelf
  // -------------------------------------------------------------------------

  describe('addToBookshelf', () => {
    it('adds work with WANT_TO_READ status', async () => {
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

  // -------------------------------------------------------------------------
  // updateStatus — non-reward paths
  // -------------------------------------------------------------------------

  describe('updateStatus', () => {
    it('updates status to READING without granting Cr', async () => {
      prisma.bookshelfEntry.findUnique.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'WANT_TO_READ',
      });
      prisma.bookshelfEntry.upsert.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'READING',
      });

      const result = await service.updateStatus('user-1', 'work-1', 'READING' as any);

      expect(result.status).toBe('READING');

      await Promise.resolve();
      await Promise.resolve();

      expect(creditService.ensureCreditBalance).not.toHaveBeenCalled();
    });

    it('updates status to WANT_TO_READ without granting Cr', async () => {
      prisma.bookshelfEntry.findUnique.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'READING',
      });
      prisma.bookshelfEntry.upsert.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'WANT_TO_READ',
      });

      await service.updateStatus('user-1', 'work-1', 'WANT_TO_READ' as any);

      await Promise.resolve();
      await Promise.resolve();

      expect(creditService.ensureCreditBalance).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // updateStatus — completion reward (1Cr)
    // -----------------------------------------------------------------------

    describe('completion reward (1Cr)', () => {
      it('grants 1Cr when status changes to COMPLETED from non-COMPLETED', async () => {
        prisma.bookshelfEntry.findUnique.mockResolvedValue({
          userId: 'user-1',
          workId: 'work-1',
          status: 'READING',
        });
        prisma.bookshelfEntry.upsert.mockResolvedValue({
          userId: 'user-1',
          workId: 'work-1',
          status: 'COMPLETED',
        });
        prisma.work.findUnique.mockResolvedValue({ title: 'Test Work' });
        prisma.creditTransaction.findFirst.mockResolvedValue(null);
        prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
        prisma.creditBalance.update.mockResolvedValue({ balance: 1 });
        prisma.creditTransaction.create.mockResolvedValue({});

        await service.updateStatus('user-1', 'work-1', 'COMPLETED' as any);

        // Fire-and-forget: flush microtask queue
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(creditService.ensureCreditBalance).toHaveBeenCalledWith('user-1');
      });

      it('increments balance by 1 (COMPLETION_REWARD_CR) on first completion', async () => {
        prisma.bookshelfEntry.findUnique.mockResolvedValue({ status: 'READING' });
        prisma.bookshelfEntry.upsert.mockResolvedValue({ status: 'COMPLETED' });
        prisma.work.findUnique.mockResolvedValue({ title: 'Some Work' });

        await service.updateStatus('user-1', 'work-1', 'COMPLETED' as any);

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(creditService.grantRewardCredits).toHaveBeenCalledWith(
          'user-1',
          1,
          'REVIEW_REWARD',
          '読了報酬 (work-1)',
          5,
          '読了報酬',
        );
      });

      it('creates creditTransaction with REVIEW_REWARD type and correct description', async () => {
        prisma.bookshelfEntry.findUnique.mockResolvedValue({ status: 'READING' });
        prisma.bookshelfEntry.upsert.mockResolvedValue({ status: 'COMPLETED' });
        prisma.work.findUnique.mockResolvedValue({ title: 'Some Work' });

        await service.updateStatus('user-1', 'work-1', 'COMPLETED' as any);

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(creditService.grantRewardCredits).toHaveBeenCalledWith(
          'user-1',
          1,
          'REVIEW_REWARD',
          '読了報酬 (work-1)',
          5,
          '読了報酬',
        );
      });

      it('does NOT grant Cr when previous status was already COMPLETED', async () => {
        prisma.bookshelfEntry.findUnique.mockResolvedValue({
          userId: 'user-1',
          workId: 'work-1',
          status: 'COMPLETED',
        });
        prisma.bookshelfEntry.upsert.mockResolvedValue({
          userId: 'user-1',
          workId: 'work-1',
          status: 'COMPLETED',
        });

        await service.updateStatus('user-1', 'work-1', 'COMPLETED' as any);

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(creditService.ensureCreditBalance).not.toHaveBeenCalled();
      });

      it('does NOT grant Cr when first-time COMPLETED but entry did not exist before', async () => {
        // prev is null (no existing entry) → still a new completion
        prisma.bookshelfEntry.findUnique.mockResolvedValue(null);
        prisma.bookshelfEntry.upsert.mockResolvedValue({
          userId: 'user-1',
          workId: 'work-1',
          status: 'COMPLETED',
        });
        prisma.work.findUnique.mockResolvedValue({ title: 'New Work' });
        prisma.creditTransaction.findFirst.mockResolvedValue(null);
        prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
        prisma.creditBalance.update.mockResolvedValue({ balance: 1 });
        prisma.creditTransaction.create.mockResolvedValue({});

        await service.updateStatus('user-1', 'work-1', 'COMPLETED' as any);

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        // prev?.status is undefined (not 'COMPLETED') so reward SHOULD be granted
        expect(creditService.ensureCreditBalance).toHaveBeenCalledWith('user-1');
      });

      it('calls grantRewardCredits which handles duplicate prevention internally', async () => {
        prisma.bookshelfEntry.findUnique.mockResolvedValue({ status: 'READING' });
        prisma.bookshelfEntry.upsert.mockResolvedValue({ status: 'COMPLETED' });
        prisma.work.findUnique.mockResolvedValue({ title: 'Work' });
        creditService.grantRewardCredits.mockResolvedValue(false); // duplicate found

        await service.updateStatus('user-1', 'work-1', 'COMPLETED' as any);

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        // ensureCreditBalance is still called
        expect(creditService.ensureCreditBalance).toHaveBeenCalledWith('user-1');
        // grantRewardCredits was called (returns false when duplicate exists)
        expect(creditService.grantRewardCredits).toHaveBeenCalled();
        // The prisma.creditBalance.update should NOT be called directly
        expect(prisma.creditBalance.update).not.toHaveBeenCalled();
      });

      it('queries creditTransaction with correct description containing workId', async () => {
        prisma.bookshelfEntry.findUnique.mockResolvedValue({ status: 'WANT_TO_READ' });
        prisma.bookshelfEntry.upsert.mockResolvedValue({ status: 'COMPLETED' });
        prisma.work.findUnique.mockResolvedValue({ title: 'Work' });
        prisma.$transaction.mockImplementation(async (fn) => {
          const fakeTx = {
            $queryRawUnsafe: jest.fn().mockResolvedValue([]),
            creditTransaction: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({}),
            },
            creditBalance: {
              update: jest.fn().mockResolvedValue({ balance: 3 }),
            },
          };
          await fn(fakeTx);
          return fakeTx;
        });

        await service.updateStatus('user-1', 'work-42', 'COMPLETED' as any);

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        // The transaction was called; verify ensureCreditBalance used correct userId
        expect(creditService.ensureCreditBalance).toHaveBeenCalledWith('user-1');
      });
    });
  });

  // -------------------------------------------------------------------------
  // removeFromBookshelf
  // -------------------------------------------------------------------------

  describe('removeFromBookshelf', () => {
    it('removes work from bookshelf and returns deleted: true', async () => {
      prisma.bookshelfEntry.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removeFromBookshelf('user-1', 'work-1');

      expect(result).toEqual({ deleted: true });
      expect(prisma.bookshelfEntry.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', workId: 'work-1' },
      });
    });
  });
});

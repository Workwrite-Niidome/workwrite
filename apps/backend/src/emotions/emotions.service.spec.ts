import { Test, TestingModule } from '@nestjs/testing';
import { EmotionsService } from './emotions.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreditService } from '../billing/credit.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockPrismaService = () => ({
  emotionTagMaster: {
    findMany: jest.fn(),
  },
  userEmotionTag: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
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

const mockCreditService = () => ({
  ensureCreditBalance: jest.fn().mockResolvedValue({}),
  grantRewardCredits: jest.fn().mockResolvedValue(true),
});

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const makeTag = (tagId: string) => ({
  id: `uet-${tagId}`,
  tagId,
  userId: 'user-1',
  workId: 'work-1',
  intensity: 3,
  tag: { id: tagId, name: `tag-${tagId}`, nameJa: `タグ-${tagId}` },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmotionsService', () => {
  let service: EmotionsService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let creditService: ReturnType<typeof mockCreditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmotionsService,
        { provide: PrismaService, useFactory: mockPrismaService },
        { provide: CreditService, useFactory: mockCreditService },
      ],
    }).compile();

    service = module.get<EmotionsService>(EmotionsService);
    prisma = module.get(PrismaService);
    creditService = module.get(CreditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // addEmotionTag (single) — no reward
  // -------------------------------------------------------------------------

  describe('addEmotionTag', () => {
    it('upserts a single emotion tag with default intensity 3', async () => {
      prisma.userEmotionTag.upsert.mockResolvedValue(makeTag('tag-1'));

      const result = await service.addEmotionTag('user-1', { workId: 'work-1', tagId: 'tag-1' });

      expect(prisma.userEmotionTag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_workId_tagId: { userId: 'user-1', workId: 'work-1', tagId: 'tag-1' } },
          create: expect.objectContaining({ userId: 'user-1', workId: 'work-1', tagId: 'tag-1', intensity: 3 }),
        }),
      );
      expect(result).toEqual(makeTag('tag-1'));
    });

    it('upserts a single emotion tag with custom intensity', async () => {
      prisma.userEmotionTag.upsert.mockResolvedValue({ ...makeTag('tag-2'), intensity: 5 });

      await service.addEmotionTag('user-1', { workId: 'work-1', tagId: 'tag-2', intensity: 5 });

      expect(prisma.userEmotionTag.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { intensity: 5 },
          create: expect.objectContaining({ intensity: 5 }),
        }),
      );
    });

    it('does NOT call ensureCreditBalance (single tag grants no reward)', async () => {
      prisma.userEmotionTag.upsert.mockResolvedValue(makeTag('tag-1'));

      await service.addEmotionTag('user-1', { workId: 'work-1', tagId: 'tag-1' });

      await Promise.resolve();
      await Promise.resolve();

      expect(creditService.ensureCreditBalance).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // addMultipleEmotionTags — emotion tag reward (1Cr)
  // -------------------------------------------------------------------------

  describe('addMultipleEmotionTags', () => {
    describe('with non-empty tags array', () => {
      beforeEach(() => {
        prisma.userEmotionTag.upsert.mockResolvedValue(makeTag('tag-1'));
      });

      it('returns results for all provided tags', async () => {
        prisma.userEmotionTag.upsert
          .mockResolvedValueOnce(makeTag('tag-1'))
          .mockResolvedValueOnce(makeTag('tag-2'));
        prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
        prisma.creditTransaction.findFirst.mockResolvedValue(null);
        prisma.creditBalance.update.mockResolvedValue({ balance: 2 });
        prisma.creditTransaction.create.mockResolvedValue({});

        const result = await service.addMultipleEmotionTags('user-1', 'work-1', [
          { tagId: 'tag-1' },
          { tagId: 'tag-2' },
        ]);

        expect(result).toHaveLength(2);
      });

      it('calls ensureCreditBalance for emotion tag reward', async () => {
        prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
        prisma.creditTransaction.findFirst.mockResolvedValue(null);
        prisma.creditBalance.update.mockResolvedValue({ balance: 2 });
        prisma.creditTransaction.create.mockResolvedValue({});

        await service.addMultipleEmotionTags('user-1', 'work-1', [{ tagId: 'tag-1' }]);

        // Fire-and-forget: flush microtask queue
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(creditService.ensureCreditBalance).toHaveBeenCalledWith('user-1');
      });

      it('increments balance by 1 (EMOTION_TAG_REWARD_CR)', async () => {
        await service.addMultipleEmotionTags('user-1', 'work-1', [{ tagId: 'tag-1' }]);

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(creditService.grantRewardCredits).toHaveBeenCalledWith(
          'user-1',
          1,
          'REVIEW_REWARD',
          '感情タグ報酬 (work-1)',
          5,
          '感情タグ報酬',
        );
      });

      it('creates creditTransaction with REVIEW_REWARD type and correct description', async () => {
        await service.addMultipleEmotionTags('user-1', 'work-42', [{ tagId: 'tag-1' }]);

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(creditService.grantRewardCredits).toHaveBeenCalledWith(
          'user-1',
          1,
          'REVIEW_REWARD',
          '感情タグ報酬 (work-42)',
          5,
          '感情タグ報酬',
        );
      });
    });

    describe('with empty tags array', () => {
      it('returns empty array', async () => {
        const result = await service.addMultipleEmotionTags('user-1', 'work-1', []);

        expect(result).toEqual([]);
      });

      it('does NOT call ensureCreditBalance (no tags = no reward)', async () => {
        await service.addMultipleEmotionTags('user-1', 'work-1', []);

        await Promise.resolve();
        await Promise.resolve();

        expect(creditService.ensureCreditBalance).not.toHaveBeenCalled();
      });

      it('does NOT call $transaction', async () => {
        await service.addMultipleEmotionTags('user-1', 'work-1', []);

        await Promise.resolve();
        await Promise.resolve();

        expect(prisma.$transaction).not.toHaveBeenCalled();
      });
    });

    describe('duplicate reward prevention', () => {
      it('calls grantRewardCredits which handles duplicate prevention internally', async () => {
        prisma.userEmotionTag.upsert.mockResolvedValue(makeTag('tag-1'));
        creditService.grantRewardCredits.mockResolvedValue(false); // duplicate found

        await service.addMultipleEmotionTags('user-1', 'work-1', [{ tagId: 'tag-1' }]);

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        // ensureCreditBalance is still called
        expect(creditService.ensureCreditBalance).toHaveBeenCalledWith('user-1');
        // grantRewardCredits was called (it returns false when duplicate exists)
        expect(creditService.grantRewardCredits).toHaveBeenCalled();
      });
    });
  });

  // -------------------------------------------------------------------------
  // getEmotionTagsForWork
  // -------------------------------------------------------------------------

  describe('getEmotionTagsForWork', () => {
    it('returns all emotion tags for the given work', async () => {
      const tags = [makeTag('tag-1'), makeTag('tag-2')];
      prisma.userEmotionTag.findMany.mockResolvedValue(tags);

      const result = await service.getEmotionTagsForWork('work-1');

      expect(result).toEqual(tags);
      expect(prisma.userEmotionTag.findMany).toHaveBeenCalledWith({
        where: { workId: 'work-1' },
        include: { tag: true },
      });
    });

    it('returns empty array when work has no emotion tags', async () => {
      prisma.userEmotionTag.findMany.mockResolvedValue([]);

      const result = await service.getEmotionTagsForWork('work-empty');

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getAggregatedEmotionTags
  // -------------------------------------------------------------------------

  describe('getAggregatedEmotionTags', () => {
    it('returns aggregated tags with count and avgIntensity', async () => {
      prisma.userEmotionTag.groupBy.mockResolvedValue([
        { tagId: 'tag-1', _count: { id: 5 }, _avg: { intensity: 3.567 } },
      ]);
      prisma.emotionTagMaster.findMany.mockResolvedValue([
        { id: 'tag-1', name: 'joy', nameJa: '喜び' },
      ]);

      const result = await service.getAggregatedEmotionTags('work-1');

      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(5);
      expect(result[0].avgIntensity).toBe(3.6); // rounded to 1 decimal
    });

    it('returns empty array when no tags exist', async () => {
      prisma.userEmotionTag.groupBy.mockResolvedValue([]);
      prisma.emotionTagMaster.findMany.mockResolvedValue([]);

      const result = await service.getAggregatedEmotionTags('work-empty');

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getUserEmotionTagsForWork
  // -------------------------------------------------------------------------

  describe('getUserEmotionTagsForWork', () => {
    it('returns emotion tags filtered by userId and workId', async () => {
      const tags = [makeTag('tag-1')];
      prisma.userEmotionTag.findMany.mockResolvedValue(tags);

      const result = await service.getUserEmotionTagsForWork('user-1', 'work-1');

      expect(result).toEqual(tags);
      expect(prisma.userEmotionTag.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', workId: 'work-1' },
        include: { tag: true },
      });
    });
  });
});

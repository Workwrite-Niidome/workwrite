import { Test, TestingModule } from '@nestjs/testing';
import { CharacterTalkRevenueService } from '../character-talk-revenue.service';
import { PrismaService } from '../../common/prisma/prisma.service';

// ─── Mock factory ─────────────────────────────────────────────────────────────

const mockPrismaService = () => ({
  characterTalkRevenue: {
    create: jest.fn(),
  },
  $queryRaw: jest.fn(),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CharacterTalkRevenueService', () => {
  let service: CharacterTalkRevenueService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterTalkRevenueService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CharacterTalkRevenueService>(CharacterTalkRevenueService);
  });

  // ─── recordRevenue ─────────────────────────────────────────────────────────

  describe('recordRevenue', () => {
    it('calls prisma.characterTalkRevenue.create when purchasedCreditsUsed > 0', async () => {
      prisma.characterTalkRevenue.create.mockResolvedValue({});

      await service.recordRevenue(
        'author-1',
        'reader-1',
        'work-1',
        'char-1',
        'character',
        1,
        1,
        'tx-1',
      );

      expect(prisma.characterTalkRevenue.create).toHaveBeenCalledTimes(1);
    });

    it('does NOT call prisma when purchasedCreditsUsed === 0', async () => {
      await service.recordRevenue(
        'author-1',
        'reader-1',
        'work-1',
        'char-1',
        'character',
        1,
        0,
        'tx-1',
      );

      expect(prisma.characterTalkRevenue.create).not.toHaveBeenCalled();
    });

    it('does NOT call prisma when purchasedCreditsUsed is negative', async () => {
      await service.recordRevenue(
        'author-1',
        'reader-1',
        'work-1',
        null,
        'companion',
        1,
        -1,
      );

      expect(prisma.characterTalkRevenue.create).not.toHaveBeenCalled();
    });

    it('calculates revenueYen as Math.floor(purchasedCreditsUsed * 9.8 * 0.4)', async () => {
      prisma.characterTalkRevenue.create.mockResolvedValue({});

      // 1 credit: Math.floor(1 * 9.8 * 0.4) = Math.floor(3.92) = 3
      await service.recordRevenue('author-1', 'reader-1', 'work-1', null, 'companion', 1, 1);

      expect(prisma.characterTalkRevenue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ revenueYen: 3 }),
        }),
      );
    });

    it('calculates revenueYen correctly for 5 purchased credits', async () => {
      prisma.characterTalkRevenue.create.mockResolvedValue({});

      // 5 credits: Math.floor(5 * 9.8 * 0.4) = Math.floor(19.6) = 19
      await service.recordRevenue('author-1', 'reader-1', 'work-1', null, 'companion', 5, 5);

      expect(prisma.characterTalkRevenue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ revenueYen: 19 }),
        }),
      );
    });

    it('calculates revenueYen correctly for 10 purchased credits', async () => {
      prisma.characterTalkRevenue.create.mockResolvedValue({});

      // 10 credits: Math.floor(10 * 9.8 * 0.4) = Math.floor(39.2) = 39
      await service.recordRevenue('author-1', 'reader-1', 'work-1', null, 'companion', 10, 10);

      expect(prisma.characterTalkRevenue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ revenueYen: 39 }),
        }),
      );
    });

    it('passes all fields correctly to prisma.create', async () => {
      prisma.characterTalkRevenue.create.mockResolvedValue({});

      await service.recordRevenue(
        'author-abc',
        'reader-xyz',
        'work-999',
        'char-42',
        'character',
        1,
        1,
        'tx-999',
      );

      expect(prisma.characterTalkRevenue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          authorId: 'author-abc',
          readerId: 'reader-xyz',
          workId: 'work-999',
          characterId: 'char-42',
          mode: 'character',
          creditAmount: 1,
          revenueYen: 3,
          creditTxId: 'tx-999',
        }),
      });
    });

    it('sets creditTxId to null when creditTxId is not provided', async () => {
      prisma.characterTalkRevenue.create.mockResolvedValue({});

      await service.recordRevenue('author-1', 'reader-1', 'work-1', null, 'companion', 1, 1);

      expect(prisma.characterTalkRevenue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ creditTxId: null }),
        }),
      );
    });

    it('sets characterId to null when characterId is null', async () => {
      prisma.characterTalkRevenue.create.mockResolvedValue({});

      await service.recordRevenue('author-1', 'reader-1', 'work-1', null, 'companion', 1, 1, 'tx-1');

      expect(prisma.characterTalkRevenue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ characterId: null }),
        }),
      );
    });

    it('does not throw when prisma.create fails (error is swallowed)', async () => {
      prisma.characterTalkRevenue.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.recordRevenue('author-1', 'reader-1', 'work-1', null, 'companion', 1, 1, 'tx-1'),
      ).resolves.toBeUndefined();
    });
  });

  // ─── getAuthorEarnings ─────────────────────────────────────────────────────

  describe('getAuthorEarnings', () => {
    it('returns totalRevenue, monthlyRevenue, totalSessions, monthlySessions, platformCutRate', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ sum: 1000, count: BigInt(10) }])
        .mockResolvedValueOnce([{ sum: 300, count: BigInt(3) }]);

      const result = await service.getAuthorEarnings('author-1');

      expect(result).toEqual({
        totalRevenue: 1000,
        monthlyRevenue: 300,
        totalSessions: 10,
        monthlySessions: 3,
        platformCutRate: 0.6,
      });
    });

    it('always returns platformCutRate of 0.6', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ sum: 0, count: BigInt(0) }])
        .mockResolvedValueOnce([{ sum: 0, count: BigInt(0) }]);

      const result = await service.getAuthorEarnings('author-1');

      expect(result.platformCutRate).toBe(0.6);
    });

    it('returns 0 for all numeric fields when no revenue records exist', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ sum: null, count: BigInt(0) }])
        .mockResolvedValueOnce([{ sum: null, count: BigInt(0) }]);

      const result = await service.getAuthorEarnings('author-1');

      expect(result.totalRevenue).toBe(0);
      expect(result.monthlyRevenue).toBe(0);
      expect(result.totalSessions).toBe(0);
      expect(result.monthlySessions).toBe(0);
    });

    it('converts BigInt count to Number', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ sum: 500, count: BigInt(7) }])
        .mockResolvedValueOnce([{ sum: 100, count: BigInt(2) }]);

      const result = await service.getAuthorEarnings('author-1');

      expect(typeof result.totalSessions).toBe('number');
      expect(typeof result.monthlySessions).toBe('number');
      expect(result.totalSessions).toBe(7);
      expect(result.monthlySessions).toBe(2);
    });

    it('handles missing query result rows gracefully', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getAuthorEarnings('author-1');

      expect(result.totalRevenue).toBe(0);
      expect(result.monthlyRevenue).toBe(0);
      expect(result.totalSessions).toBe(0);
      expect(result.monthlySessions).toBe(0);
    });
  });
});

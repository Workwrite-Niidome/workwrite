import { Test, TestingModule } from '@nestjs/testing';
import { CreditService } from '../credit.service';
import { PrismaService } from '../../common/prisma/prisma.service';

// ─── Mock factory ─────────────────────────────────────────────────────────────

const mockPrismaService = () => ({
  creditBalance: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  creditPurchase: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRawUnsafe: jest.fn(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBalance(overrides: Partial<{
  balance: number;
  monthlyBalance: number;
  rewardBalance: number;
  purchasedBalance: number;
  monthlyGranted: number;
  userId: string;
}> = {}) {
  return {
    userId: 'user-1',
    balance: 20,
    monthlyBalance: 20,
    rewardBalance: 0,
    purchasedBalance: 0,
    monthlyGranted: 20,
    lastGrantedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CreditService - purchasedDeducted', () => {
  let service: CreditService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();

    // Default: $transaction executes the callback immediately with the prisma mock
    prisma.$transaction.mockImplementation((cb: (tx: any) => any) => cb(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CreditService>(CreditService);
  });

  // ─── purchasedDeducted in consumeCredits ───────────────────────────────────

  describe('consumeCredits - purchasedDeducted field', () => {
    it('returns purchasedDeducted = 0 when monthly balance covers the full amount', async () => {
      // monthly=30 covers the full cost of 5; no purchased needed
      const bal = makeBalance({ balance: 30, monthlyBalance: 30, purchasedBalance: 0 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1' });

      const result = await service.consumeCredits('user-1', 5, 'character_talk');

      expect(result.purchasedDeducted).toBe(0);
    });

    it('returns purchasedDeducted = 0 when monthly exactly matches the amount', async () => {
      // monthly=5, amount=5: monthlyDeduct=5, purchasedDeduct=0
      const bal = makeBalance({ balance: 5, monthlyBalance: 5, purchasedBalance: 0 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1' });

      const result = await service.consumeCredits('user-1', 5, 'character_talk');

      expect(result.purchasedDeducted).toBe(0);
    });

    it('returns correct purchasedDeducted when monthly is partially insufficient', async () => {
      // monthly=2, amount=5: monthlyDeduct=2, purchasedDeduct=3
      const bal = makeBalance({ balance: 12, monthlyBalance: 2, purchasedBalance: 10 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-2' });

      const result = await service.consumeCredits('user-1', 5, 'character_talk');

      expect(result.purchasedDeducted).toBe(3);
    });

    it('returns purchasedDeducted = 1 when monthly covers 4 out of 5 credits', async () => {
      // monthly=4, amount=5: monthlyDeduct=4, purchasedDeduct=1
      const bal = makeBalance({ balance: 14, monthlyBalance: 4, purchasedBalance: 10 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-3' });

      const result = await service.consumeCredits('user-1', 5, 'character_talk');

      expect(result.purchasedDeducted).toBe(1);
    });

    it('returns purchasedDeducted = full amount when monthly balance is 0', async () => {
      // monthly=0, amount=5: monthlyDeduct=0, purchasedDeduct=5
      const bal = makeBalance({ balance: 10, monthlyBalance: 0, purchasedBalance: 10 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-4' });

      const result = await service.consumeCredits('user-1', 5, 'character_talk');

      expect(result.purchasedDeducted).toBe(5);
    });

    it('returns purchasedDeducted = full amount (1) for Haiku cost when monthly=0', async () => {
      // Haiku costs 1 credit; monthly=0: all from purchased
      const bal = makeBalance({ balance: 5, monthlyBalance: 0, purchasedBalance: 5 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-5' });

      const result = await service.consumeCredits('user-1', 1, 'character_talk');

      expect(result.purchasedDeducted).toBe(1);
    });

    it('purchasedDeducted = 0 for Haiku cost when monthly covers it fully', async () => {
      // Haiku costs 1; monthly=20: all from monthly
      const bal = makeBalance({ balance: 20, monthlyBalance: 20, purchasedBalance: 0 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-6' });

      const result = await service.consumeCredits('user-1', 1, 'character_talk');

      expect(result.purchasedDeducted).toBe(0);
    });

    it('purchasedDeducted = 5 for Opus cost (5cr) when monthly=0', async () => {
      // Opus costs 5; monthly=0: all from purchased
      const bal = makeBalance({ balance: 10, monthlyBalance: 0, purchasedBalance: 10 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-7' });

      const result = await service.consumeCredits('user-1', 5, 'character_talk');

      expect(result.purchasedDeducted).toBe(5);
    });

    it('purchasedDeducted reflects only the overflow beyond monthly balance', async () => {
      // monthly=3, amount=5, purchased=10: purchasedDeduct = 5-3 = 2
      const bal = makeBalance({ balance: 13, monthlyBalance: 3, purchasedBalance: 10 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-8' });

      const result = await service.consumeCredits('user-1', 5, 'character_talk');

      expect(result.purchasedDeducted).toBe(2);
    });
  });
});

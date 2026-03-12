import { Test, TestingModule } from '@nestjs/testing';
import { CreditService, InsufficientCreditsException } from '../credit.service';
import { PrismaService } from '../../common/prisma/prisma.service';

// ─── Mock factory ────────────────────────────────────────────────────────────

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
  purchasedBalance: number;
  monthlyGranted: number;
  userId: string;
}> = {}) {
  return {
    userId: 'user-1',
    balance: 30,
    monthlyBalance: 30,
    purchasedBalance: 0,
    monthlyGranted: 30,
    lastGrantedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CreditService', () => {
  let service: CreditService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();

    // Default: $transaction executes the callback immediately with the prisma mock itself
    prisma.$transaction.mockImplementation((cb: (tx: any) => any) => cb(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CreditService>(CreditService);
  });

  // ─── InsufficientCreditsException ──────────────────────────────────────────

  describe('InsufficientCreditsException', () => {
    it('should include required and available amounts in the response', () => {
      const err = new InsufficientCreditsException(5, 2);
      const response = err.getResponse() as any;
      expect(response.required).toBe(5);
      expect(response.available).toBe(2);
      expect(response.code).toBe('INSUFFICIENT_CREDITS');
    });
  });

  // ─── ensureCreditBalance ────────────────────────────────────────────────────

  describe('ensureCreditBalance', () => {
    it('creates balance with defaults (30cr) when user has no record', async () => {
      const expected = makeBalance();
      prisma.creditBalance.upsert.mockResolvedValue(expected);

      const result = await service.ensureCreditBalance('user-1');

      expect(prisma.creditBalance.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: {},
        create: expect.objectContaining({
          userId: 'user-1',
          balance: 30,
          monthlyBalance: 30,
          purchasedBalance: 0,
          monthlyGranted: 30,
        }),
      });
      expect(result).toEqual(expected);
    });

    it('returns existing balance without modification when record exists', async () => {
      const existing = makeBalance({ balance: 15 });
      prisma.creditBalance.upsert.mockResolvedValue(existing);

      const result = await service.ensureCreditBalance('user-1');

      // update: {} means no changes are applied to an existing record
      expect(result.balance).toBe(15);
    });
  });

  // ─── getBalance ────────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('returns total, monthly, and purchased breakdown', async () => {
      prisma.creditBalance.upsert.mockResolvedValue(
        makeBalance({ balance: 40, monthlyBalance: 30, purchasedBalance: 10 }),
      );

      const result = await service.getBalance('user-1');

      expect(result).toEqual({ total: 40, monthly: 30, purchased: 10 });
    });

    it('returns all zeros when balance is freshly created', async () => {
      prisma.creditBalance.upsert.mockResolvedValue(
        makeBalance({ balance: 0, monthlyBalance: 0, purchasedBalance: 0 }),
      );

      const result = await service.getBalance('user-1');

      expect(result).toEqual({ total: 0, monthly: 0, purchased: 0 });
    });
  });

  // ─── consumeCredits ────────────────────────────────────────────────────────

  describe('consumeCredits', () => {
    it('deducts from monthly balance first when monthly covers full amount', async () => {
      const bal = makeBalance({ balance: 30, monthlyBalance: 30, purchasedBalance: 0 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1' });

      const result = await service.consumeCredits('user-1', 5, 'writing');

      expect(prisma.creditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            monthlyBalance: { decrement: 5 },
            purchasedBalance: { decrement: 0 },
          }),
        }),
      );
      expect(result.transactionId).toBe('tx-1');
      expect(result.newBalance).toBe(25);
    });

    it('deducts remaining from purchased balance when monthly is insufficient', async () => {
      const bal = makeBalance({ balance: 12, monthlyBalance: 2, purchasedBalance: 10 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-2' });

      await service.consumeCredits('user-1', 5, 'writing');

      expect(prisma.creditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            balance: { decrement: 5 },
            monthlyBalance: { decrement: 2 },
            purchasedBalance: { decrement: 3 },
          }),
        }),
      );
    });

    it('uses only purchased balance when monthly balance is zero', async () => {
      const bal = makeBalance({ balance: 10, monthlyBalance: 0, purchasedBalance: 10 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-3' });

      await service.consumeCredits('user-1', 4, 'writing');

      expect(prisma.creditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            monthlyBalance: { decrement: 0 },
            purchasedBalance: { decrement: 4 },
          }),
        }),
      );
    });

    it('throws InsufficientCreditsException when balance is too low', async () => {
      const bal = makeBalance({ balance: 2, monthlyBalance: 2, purchasedBalance: 0 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);

      await expect(service.consumeCredits('user-1', 5, 'writing'))
        .rejects.toThrow(InsufficientCreditsException);
    });

    it('throws InsufficientCreditsException when balance record does not exist', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(null);

      await expect(service.consumeCredits('user-1', 1, 'writing'))
        .rejects.toThrow(InsufficientCreditsException);
    });

    it('creates a CONSUME transaction with pending status', async () => {
      const bal = makeBalance({ balance: 10, monthlyBalance: 10, purchasedBalance: 0 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1' });

      await service.consumeCredits('user-1', 3, 'writing', 'claude-sonnet');

      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          amount: -3,
          type: 'CONSUME',
          status: 'pending',
          relatedFeature: 'writing',
          relatedModel: 'claude-sonnet',
        }),
      });
    });

    it('stores null for relatedModel when model is not provided', async () => {
      const bal = makeBalance({ balance: 10, monthlyBalance: 10, purchasedBalance: 0 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1' });

      await service.consumeCredits('user-1', 1, 'writing');

      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ relatedModel: null }),
      });
    });

    it('returns correct newBalance after consumption', async () => {
      const bal = makeBalance({ balance: 30, monthlyBalance: 30, purchasedBalance: 0 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1' });

      const result = await service.consumeCredits('user-1', 7, 'writing');

      expect(result.newBalance).toBe(23);
    });

    it('throws when amount is exactly equal to balance (edge: sufficient)', async () => {
      const bal = makeBalance({ balance: 5, monthlyBalance: 5, purchasedBalance: 0 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1' });

      // Should succeed when amount === balance
      const result = await service.consumeCredits('user-1', 5, 'writing');
      expect(result.newBalance).toBe(0);
    });
  });

  // ─── confirmTransaction ────────────────────────────────────────────────────

  describe('confirmTransaction', () => {
    it('sets transaction status to confirmed', async () => {
      prisma.creditTransaction.update.mockResolvedValue({ id: 'tx-1', status: 'confirmed' });

      await service.confirmTransaction('tx-1');

      expect(prisma.creditTransaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { status: 'confirmed' },
      });
    });

    it('does not throw when transaction update fails (logs error instead)', async () => {
      prisma.creditTransaction.update.mockRejectedValue(new Error('DB error'));

      // Should not throw — error is caught and logged
      await expect(service.confirmTransaction('tx-missing')).resolves.toBeUndefined();
    });
  });

  // ─── refundTransaction ─────────────────────────────────────────────────────

  describe('refundTransaction', () => {
    it('restores monthly balance first up to monthlyGranted cap', async () => {
      // consumed 5 from monthly (was 30, now 25); monthlyGranted=30
      // refund 5 → monthlyRestore = min(5, 30-25) = 5; purchasedRestore = 0
      const consumeTx = {
        id: 'tx-1',
        userId: 'user-1',
        amount: -5,
        status: 'pending',
        relatedFeature: 'writing',
        relatedModel: null,
      };
      const bal = makeBalance({ balance: 25, monthlyBalance: 25, purchasedBalance: 0, monthlyGranted: 30 });

      prisma.creditTransaction.findUnique.mockResolvedValue(consumeTx);
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-refund' });

      await service.refundTransaction('tx-1');

      expect(prisma.creditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            balance: { increment: 5 },
            monthlyBalance: { increment: 5 },
            purchasedBalance: { increment: 0 },
          }),
        }),
      );
    });

    it('clamps monthlyRestore to 0 when monthlyBalance already equals monthlyGranted', async () => {
      // monthlyBalance === monthlyGranted → no room to restore to monthly
      // all goes to purchased
      const consumeTx = {
        id: 'tx-1',
        userId: 'user-1',
        amount: -5,
        status: 'pending',
        relatedFeature: 'writing',
        relatedModel: null,
      };
      const bal = makeBalance({ balance: 25, monthlyBalance: 30, purchasedBalance: 0, monthlyGranted: 30 });

      prisma.creditTransaction.findUnique.mockResolvedValue(consumeTx);
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-refund' });

      await service.refundTransaction('tx-1');

      expect(prisma.creditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            monthlyBalance: { increment: 0 },
            purchasedBalance: { increment: 5 },
          }),
        }),
      );
    });

    it('restores mix of monthly and purchased correctly', async () => {
      // consumed 5: 2 monthly + 3 purchased; now monthlyBalance=28, purchasedBalance=7
      // monthlyGranted=30: room = 30-28=2 → monthlyRestore=2, purchasedRestore=3
      const consumeTx = {
        id: 'tx-1',
        userId: 'user-1',
        amount: -5,
        status: 'pending',
        relatedFeature: 'writing',
        relatedModel: null,
      };
      const bal = makeBalance({ balance: 35, monthlyBalance: 28, purchasedBalance: 7, monthlyGranted: 30 });

      prisma.creditTransaction.findUnique.mockResolvedValue(consumeTx);
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-refund' });

      await service.refundTransaction('tx-1');

      expect(prisma.creditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            monthlyBalance: { increment: 2 },
            purchasedBalance: { increment: 3 },
          }),
        }),
      );
    });

    it('creates a REFUND transaction record', async () => {
      const consumeTx = {
        id: 'tx-1',
        userId: 'user-1',
        amount: -3,
        status: 'pending',
        relatedFeature: 'proofread',
        relatedModel: 'haiku',
      };
      const bal = makeBalance({ balance: 27, monthlyBalance: 27, purchasedBalance: 0, monthlyGranted: 30 });

      prisma.creditTransaction.findUnique.mockResolvedValue(consumeTx);
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-refund' });

      await service.refundTransaction('tx-1');

      expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            amount: 3,
            type: 'REFUND',
            status: 'confirmed',
          }),
        }),
      );
    });

    it('is a no-op when transaction status is confirmed (not pending)', async () => {
      const confirmedTx = {
        id: 'tx-1',
        userId: 'user-1',
        amount: -5,
        status: 'confirmed',
        relatedFeature: 'writing',
        relatedModel: null,
      };
      prisma.creditTransaction.findUnique.mockResolvedValue(confirmedTx);

      await service.refundTransaction('tx-1');

      // Balance should never be touched
      expect(prisma.creditBalance.update).not.toHaveBeenCalled();
      expect(prisma.creditTransaction.update).not.toHaveBeenCalled();
    });

    it('is a no-op when transaction does not exist', async () => {
      prisma.creditTransaction.findUnique.mockResolvedValue(null);

      await service.refundTransaction('tx-missing');

      expect(prisma.creditBalance.update).not.toHaveBeenCalled();
    });

    it('does not throw on DB error (logs error instead)', async () => {
      prisma.$transaction.mockRejectedValue(new Error('DB error'));

      await expect(service.refundTransaction('tx-1')).resolves.toBeUndefined();
    });
  });

  // ─── grantMonthlyCredits ───────────────────────────────────────────────────

  describe('grantMonthlyCredits', () => {
    it('expires old monthly balance and grants new credits', async () => {
      const bal = makeBalance({ balance: 20, monthlyBalance: 20, purchasedBalance: 0, monthlyGranted: 30 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      // ensureCreditBalanceInTx: findUnique returns the balance
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-expire' });
      prisma.creditBalance.update.mockResolvedValue({});

      await service.grantMonthlyCredits('user-1', 200, 'standard', 'inv_001');

      // Expire old balance
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: -20,
            type: 'EXPIRE',
            status: 'confirmed',
          }),
        }),
      );

      // New balance = 20 - 20 + 200 = 200
      expect(prisma.creditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            balance: 200,
            monthlyBalance: 200,
            monthlyGranted: 200,
          }),
        }),
      );

      // Monthly grant transaction
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 200,
            type: 'MONTHLY_GRANT',
            status: 'confirmed',
            stripePaymentId: 'inv_001',
          }),
        }),
      );
    });

    it('does not create EXPIRE transaction when monthlyBalance is 0', async () => {
      const bal = makeBalance({ balance: 10, monthlyBalance: 0, purchasedBalance: 10, monthlyGranted: 30 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-grant' });
      prisma.creditBalance.update.mockResolvedValue({});

      await service.grantMonthlyCredits('user-1', 30, 'free');

      const calls = prisma.creditTransaction.create.mock.calls.map(
        (c: any[]) => c[0].data.type,
      );
      expect(calls).not.toContain('EXPIRE');
      expect(calls).toContain('MONTHLY_GRANT');
    });

    it('preserves purchasedBalance during grant', async () => {
      const bal = makeBalance({ balance: 15, monthlyBalance: 5, purchasedBalance: 10, monthlyGranted: 30 });
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1' });
      prisma.creditBalance.update.mockResolvedValue({});

      await service.grantMonthlyCredits('user-1', 30, 'free');

      expect(prisma.creditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            purchasedBalance: 10,
          }),
        }),
      );
    });

    it('creates the balance record when it does not exist (via ensureCreditBalanceInTx)', async () => {
      // findUnique returns null → create is called
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(null);
      const newBal = makeBalance({ balance: 0, monthlyBalance: 0, purchasedBalance: 0, monthlyGranted: 0 });
      prisma.creditBalance.create.mockResolvedValue(newBal);
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1' });
      prisma.creditBalance.update.mockResolvedValue({});

      await service.grantMonthlyCredits('user-1', 30, 'free');

      expect(prisma.creditBalance.create).toHaveBeenCalled();
    });

    it('stores stripeInvoiceId in stripePaymentId field', async () => {
      const bal = makeBalance();
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1' });
      prisma.creditBalance.update.mockResolvedValue({});

      await service.grantMonthlyCredits('user-1', 200, 'standard', 'inv_xyz');

      const grantCall = prisma.creditTransaction.create.mock.calls.find(
        (c: any[]) => c[0].data.type === 'MONTHLY_GRANT',
      );
      expect(grantCall[0].data.stripePaymentId).toBe('inv_xyz');
    });
  });

  // ─── addPurchasedCredits ───────────────────────────────────────────────────

  describe('addPurchasedCredits', () => {
    it('adds amount to purchasedBalance and total balance', async () => {
      const bal = makeBalance({ balance: 30, monthlyBalance: 30, purchasedBalance: 0 });
      prisma.creditPurchase.findUnique.mockResolvedValue(null);
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1' });
      prisma.creditPurchase.create.mockResolvedValue({});

      await service.addPurchasedCredits('user-1', 100, 'pi_abc123', 980);

      expect(prisma.creditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            balance: { increment: 100 },
            purchasedBalance: { increment: 100 },
          }),
        }),
      );
    });

    it('does NOT add to monthlyBalance', async () => {
      const bal = makeBalance({ balance: 30, monthlyBalance: 30, purchasedBalance: 0 });
      prisma.creditPurchase.findUnique.mockResolvedValue(null);
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1' });
      prisma.creditPurchase.create.mockResolvedValue({});

      await service.addPurchasedCredits('user-1', 100, 'pi_abc123', 980);

      const updateCall = prisma.creditBalance.update.mock.calls[0][0];
      expect(updateCall.data.monthlyBalance).toBeUndefined();
    });

    it('is idempotent: no-op when stripePaymentId already processed', async () => {
      prisma.creditPurchase.findUnique.mockResolvedValue({ id: 'existing-purchase' });

      await service.addPurchasedCredits('user-1', 100, 'pi_duplicate', 980);

      expect(prisma.creditBalance.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates a CreditPurchase record', async () => {
      const bal = makeBalance();
      prisma.creditPurchase.findUnique.mockResolvedValue(null);
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1' });
      prisma.creditPurchase.create.mockResolvedValue({});

      await service.addPurchasedCredits('user-1', 100, 'pi_abc123', 980);

      expect(prisma.creditPurchase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            amount: 100,
            priceJpy: 980,
            stripePaymentIntentId: 'pi_abc123',
            status: 'completed',
          }),
        }),
      );
    });

    it('creates a PURCHASE transaction record', async () => {
      const bal = makeBalance({ balance: 30 });
      prisma.creditPurchase.findUnique.mockResolvedValue(null);
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.findUnique.mockResolvedValue(bal);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1' });
      prisma.creditPurchase.create.mockResolvedValue({});

      await service.addPurchasedCredits('user-1', 100, 'pi_abc123', 980);

      expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'PURCHASE',
            status: 'confirmed',
            amount: 100,
            stripePaymentId: 'pi_abc123',
          }),
        }),
      );
    });
  });

  // ─── getTransactionHistory ─────────────────────────────────────────────────

  describe('getTransactionHistory', () => {
    it('returns paginated transactions with total count', async () => {
      const mockTransactions = [
        { id: 'tx-1', type: 'CONSUME', amount: -1, createdAt: new Date() },
        { id: 'tx-2', type: 'MONTHLY_GRANT', amount: 30, createdAt: new Date() },
      ];
      prisma.creditTransaction.findMany.mockResolvedValue(mockTransactions);
      prisma.creditTransaction.count.mockResolvedValue(42);

      const result = await service.getTransactionHistory('user-1', 2, 10);

      expect(result.data).toEqual(mockTransactions);
      expect(result.total).toBe(42);
      expect(prisma.creditTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          skip: 10, // (page 2 - 1) * limit 10
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('defaults to page 1, limit 20', async () => {
      prisma.creditTransaction.findMany.mockResolvedValue([]);
      prisma.creditTransaction.count.mockResolvedValue(0);

      await service.getTransactionHistory('user-1');

      expect(prisma.creditTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('returns empty data and zero total when no transactions exist', async () => {
      prisma.creditTransaction.findMany.mockResolvedValue([]);
      prisma.creditTransaction.count.mockResolvedValue(0);

      const result = await service.getTransactionHistory('user-1');

      expect(result).toEqual({ data: [], total: 0 });
    });

    it('uses correct skip for page 3 with limit 5', async () => {
      prisma.creditTransaction.findMany.mockResolvedValue([]);
      prisma.creditTransaction.count.mockResolvedValue(0);

      await service.getTransactionHistory('user-1', 3, 5);

      expect(prisma.creditTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });
  });
});

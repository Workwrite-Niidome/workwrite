import { Test, TestingModule } from '@nestjs/testing';
import { ReferralService } from './referral.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreditService } from '../billing/credit.service';

// ─── Mock factories ──────────────────────────────────────────────────────────

const mockPrismaService = () => ({
  inviteCodeUsage: { findFirst: jest.fn() },
  referralReward: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
  inviteCode: { findMany: jest.fn() },
  creditBalance: { update: jest.fn() },
  creditTransaction: { create: jest.fn() },
  $transaction: jest.fn(),
  $queryRawUnsafe: jest.fn(),
});

const mockCreditService = () => ({
  ensureCreditBalance: jest.fn(),
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ReferralService', () => {
  let service: ReferralService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let credits: ReturnType<typeof mockCreditService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    credits = mockCreditService();

    // Default: $transaction executes the callback immediately
    prisma.$transaction.mockImplementation((cb: (tx: any) => any) => cb(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        { provide: PrismaService, useValue: prisma },
        { provide: CreditService, useValue: credits },
      ],
    }).compile();

    service = module.get<ReferralService>(ReferralService);
  });

  // ─── checkAndReward ────────────────────────────────────────────────────────

  describe('checkAndReward', () => {
    it('grants 50 credits for first_work_published', async () => {
      // Setup: user was invited
      prisma.inviteCodeUsage.findFirst.mockResolvedValue({
        inviteCode: { createdBy: 'inviter-1' },
      });
      prisma.referralReward.findUnique.mockResolvedValue(null); // no existing
      prisma.referralReward.create.mockResolvedValue({});
      credits.ensureCreditBalance.mockResolvedValue({});
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({});

      await service.checkAndReward('invitee-1', 'first_work_published');

      expect(prisma.referralReward.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inviterId: 'inviter-1',
          inviteeId: 'invitee-1',
          triggerEvent: 'first_work_published',
          creditAmount: 50,
          claimed: true,
        }),
      });

      expect(prisma.creditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            balance: { increment: 50 },
            purchasedBalance: { increment: 50 },
          }),
        }),
      );
    });

    it('grants 10 credits for first_review', async () => {
      prisma.inviteCodeUsage.findFirst.mockResolvedValue({
        inviteCode: { createdBy: 'inviter-1' },
      });
      prisma.referralReward.findUnique.mockResolvedValue(null);
      prisma.referralReward.create.mockResolvedValue({});
      credits.ensureCreditBalance.mockResolvedValue({});
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      prisma.creditBalance.update.mockResolvedValue({});
      prisma.creditTransaction.create.mockResolvedValue({});

      await service.checkAndReward('invitee-1', 'first_review');

      expect(prisma.creditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            balance: { increment: 10 },
            purchasedBalance: { increment: 10 },
          }),
        }),
      );
    });

    it('does nothing for unknown trigger event', async () => {
      await service.checkAndReward('invitee-1', 'unknown_event');

      expect(prisma.inviteCodeUsage.findFirst).not.toHaveBeenCalled();
      expect(prisma.referralReward.create).not.toHaveBeenCalled();
    });

    it('does nothing when user was not invited', async () => {
      prisma.inviteCodeUsage.findFirst.mockResolvedValue(null);

      await service.checkAndReward('invitee-1', 'first_work_published');

      expect(prisma.referralReward.create).not.toHaveBeenCalled();
    });

    it('does nothing when inviter is the same user (self-invite)', async () => {
      prisma.inviteCodeUsage.findFirst.mockResolvedValue({
        inviteCode: { createdBy: 'invitee-1' }, // same as invitee
      });

      await service.checkAndReward('invitee-1', 'first_work_published');

      expect(prisma.referralReward.create).not.toHaveBeenCalled();
    });

    it('prevents duplicate rewards for same event', async () => {
      prisma.inviteCodeUsage.findFirst.mockResolvedValue({
        inviteCode: { createdBy: 'inviter-1' },
      });
      prisma.referralReward.findUnique.mockResolvedValue({
        id: 'existing-reward',
      }); // already rewarded

      await service.checkAndReward('invitee-1', 'first_work_published');

      expect(prisma.referralReward.create).not.toHaveBeenCalled();
      expect(prisma.creditBalance.update).not.toHaveBeenCalled();
    });

    it('does not throw when DB error occurs (logs instead)', async () => {
      prisma.inviteCodeUsage.findFirst.mockResolvedValue({
        inviteCode: { createdBy: 'inviter-1' },
      });
      prisma.referralReward.findUnique.mockResolvedValue(null);
      prisma.referralReward.create.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(
        service.checkAndReward('invitee-1', 'first_work_published'),
      ).resolves.toBeUndefined();
    });
  });

  // ─── getDashboard ──────────────────────────────────────────────────────────

  describe('getDashboard', () => {
    it('returns dashboard data with totals', async () => {
      prisma.referralReward.findMany.mockResolvedValue([
        { triggerEvent: 'first_work_published', creditAmount: 50, createdAt: new Date() },
        { triggerEvent: 'first_review', creditAmount: 10, createdAt: new Date() },
      ]);
      prisma.inviteCode.findMany.mockResolvedValue([
        {
          code: 'ABC123',
          label: null,
          maxUses: 10,
          usedCount: 3,
          isActive: true,
          usages: [
            { userId: 'u1', usedAt: new Date() },
            { userId: 'u2', usedAt: new Date() },
            { userId: 'u3', usedAt: new Date() },
          ],
        },
      ]);

      const result = await service.getDashboard('inviter-1');

      expect(result.totalCreditsEarned).toBe(60);
      expect(result.totalInvitees).toBe(3);
      expect(result.inviteCodes).toHaveLength(1);
      expect(result.rewards).toHaveLength(2);
    });

    it('returns zeros when no rewards or invite codes exist', async () => {
      prisma.referralReward.findMany.mockResolvedValue([]);
      prisma.inviteCode.findMany.mockResolvedValue([]);

      const result = await service.getDashboard('user-1');

      expect(result.totalCreditsEarned).toBe(0);
      expect(result.totalInvitees).toBe(0);
      expect(result.inviteCodes).toHaveLength(0);
      expect(result.rewards).toHaveLength(0);
    });
  });
});

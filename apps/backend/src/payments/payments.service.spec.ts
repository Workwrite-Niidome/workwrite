import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { StripeService } from '../billing/stripe.service';

// ─── Mock factories ──────────────────────────────────────────────────────────

const mockPrismaService = () => ({
  user: { findUnique: jest.fn() },
  payment: { create: jest.fn(), findMany: jest.fn() },
  subscription: { findUnique: jest.fn() },
});

const mockConfigService = () => ({
  get: jest.fn(),
});

const mockStripeService = () => ({
  getOrCreateCustomer: jest.fn(),
  createConnectPaymentIntent: jest.fn(),
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let config: ReturnType<typeof mockConfigService>;
  let stripe: ReturnType<typeof mockStripeService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    config = mockConfigService();
    stripe = mockStripeService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: StripeService, useValue: stripe },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  // ─── createTip ─────────────────────────────────────────────────────────────

  describe('createTip', () => {
    it('throws BadRequestException when Stripe key is not set', async () => {
      config.get.mockReturnValue(undefined); // no STRIPE_SECRET_KEY

      await expect(
        service.createTip('payer-1', 'recipient-1', 300),
      ).rejects.toThrow(BadRequestException);

      expect(stripe.createConnectPaymentIntent).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when recipient has no Connect account', async () => {
      config.get.mockReturnValue('sk_test_xxx'); // Stripe key is set
      prisma.user.findUnique
        .mockResolvedValueOnce({ stripeAccountId: null }); // no connect

      await expect(
        service.createTip('payer-1', 'recipient-1', 300),
      ).rejects.toThrow(BadRequestException);

      expect(stripe.createConnectPaymentIntent).not.toHaveBeenCalled();
    });

    it('creates real Stripe Connect payment when all conditions met', async () => {
      config.get.mockReturnValue('sk_test_xxx');
      prisma.user.findUnique
        .mockResolvedValueOnce({ stripeAccountId: 'acct_recipient' }) // recipient with Connect
        .mockResolvedValueOnce({ email: 'payer@example.com', stripeCustomerId: 'cus_1' }); // payer
      stripe.getOrCreateCustomer.mockResolvedValue('cus_1');
      stripe.createConnectPaymentIntent.mockResolvedValue({
        paymentIntentId: 'pi_real',
        clientSecret: 'cs_xxx',
      });
      prisma.payment.create.mockResolvedValue({ id: 'payment-1', status: 'succeeded' });

      const result = await service.createTip('payer-1', 'recipient-1', 1000);

      expect(stripe.createConnectPaymentIntent).toHaveBeenCalledWith(
        'cus_1',
        'acct_recipient',
        1000,
        0.2, // 20% platform fee
        expect.objectContaining({
          payerId: 'payer-1',
          recipientId: 'recipient-1',
          type: 'letter_tip',
        }),
        expect.any(String), // idempotencyKey
      );
      expect(result.status).toBe('succeeded');
    });

    it('throws BadRequestException when Stripe Connect payment fails', async () => {
      config.get.mockReturnValue('sk_test_xxx');
      prisma.user.findUnique
        .mockResolvedValueOnce({ stripeAccountId: 'acct_recipient' })
        .mockResolvedValueOnce({ email: 'payer@example.com' });
      stripe.getOrCreateCustomer.mockResolvedValue('cus_1');
      stripe.createConnectPaymentIntent.mockRejectedValue(new Error('Card declined'));

      await expect(
        service.createTip('payer-1', 'recipient-1', 1000),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getSubscriptionStatus ─────────────────────────────────────────────────

  describe('getSubscriptionStatus', () => {
    it('returns active status for active subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        status: 'active',
        plan: 'standard',
        currentPeriodEnd: new Date('2026-12-31'),
      });

      const result = await service.getSubscriptionStatus('user-1');

      expect(result.active).toBe(true);
      expect(result.plan).toBe('standard');
    });

    it('returns inactive when no subscription exists', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.getSubscriptionStatus('user-1');

      expect(result.active).toBe(false);
    });
  });

  // ─── getPaymentHistory ─────────────────────────────────────────────────────

  describe('getPaymentHistory', () => {
    it('returns payment history for user', async () => {
      const mockPayments = [{ id: 'p-1' }, { id: 'p-2' }];
      prisma.payment.findMany.mockResolvedValue(mockPayments);

      const result = await service.getPaymentHistory('user-1');

      expect(result).toEqual(mockPayments);
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { payerId: 'user-1' },
          take: 50,
        }),
      );
    });
  });
});

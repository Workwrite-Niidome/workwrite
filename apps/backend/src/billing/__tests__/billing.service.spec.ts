import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from '../billing.service';
import { CreditService } from '../credit.service';
import { PrismaService } from '../../common/prisma/prisma.service';

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockPrismaService = () => ({
  creditTransaction: {
    findFirst: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
  },
});

const mockCreditService = () => ({
  getBalance: jest.fn(),
  grantMonthlyCredits: jest.fn(),
  addPurchasedCredits: jest.fn(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Record<string, any> = {}): any {
  return {
    id: 'inv_test123',
    customer: 'cus_test123',
    ...overrides,
  };
}

function makeSession(overrides: Record<string, any> = {}): any {
  return {
    metadata: { userId: 'user-1', plan: 'standard' },
    subscription: 'sub_test123',
    payment_intent: null,
    ...overrides,
  };
}

function makeSubscription(overrides: Record<string, any> = {}): any {
  return {
    id: 'sub_test123',
    status: 'active',
    metadata: { userId: 'user-1', plan: 'standard' },
    current_period_end: 1700000000,
    current_period_start: 1697000000,
    cancel_at_period_end: false,
    trial_end: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BillingService', () => {
  let service: BillingService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let creditService: ReturnType<typeof mockCreditService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    creditService = mockCreditService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: CreditService, useValue: creditService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  // ─── getBillingStatus ──────────────────────────────────────────────────────

  describe('getBillingStatus', () => {
    it('returns free plan when no subscription exists', async () => {
      creditService.getBalance.mockResolvedValue({ total: 30, monthly: 30, purchased: 0 });
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.getBillingStatus('user-1');

      expect(result.plan).toBe('free');
      expect(result.subscription).toBeNull();
    });

    it('returns plan from active subscription', async () => {
      creditService.getBalance.mockResolvedValue({ total: 200, monthly: 200, purchased: 0 });
      prisma.subscription.findUnique.mockResolvedValue({
        status: 'active',
        plan: 'standard',
        currentPeriodEnd: new Date('2025-12-01'),
        currentPeriodStart: new Date('2025-11-01'),
        cancelAtPeriodEnd: false,
        trialEnd: null,
      });

      const result = await service.getBillingStatus('user-1');

      expect(result.plan).toBe('standard');
    });

    it('returns free plan when subscription is not active (e.g., past_due)', async () => {
      creditService.getBalance.mockResolvedValue({ total: 5, monthly: 5, purchased: 0 });
      prisma.subscription.findUnique.mockResolvedValue({
        status: 'past_due',
        plan: 'pro',
        currentPeriodEnd: null,
        currentPeriodStart: null,
        cancelAtPeriodEnd: false,
        trialEnd: null,
      });

      const result = await service.getBillingStatus('user-1');

      expect(result.plan).toBe('free');
    });

    it('includes credit balances in the response', async () => {
      const credits = { total: 150, monthly: 100, purchased: 50 };
      creditService.getBalance.mockResolvedValue(credits);
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.getBillingStatus('user-1');

      expect(result.credits).toEqual(credits);
    });

    it('includes subscription details when subscription is present', async () => {
      creditService.getBalance.mockResolvedValue({ total: 200, monthly: 200, purchased: 0 });
      const periodEnd = new Date('2025-12-01');
      const periodStart = new Date('2025-11-01');
      prisma.subscription.findUnique.mockResolvedValue({
        status: 'active',
        plan: 'pro',
        currentPeriodEnd: periodEnd,
        currentPeriodStart: periodStart,
        cancelAtPeriodEnd: true,
        trialEnd: null,
      });

      const result = await service.getBillingStatus('user-1');

      expect(result.subscription).toEqual({
        status: 'active',
        currentPeriodEnd: periodEnd,
        currentPeriodStart: periodStart,
        cancelAtPeriodEnd: true,
        trialEnd: null,
      });
    });
  });

  // ─── handleInvoicePaid ─────────────────────────────────────────────────────

  describe('handleInvoicePaid', () => {
    it('grants monthly credits for active standard subscription', async () => {
      prisma.creditTransaction.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.subscription.findUnique.mockResolvedValue({ status: 'active', plan: 'standard' });
      creditService.grantMonthlyCredits.mockResolvedValue(undefined);

      await service.handleInvoicePaid(makeInvoice());

      expect(creditService.grantMonthlyCredits).toHaveBeenCalledWith(
        'user-1',
        200,
        'standard',
        'inv_test123',
      );
    });

    it('grants 600cr for pro plan', async () => {
      prisma.creditTransaction.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.subscription.findUnique.mockResolvedValue({ status: 'active', plan: 'pro' });
      creditService.grantMonthlyCredits.mockResolvedValue(undefined);

      await service.handleInvoicePaid(makeInvoice());

      expect(creditService.grantMonthlyCredits).toHaveBeenCalledWith(
        'user-1',
        600,
        'pro',
        'inv_test123',
      );
    });

    it('grants 30cr for free plan', async () => {
      prisma.creditTransaction.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.subscription.findUnique.mockResolvedValue({ status: 'active', plan: 'free' });
      creditService.grantMonthlyCredits.mockResolvedValue(undefined);

      await service.handleInvoicePaid(makeInvoice());

      expect(creditService.grantMonthlyCredits).toHaveBeenCalledWith(
        'user-1',
        30,
        'free',
        'inv_test123',
      );
    });

    it('is idempotent: skips processing if invoice already handled', async () => {
      prisma.creditTransaction.findFirst.mockResolvedValue({ id: 'existing-tx' });

      await service.handleInvoicePaid(makeInvoice());

      expect(creditService.grantMonthlyCredits).not.toHaveBeenCalled();
    });

    it('does nothing when no user found for the Stripe customer', async () => {
      prisma.creditTransaction.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);

      await service.handleInvoicePaid(makeInvoice());

      expect(creditService.grantMonthlyCredits).not.toHaveBeenCalled();
    });

    it('does nothing when user has no subscription', async () => {
      prisma.creditTransaction.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.subscription.findUnique.mockResolvedValue(null);

      await service.handleInvoicePaid(makeInvoice());

      expect(creditService.grantMonthlyCredits).not.toHaveBeenCalled();
    });

    it('does nothing when subscription is not active', async () => {
      prisma.creditTransaction.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.subscription.findUnique.mockResolvedValue({ status: 'canceled', plan: 'standard' });

      await service.handleInvoicePaid(makeInvoice());

      expect(creditService.grantMonthlyCredits).not.toHaveBeenCalled();
    });

    it('does nothing when invoice has no customer', async () => {
      await service.handleInvoicePaid(makeInvoice({ customer: null }));

      expect(prisma.creditTransaction.findFirst).not.toHaveBeenCalled();
      expect(creditService.grantMonthlyCredits).not.toHaveBeenCalled();
    });

    it('handles customer as an object with id property', async () => {
      prisma.creditTransaction.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.subscription.findUnique.mockResolvedValue({ status: 'active', plan: 'standard' });
      creditService.grantMonthlyCredits.mockResolvedValue(undefined);

      await service.handleInvoicePaid(
        makeInvoice({ customer: { id: 'cus_test123' } }),
      );

      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeCustomerId: 'cus_test123' },
        }),
      );
    });

    it('does not grant credits if plan credit amount is 0 (unknown plan)', async () => {
      prisma.creditTransaction.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      // Plan not in PLAN_MONTHLY_CREDITS → 0 credits
      prisma.subscription.findUnique.mockResolvedValue({ status: 'active', plan: 'enterprise' });

      await service.handleInvoicePaid(makeInvoice());

      expect(creditService.grantMonthlyCredits).not.toHaveBeenCalled();
    });
  });

  // ─── handleCheckoutComplete ────────────────────────────────────────────────

  describe('handleCheckoutComplete', () => {
    it('creates subscription record for subscription checkout', async () => {
      prisma.subscription.upsert.mockResolvedValue({});

      await service.handleCheckoutComplete(makeSession());

      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          create: expect.objectContaining({
            userId: 'user-1',
            plan: 'standard',
            status: 'active',
            stripeSubId: 'sub_test123',
          }),
          update: expect.objectContaining({
            plan: 'standard',
            status: 'active',
          }),
        }),
      );
    });

    it('does NOT grant credits on subscription checkout (deferred to invoice.paid)', async () => {
      prisma.subscription.upsert.mockResolvedValue({});

      await service.handleCheckoutComplete(makeSession());

      expect(creditService.grantMonthlyCredits).not.toHaveBeenCalled();
    });

    it('handles credit purchase checkout', async () => {
      const session = makeSession({
        metadata: { userId: 'user-1', type: 'credit_purchase' },
        payment_intent: 'pi_test456',
      });
      prisma.subscription.findUnique.mockResolvedValue({ plan: 'standard' });
      creditService.addPurchasedCredits.mockResolvedValue(undefined);

      await service.handleCheckoutComplete(session);

      expect(creditService.addPurchasedCredits).toHaveBeenCalledWith(
        'user-1',
        100,
        'pi_test456',
        980, // standard price
      );
    });

    it('uses 880 price for pro plan credit purchase', async () => {
      const session = makeSession({
        metadata: { userId: 'user-1', type: 'credit_purchase' },
        payment_intent: 'pi_pro456',
      });
      prisma.subscription.findUnique.mockResolvedValue({ plan: 'pro' });
      creditService.addPurchasedCredits.mockResolvedValue(undefined);

      await service.handleCheckoutComplete(session);

      expect(creditService.addPurchasedCredits).toHaveBeenCalledWith(
        'user-1',
        100,
        'pi_pro456',
        880,
      );
    });

    it('uses 980 price when user has no subscription (non-pro)', async () => {
      const session = makeSession({
        metadata: { userId: 'user-1', type: 'credit_purchase' },
        payment_intent: 'pi_free456',
      });
      prisma.subscription.findUnique.mockResolvedValue(null);
      creditService.addPurchasedCredits.mockResolvedValue(undefined);

      await service.handleCheckoutComplete(session);

      expect(creditService.addPurchasedCredits).toHaveBeenCalledWith(
        'user-1',
        100,
        'pi_free456',
        980,
      );
    });

    it('does nothing when userId is missing from metadata', async () => {
      const session = makeSession({ metadata: {} });

      await service.handleCheckoutComplete(session);

      expect(prisma.subscription.upsert).not.toHaveBeenCalled();
      expect(creditService.addPurchasedCredits).not.toHaveBeenCalled();
    });

    it('does nothing for subscription checkout when plan is missing from metadata', async () => {
      const session = makeSession({ metadata: { userId: 'user-1' } });

      await service.handleCheckoutComplete(session);

      expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it('skips credit purchase when payment_intent is missing', async () => {
      const session = makeSession({
        metadata: { userId: 'user-1', type: 'credit_purchase' },
        payment_intent: null,
      });

      await service.handleCheckoutComplete(session);

      expect(creditService.addPurchasedCredits).not.toHaveBeenCalled();
    });

    it('handles subscription as object with id property', async () => {
      const session = makeSession({
        subscription: { id: 'sub_object123' },
      });
      prisma.subscription.upsert.mockResolvedValue({});

      await service.handleCheckoutComplete(session);

      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ stripeSubId: 'sub_object123' }),
        }),
      );
    });
  });

  // ─── handleSubscriptionUpdated ─────────────────────────────────────────────

  describe('handleSubscriptionUpdated', () => {
    it('updates subscription status to active when status is active', async () => {
      prisma.subscription.upsert.mockResolvedValue({});

      await service.handleSubscriptionUpdated(makeSubscription());

      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          update: expect.objectContaining({ status: 'active' }),
        }),
      );
    });

    it('maps trialing status to active', async () => {
      prisma.subscription.upsert.mockResolvedValue({});

      await service.handleSubscriptionUpdated(makeSubscription({ status: 'trialing' }));

      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: 'active' }),
        }),
      );
    });

    it('preserves non-active statuses (e.g., canceled)', async () => {
      prisma.subscription.upsert.mockResolvedValue({});

      await service.handleSubscriptionUpdated(makeSubscription({ status: 'canceled' }));

      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: 'canceled' }),
        }),
      );
    });

    it('does nothing when userId is missing from metadata', async () => {
      const sub = makeSubscription({ metadata: {} });

      await service.handleSubscriptionUpdated(sub);

      expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it('converts unix timestamps to Date objects', async () => {
      prisma.subscription.upsert.mockResolvedValue({});

      await service.handleSubscriptionUpdated(makeSubscription({
        current_period_end: 1700000000,
        current_period_start: 1697000000,
      }));

      const call = prisma.subscription.upsert.mock.calls[0][0];
      expect(call.update.currentPeriodEnd).toEqual(new Date(1700000000 * 1000));
      expect(call.update.currentPeriodStart).toEqual(new Date(1697000000 * 1000));
    });
  });

  // ─── handleSubscriptionDeleted ─────────────────────────────────────────────

  describe('handleSubscriptionDeleted', () => {
    it('marks subscription as canceled and resets to free credits', async () => {
      prisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      creditService.grantMonthlyCredits.mockResolvedValue(undefined);

      await service.handleSubscriptionDeleted(makeSubscription());

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeSubId: 'sub_test123' },
          data: { status: 'canceled' },
        }),
      );
      expect(creditService.grantMonthlyCredits).toHaveBeenCalledWith('user-1', 30, 'free');
    });

    it('does nothing when userId is missing from metadata', async () => {
      await service.handleSubscriptionDeleted(makeSubscription({ metadata: {} }));

      expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
      expect(creditService.grantMonthlyCredits).not.toHaveBeenCalled();
    });
  });

  // ─── handlePaymentFailed ───────────────────────────────────────────────────

  describe('handlePaymentFailed', () => {
    it('marks subscription as past_due', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      await service.handlePaymentFailed(makeInvoice());

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          data: { status: 'past_due' },
        }),
      );
    });

    it('does nothing when no user found for customer', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await service.handlePaymentFailed(makeInvoice());

      expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
    });

    it('does nothing when customerId is missing', async () => {
      await service.handlePaymentFailed(makeInvoice({ customer: null }));

      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });
  });
});

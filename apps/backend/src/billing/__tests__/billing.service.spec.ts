import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from '../billing.service';
import { CreditService } from '../credit.service';
import { NotificationsService } from '../../notifications/notifications.service';
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
    findUnique: jest.fn(),
  },
  payment: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  letter: {
    create: jest.fn(),
  },
  pendingLetter: {
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
});

const mockNotificationsService = () => ({
  createNotification: jest.fn(),
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
  let notifications: ReturnType<typeof mockNotificationsService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    creditService = mockCreditService();
    notifications = mockNotificationsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: CreditService, useValue: creditService },
        { provide: NotificationsService, useValue: notifications },
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

    it('grants 10cr for free plan', async () => {
      prisma.creditTransaction.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.subscription.findUnique.mockResolvedValue({ status: 'active', plan: 'free' });
      creditService.grantMonthlyCredits.mockResolvedValue(undefined);

      await service.handleInvoicePaid(makeInvoice());

      expect(creditService.grantMonthlyCredits).toHaveBeenCalledWith(
        'user-1',
        10,
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
        metadata: { userId: 'user-1', type: 'credit_purchase', priceJpy: '880' },
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
      expect(creditService.grantMonthlyCredits).toHaveBeenCalledWith('user-1', 10, 'free');
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

  // ─── handleCheckoutComplete — letter type (handleLetterCheckoutComplete) ────

  describe('handleCheckoutComplete (letter type)', () => {
    // Helper: build a letter checkout session
    function makeLetterSession(overrides: Record<string, any> = {}): any {
      return {
        id: 'cs_test_letter',
        payment_intent: 'pi_letter123',
        metadata: {
          userId: 'sender-1',
          type: 'letter',
          pendingLetterId: 'pending-1',
          recipientId: 'author-1',
          episodeId: 'ep-1',
          letterType: 'STANDARD',
          amount: '300',
        },
        ...overrides,
      };
    }

    const basePendingLetter = {
      id: 'pending-1',
      senderId: 'sender-1',
      recipientId: 'author-1',
      episodeId: 'ep-1',
      type: 'STANDARD',
      content: 'すごく面白かったです！',
      amount: 300,
      stampId: null,
      moderationStatus: 'approved',
      moderationReason: null,
    };

    beforeEach(() => {
      // Default: $transaction executes the callback with prisma as tx
      prisma.$transaction.mockImplementation((cb: (tx: any) => Promise<any>) => cb(prisma));
      prisma.payment.findUnique.mockResolvedValue(null); // no duplicate payment
      prisma.pendingLetter.findUnique.mockResolvedValue(basePendingLetter);
      prisma.payment.create.mockResolvedValue({ id: 'payment-1' });
      prisma.letter.create.mockResolvedValue({ id: 'letter-1' });
      prisma.pendingLetter.delete.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({ name: 'TestUser', displayName: 'Test' });
      notifications.createNotification.mockResolvedValue(undefined);
    });

    // ── Normal path ────────────────────────────────────────────────────────────

    it('normal path: creates Payment + Letter atomically and deletes PendingLetter', async () => {
      await service.handleCheckoutComplete(makeLetterSession());

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripePaymentId: 'pi_letter123',
            payerId: 'sender-1',
            recipientId: 'author-1',
            amount: 300,
            type: 'LETTER',
            status: 'succeeded',
          }),
        }),
      );
      expect(prisma.letter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            senderId: 'sender-1',
            recipientId: 'author-1',
            episodeId: 'ep-1',
            type: 'STANDARD',
            content: 'すごく面白かったです！',
            amount: 300,
            paymentId: 'payment-1',
          }),
        }),
      );
      expect(prisma.pendingLetter.delete).toHaveBeenCalledWith({
        where: { id: 'pending-1' },
      });
    });

    it('normal path: notifies the author after letter creation', async () => {
      await service.handleCheckoutComplete(makeLetterSession());

      expect(notifications.createNotification).toHaveBeenCalledWith(
        'author-1',
        expect.objectContaining({
          type: 'letter',
          title: 'レターが届きました',
        }),
      );
    });

    it('normal path: uses displayName in notification body when available', async () => {
      prisma.user.findUnique.mockResolvedValue({ name: 'kazuki', displayName: 'Kazuki San' });

      await service.handleCheckoutComplete(makeLetterSession());

      const notifCall = notifications.createNotification.mock.calls[0];
      expect(notifCall[1].body).toContain('Kazuki San');
    });

    it('normal path: falls back to name when displayName is null', async () => {
      prisma.user.findUnique.mockResolvedValue({ name: 'kazuki', displayName: null });

      await service.handleCheckoutComplete(makeLetterSession());

      const notifCall = notifications.createNotification.mock.calls[0];
      expect(notifCall[1].body).toContain('kazuki');
    });

    it('normal path: falls back to 匿名 when both name and displayName are null', async () => {
      prisma.user.findUnique.mockResolvedValue({ name: null, displayName: null });

      await service.handleCheckoutComplete(makeLetterSession());

      const notifCall = notifications.createNotification.mock.calls[0];
      expect(notifCall[1].body).toContain('匿名');
    });

    it('normal path: marks PREMIUM letter as isHighlighted=true', async () => {
      prisma.pendingLetter.findUnique.mockResolvedValue({
        ...basePendingLetter,
        type: 'PREMIUM',
        amount: 500,
      });

      await service.handleCheckoutComplete(makeLetterSession());

      expect(prisma.letter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isHighlighted: true }),
        }),
      );
    });

    it('normal path: marks STANDARD letter as isHighlighted=false', async () => {
      await service.handleCheckoutComplete(makeLetterSession());

      expect(prisma.letter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isHighlighted: false }),
        }),
      );
    });

    it('normal path: still completes even if notification throws', async () => {
      notifications.createNotification.mockRejectedValue(new Error('notification failed'));

      // Should not throw
      await expect(service.handleCheckoutComplete(makeLetterSession())).resolves.toBeUndefined();
      expect(prisma.letter.create).toHaveBeenCalled();
    });

    it('normal path: uses checkout_<sessionId> when payment_intent is null', async () => {
      const session = makeLetterSession({ payment_intent: null });

      await service.handleCheckoutComplete(session);

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripePaymentId: 'checkout_cs_test_letter',
          }),
        }),
      );
    });

    // ── Idempotency ────────────────────────────────────────────────────────────

    it('idempotency: skips processing when Payment with same stripePaymentId already exists', async () => {
      prisma.payment.findUnique.mockResolvedValue({ id: 'existing-payment' });

      await service.handleCheckoutComplete(makeLetterSession());

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.letter.create).not.toHaveBeenCalled();
    });

    it('idempotency: does NOT check for existing payment when payment_intent is null', async () => {
      // payment_intent null means no idempotency check; should proceed to create
      const session = makeLetterSession({ payment_intent: null });

      await service.handleCheckoutComplete(session);

      expect(prisma.payment.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    // ── Missing pendingLetterId ────────────────────────────────────────────────

    it('does nothing when pendingLetterId is missing from metadata', async () => {
      const session = makeLetterSession({
        metadata: { userId: 'sender-1', type: 'letter' }, // no pendingLetterId
      });

      await service.handleCheckoutComplete(session);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.letter.create).not.toHaveBeenCalled();
    });

    // ── Fallback path: PendingLetter missing ──────────────────────────────────

    it('fallback path: creates Payment + Letter from metadata when PendingLetter is missing', async () => {
      prisma.pendingLetter.findUnique.mockResolvedValue(null);

      await service.handleCheckoutComplete(makeLetterSession());

      // Should NOT use $transaction for fallback path
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripePaymentId: 'pi_letter123',
            payerId: 'sender-1',
            recipientId: 'author-1',
            amount: 300,
            type: 'LETTER',
            status: 'succeeded',
          }),
        }),
      );
      expect(prisma.letter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            senderId: 'sender-1',
            recipientId: 'author-1',
            episodeId: 'ep-1',
            type: 'STANDARD',
            amount: 300,
            moderationStatus: 'approved',
          }),
        }),
      );
    });

    it('fallback path: uses placeholder content for the letter body', async () => {
      prisma.pendingLetter.findUnique.mockResolvedValue(null);

      await service.handleCheckoutComplete(makeLetterSession());

      const letterCall = prisma.letter.create.mock.calls[0][0];
      expect(letterCall.data.content).toContain('決済完了後');
    });

    it('fallback path: marks PREMIUM type as isHighlighted=true', async () => {
      prisma.pendingLetter.findUnique.mockResolvedValue(null);
      const session = makeLetterSession({
        metadata: {
          userId: 'sender-1',
          type: 'letter',
          pendingLetterId: 'pending-1',
          recipientId: 'author-1',
          episodeId: 'ep-1',
          letterType: 'PREMIUM',
          amount: '500',
        },
      });

      await service.handleCheckoutComplete(session);

      expect(prisma.letter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isHighlighted: true }),
        }),
      );
    });

    it('fallback path: defaults to STANDARD type when letterType is missing from metadata', async () => {
      prisma.pendingLetter.findUnique.mockResolvedValue(null);
      const session = makeLetterSession({
        metadata: {
          userId: 'sender-1',
          type: 'letter',
          pendingLetterId: 'pending-1',
          recipientId: 'author-1',
          episodeId: 'ep-1',
          // letterType intentionally omitted
          amount: '300',
        },
      });

      await service.handleCheckoutComplete(session);

      expect(prisma.letter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'STANDARD' }),
        }),
      );
    });

    it('fallback path: defaults amount to 0 when amount is missing from metadata', async () => {
      prisma.pendingLetter.findUnique.mockResolvedValue(null);
      const session = makeLetterSession({
        metadata: {
          userId: 'sender-1',
          type: 'letter',
          pendingLetterId: 'pending-1',
          recipientId: 'author-1',
          episodeId: 'ep-1',
        },
      });

      await service.handleCheckoutComplete(session);

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 0 }),
        }),
      );
    });

    it('fallback path: notifies the author', async () => {
      prisma.pendingLetter.findUnique.mockResolvedValue(null);

      await service.handleCheckoutComplete(makeLetterSession());

      expect(notifications.createNotification).toHaveBeenCalledWith(
        'author-1',
        expect.objectContaining({ type: 'letter', title: 'レターが届きました' }),
      );
    });

    it('fallback path: still completes even if notification throws', async () => {
      prisma.pendingLetter.findUnique.mockResolvedValue(null);
      notifications.createNotification.mockRejectedValue(new Error('notify failed'));

      await expect(service.handleCheckoutComplete(makeLetterSession())).resolves.toBeUndefined();
      expect(prisma.letter.create).toHaveBeenCalled();
    });

    // ── Fallback failure: metadata incomplete ─────────────────────────────────

    it('fallback failure: does nothing when PendingLetter missing AND recipientId absent', async () => {
      prisma.pendingLetter.findUnique.mockResolvedValue(null);
      const session = makeLetterSession({
        metadata: {
          userId: 'sender-1',
          type: 'letter',
          pendingLetterId: 'pending-1',
          // recipientId intentionally missing
          episodeId: 'ep-1',
        },
      });

      await service.handleCheckoutComplete(session);

      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.letter.create).not.toHaveBeenCalled();
    });

    it('fallback failure: does nothing when PendingLetter missing AND episodeId absent', async () => {
      prisma.pendingLetter.findUnique.mockResolvedValue(null);
      const session = makeLetterSession({
        metadata: {
          userId: 'sender-1',
          type: 'letter',
          pendingLetterId: 'pending-1',
          recipientId: 'author-1',
          // episodeId intentionally missing
        },
      });

      await service.handleCheckoutComplete(session);

      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.letter.create).not.toHaveBeenCalled();
    });

    it('fallback failure: does nothing when PendingLetter missing AND userId absent', async () => {
      prisma.pendingLetter.findUnique.mockResolvedValue(null);
      const session = makeLetterSession({
        metadata: {
          // userId intentionally missing
          type: 'letter',
          pendingLetterId: 'pending-1',
          recipientId: 'author-1',
          episodeId: 'ep-1',
        },
      });

      await service.handleCheckoutComplete(session);

      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(prisma.letter.create).not.toHaveBeenCalled();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LettersService } from './letters.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StripeService } from '../billing/stripe.service';
import { LetterModerationService } from './letter-moderation.service';
import { LetterTypeDto } from './dto/create-letter.dto';

// ─── Mock factories ──────────────────────────────────────────────────────────

const mockPrismaService = () => ({
  episode: { findUnique: jest.fn() },
  letter: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  pendingLetter: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
});

const mockPaymentsService = () => ({
  createTip: jest.fn(),
});

const mockNotificationsService = () => ({
  createNotification: jest.fn(),
});

const mockModerationService = () => ({
  moderate: jest.fn(),
});

const mockStripeService = () => ({
  getConnectStatus: jest.fn(),
  createLetterCheckoutSession: jest.fn(),
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LettersService', () => {
  let service: LettersService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let payments: ReturnType<typeof mockPaymentsService>;
  let notifications: ReturnType<typeof mockNotificationsService>;
  let moderation: ReturnType<typeof mockModerationService>;
  let stripeService: ReturnType<typeof mockStripeService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    payments = mockPaymentsService();
    notifications = mockNotificationsService();
    moderation = mockModerationService();
    stripeService = mockStripeService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LettersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentsService, useValue: payments },
        { provide: NotificationsService, useValue: notifications },
        { provide: StripeService, useValue: stripeService },
        { provide: LetterModerationService, useValue: moderation },
      ],
    }).compile();

    service = module.get<LettersService>(LettersService);
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const validDto = {
      episodeId: 'ep-1',
      type: LetterTypeDto.STANDARD,
      content: 'すごく面白かったです！',
    };

    beforeEach(() => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        work: { authorId: 'author-1' },
      });
      moderation.moderate.mockResolvedValue({ approved: true });
      payments.createTip.mockResolvedValue({ id: 'payment-1' });
      prisma.letter.create.mockResolvedValue({
        id: 'letter-1',
        sender: { id: 'user-1', name: 'TestUser', displayName: 'Test' },
      });
      notifications.createNotification.mockResolvedValue(undefined);
    });

    it('creates a letter successfully', async () => {
      const result = await service.create('user-1', validDto);

      expect(result.id).toBe('letter-1');
      expect(prisma.letter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            senderId: 'user-1',
            recipientId: 'author-1',
            type: 'STANDARD',
            content: 'すごく面白かったです！',
          }),
        }),
      );
    });

    it('throws BadRequestException when content exceeds maxChars', async () => {
      const longContent = 'a'.repeat(501); // STANDARD maxChars is 500
      await expect(
        service.create('user-1', { ...validDto, content: longContent }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when episode does not exist', async () => {
      prisma.episode.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', validDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when sending to own work', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        work: { authorId: 'user-1' }, // same as sender
      });

      await expect(service.create('user-1', validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when moderation rejects content', async () => {
      moderation.moderate.mockResolvedValue({
        approved: false,
        reason: '不適切な内容',
      });

      await expect(service.create('user-1', validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('uses giftAmount for GIFT type instead of fixed price', async () => {
      const giftDto = {
        episodeId: 'ep-1',
        type: LetterTypeDto.GIFT,
        content: 'すごい作品です！',
        giftAmount: 5000,
      };

      await service.create('user-1', giftDto);

      expect(payments.createTip).toHaveBeenCalledWith('user-1', 'author-1', 5000);
    });

    it('sends notification to author after letter creation', async () => {
      await service.create('user-1', validDto);

      expect(notifications.createNotification).toHaveBeenCalledWith(
        'author-1',
        expect.objectContaining({
          type: 'letter',
          title: 'レターが届きました',
        }),
      );
    });
  });

  // ─── findReceived ──────────────────────────────────────────────────────────

  describe('findReceived', () => {
    it('returns received letters filtered by approved status', async () => {
      const mockLetters = [{ id: 'letter-1' }];
      prisma.letter.findMany.mockResolvedValue(mockLetters);

      const result = await service.findReceived('author-1');

      expect(result).toEqual(mockLetters);
      expect(prisma.letter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipientId: 'author-1', moderationStatus: 'approved' },
          take: 50,
        }),
      );
    });
  });

  // ─── findSent ──────────────────────────────────────────────────────────────

  describe('findSent', () => {
    it('returns sent letters for user', async () => {
      const mockLetters = [{ id: 'letter-1' }];
      prisma.letter.findMany.mockResolvedValue(mockLetters);

      const result = await service.findSent('user-1');

      expect(result).toEqual(mockLetters);
      expect(prisma.letter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { senderId: 'user-1' },
          take: 50,
        }),
      );
    });
  });

  // ─── getEarnings ───────────────────────────────────────────────────────────

  describe('getEarnings', () => {
    it('returns earnings with 20% platform cut applied', async () => {
      prisma.letter.count
        .mockResolvedValueOnce(100) // totalLetters
        .mockResolvedValueOnce(10); // monthlyLetters
      prisma.letter.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 50000 } }) // totalEarnings
        .mockResolvedValueOnce({ _sum: { amount: 5000 } }); // monthlyEarnings

      const result = await service.getEarnings('author-1');

      expect(result.totalLetters).toBe(100);
      expect(result.monthlyLetters).toBe(10);
      expect(result.totalEarnings).toBe(40000); // 50000 * 0.8
      expect(result.monthlyEarnings).toBe(4000); // 5000 * 0.8
      expect(result.platformCutRate).toBe(0.2);
    });

    it('handles zero earnings gracefully', async () => {
      prisma.letter.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prisma.letter.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });

      const result = await service.getEarnings('author-1');

      expect(result.totalEarnings).toBe(0);
      expect(result.monthlyEarnings).toBe(0);
    });
  });

  // ─── createCheckout ────────────────────────────────────────────────────────

  describe('createCheckout', () => {
    const validDto = {
      episodeId: 'ep-1',
      type: LetterTypeDto.STANDARD,
      content: 'すごく面白かったです！',
    };

    const createdPendingLetter = {
      id: 'pending-cuid-1',
      senderId: 'user-1',
      recipientId: 'author-1',
      episodeId: 'ep-1',
      type: 'STANDARD',
      content: 'すごく面白かったです！',
      amount: 300,
    };

    beforeEach(() => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        work: { authorId: 'author-1' },
      });
      prisma.user.findUnique.mockResolvedValue({ stripeAccountId: 'acct_test123' });
      stripeService.getConnectStatus.mockResolvedValue({ chargesEnabled: true });
      moderation.moderate.mockResolvedValue({ approved: true, needsManualReview: false });
      prisma.pendingLetter.create.mockResolvedValue(createdPendingLetter);
      prisma.pendingLetter.update.mockResolvedValue(createdPendingLetter);
      prisma.pendingLetter.delete.mockResolvedValue({});
      stripeService.createLetterCheckoutSession.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/cs_test',
        sessionId: 'cs_test_session',
      });
    });

    it('happy path: returns pendingLetterId and checkoutUrl', async () => {
      const result = await service.createCheckout('user-1', 'user@test.com', validDto);

      expect(result.pendingLetterId).toBe('pending-cuid-1');
      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/pay/cs_test');
    });

    it('happy path: creates PendingLetter with correct data', async () => {
      await service.createCheckout('user-1', 'user@test.com', validDto);

      expect(prisma.pendingLetter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            senderId: 'user-1',
            recipientId: 'author-1',
            episodeId: 'ep-1',
            type: 'STANDARD',
            content: 'すごく面白かったです！',
            amount: 300,
            moderationStatus: 'approved',
          }),
        }),
      );
    });

    it('happy path: updates PendingLetter placeholder sessionId to own ID then real session ID', async () => {
      await service.createCheckout('user-1', 'user@test.com', validDto);

      // First update: own ID as unique placeholder
      expect(prisma.pendingLetter.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { id: 'pending-cuid-1' },
          data: { stripeSessionId: 'pending-cuid-1' },
        }),
      );
      // Second update: real Stripe session ID
      expect(prisma.pendingLetter.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: 'pending-cuid-1' },
          data: { stripeSessionId: 'cs_test_session' },
        }),
      );
    });

    it('happy path: calls Stripe with correct parameters', async () => {
      await service.createCheckout('user-1', 'user@test.com', validDto);

      expect(stripeService.createLetterCheckoutSession).toHaveBeenCalledWith(
        'user-1',
        'user@test.com',
        'pending-cuid-1',
        300,
        expect.objectContaining({
          recipientId: 'author-1',
          episodeId: 'ep-1',
          letterType: 'STANDARD',
        }),
      );
    });

    it('happy path: uses giftAmount for GIFT type', async () => {
      const giftDto = {
        episodeId: 'ep-1',
        type: LetterTypeDto.GIFT,
        content: 'すごい作品です！',
        giftAmount: 5000,
      };

      await service.createCheckout('user-1', 'user@test.com', giftDto);

      expect(prisma.pendingLetter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 5000 }),
        }),
      );
      expect(stripeService.createLetterCheckoutSession).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        5000,
        expect.anything(),
      );
    });

    it('happy path: defaults GIFT amount to 1000 when giftAmount is not provided', async () => {
      const giftDto = {
        episodeId: 'ep-1',
        type: LetterTypeDto.GIFT,
        content: 'すごい作品です！',
      };

      await service.createCheckout('user-1', 'user@test.com', giftDto);

      expect(prisma.pendingLetter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 1000 }),
        }),
      );
    });

    // ── Validation errors ──────────────────────────────────────────────────────

    it('throws BadRequestException when content exceeds maxChars', async () => {
      const longContent = 'a'.repeat(501); // STANDARD maxChars = 500

      await expect(
        service.createCheckout('user-1', 'user@test.com', { ...validDto, content: longContent }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when episode does not exist', async () => {
      prisma.episode.findUnique.mockResolvedValue(null);

      await expect(
        service.createCheckout('user-1', 'user@test.com', validDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when sender is same as recipient (own work)', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        work: { authorId: 'user-1' }, // same as senderId
      });

      await expect(
        service.createCheckout('user-1', 'user@test.com', validDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when moderation rejects content', async () => {
      moderation.moderate.mockResolvedValue({
        approved: false,
        needsManualReview: false,
        reason: '不適切な内容が含まれています',
      });

      await expect(
        service.createCheckout('user-1', 'user@test.com', validDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('moderation rejection uses the reason from moderation result', async () => {
      moderation.moderate.mockResolvedValue({
        approved: false,
        needsManualReview: false,
        reason: '特定の不適切な内容',
      });

      await expect(
        service.createCheckout('user-1', 'user@test.com', validDto),
      ).rejects.toThrow('特定の不適切な内容');
    });

    // ── Stripe Checkout failure → cleanup ─────────────────────────────────────

    it('deletes PendingLetter when Stripe Checkout creation fails', async () => {
      stripeService.createLetterCheckoutSession.mockRejectedValue(
        new Error('Stripe API error'),
      );

      await expect(
        service.createCheckout('user-1', 'user@test.com', validDto),
      ).rejects.toThrow('Stripe API error');

      expect(prisma.pendingLetter.delete).toHaveBeenCalledWith({
        where: { id: 'pending-cuid-1' },
      });
    });

    it('re-throws the Stripe error after cleanup', async () => {
      const stripeError = new Error('Network failure');
      stripeService.createLetterCheckoutSession.mockRejectedValue(stripeError);

      await expect(
        service.createCheckout('user-1', 'user@test.com', validDto),
      ).rejects.toThrow('Network failure');
    });

    it('does not store real sessionId when Stripe fails', async () => {
      stripeService.createLetterCheckoutSession.mockRejectedValue(
        new Error('Stripe error'),
      );

      await expect(
        service.createCheckout('user-1', 'user@test.com', validDto),
      ).rejects.toThrow();

      // Only the first update (placeholder->own ID) should have run; the second (real sessionId) should not
      expect(prisma.pendingLetter.update).toHaveBeenCalledTimes(1);
    });
  });
});

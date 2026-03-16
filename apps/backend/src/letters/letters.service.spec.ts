import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LettersService } from './letters.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LetterModerationService } from './letter-moderation.service';

// ─── Mock factories ──────────────────────────────────────────────────────────

const mockPrismaService = () => ({
  episode: { findUnique: jest.fn() },
  letter: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LettersService', () => {
  let service: LettersService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let payments: ReturnType<typeof mockPaymentsService>;
  let notifications: ReturnType<typeof mockNotificationsService>;
  let moderation: ReturnType<typeof mockModerationService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    payments = mockPaymentsService();
    notifications = mockNotificationsService();
    moderation = mockModerationService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LettersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentsService, useValue: payments },
        { provide: NotificationsService, useValue: notifications },
        { provide: LetterModerationService, useValue: moderation },
      ],
    }).compile();

    service = module.get<LettersService>(LettersService);
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const validDto = {
      episodeId: 'ep-1',
      type: 'STANDARD' as const,
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

    it('throws BadRequestException when sending stamp with SHORT type', async () => {
      await expect(
        service.create('user-1', {
          episodeId: 'ep-1',
          type: 'SHORT',
          content: '応援！',
          stampId: 'cheer-1',
        }),
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
        type: 'GIFT' as const,
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
});

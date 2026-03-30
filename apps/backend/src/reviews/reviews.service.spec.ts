import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import { CreditService } from '../billing/credit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PostType } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockPrismaService = () => ({
  review: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  reviewHelpful: {
    findUnique: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
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

const mockPostsService = () => ({
  createAutoPost: jest.fn().mockResolvedValue({}),
});

const mockCreditService = () => ({
  ensureCreditBalance: jest.fn().mockResolvedValue({}),
  grantRewardCredits: jest.fn().mockResolvedValue(true),
});

const mockNotificationsService = () => ({
  createNotification: jest.fn().mockResolvedValue({}),
});

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

const makeReview = (userId: string, workId: string, overrides: Record<string, unknown> = {}) => ({
  id: `review-${userId}-${workId}`,
  userId,
  workId,
  content: 'このレビューは最低文字数を超えた内容です。面白い作品でした。',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
  user: { id: userId, name: 'testuser', displayName: 'テストユーザー', avatarUrl: null },
  work: { id: workId, title: 'テスト作品' },
  _count: { helpfuls: 0 },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let postsService: ReturnType<typeof mockPostsService>;
  let creditService: ReturnType<typeof mockCreditService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let notificationsService: ReturnType<typeof mockNotificationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useFactory: mockPrismaService },
        { provide: PostsService, useFactory: mockPostsService },
        { provide: CreditService, useFactory: mockCreditService },
        { provide: NotificationsService, useFactory: mockNotificationsService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    prisma = module.get(PrismaService);
    postsService = module.get(PostsService);
    creditService = module.get(CreditService);
    notificationsService = module.get(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // REVIEW_REWARD_CR constant
  // -------------------------------------------------------------------------

  describe('REVIEW_REWARD_CR constant', () => {
    it('grants 5Cr (REVIEW_REWARD_CR = 5) per qualifying review', async () => {
      const content = 'このレビューは20文字以上あります。テスト確認。';
      const review = makeReview('user-1', 'work-1', { content });
      prisma.review.findUnique.mockResolvedValue(null);
      prisma.review.upsert.mockResolvedValue(review);

      await service.create('user-1', { workId: 'work-1', content });

      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect(creditService.grantRewardCredits).toHaveBeenCalledWith(
        'user-1',
        5,
        'REVIEW_REWARD',
        'レビュー報酬 (work-1)',
        2,
        'レビュー報酬',
      );
    });
  });

  // -------------------------------------------------------------------------
  // create — happy path (new review)
  // -------------------------------------------------------------------------

  describe('create', () => {
    describe('new review (not previously existing)', () => {
      beforeEach(() => {
        // No existing review
        prisma.review.findUnique.mockResolvedValue(null);
      });

      it('creates the review via upsert', async () => {
        const review = makeReview('user-1', 'work-1');
        prisma.review.upsert.mockResolvedValue(review);
        prisma.creditTransaction.findFirst.mockResolvedValue(null);
        prisma.$transaction.mockResolvedValue({});

        const result = await service.create('user-1', {
          workId: 'work-1',
          content: 'このレビューは最低文字数を超えた内容です。面白い作品でした。',
        });

        expect(prisma.review.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { userId_workId: { userId: 'user-1', workId: 'work-1' } },
            create: expect.objectContaining({ userId: 'user-1', workId: 'work-1' }),
            update: expect.objectContaining({ content: expect.any(String) }),
          }),
        );
        expect(result).toEqual(review);
      });

      it('triggers auto-post for new review', async () => {
        const review = makeReview('user-1', 'work-1');
        prisma.review.upsert.mockResolvedValue(review);
        prisma.creditTransaction.findFirst.mockResolvedValue(null);
        prisma.$transaction.mockResolvedValue({});

        await service.create('user-1', {
          workId: 'work-1',
          content: 'このレビューは最低文字数を超えた内容です。',
        });

        // createAutoPost is called fire-and-forget, give microtask queue a tick
        await Promise.resolve();
        expect(postsService.createAutoPost).toHaveBeenCalledWith(
          'user-1',
          PostType.AUTO_REVIEW,
          expect.objectContaining({ workId: 'work-1' }),
        );
      });

      it('grants 5Cr reward for new review with 20+ characters', async () => {
        const longContent = 'a'.repeat(20); // exactly MIN_REVIEW_LENGTH
        const review = makeReview('user-1', 'work-1', { content: longContent });
        prisma.review.upsert.mockResolvedValue(review);

        await service.create('user-1', { workId: 'work-1', content: longContent });

        // Allow async reward to run through try/catch
        for (let i = 0; i < 10; i++) await Promise.resolve();

        expect(creditService.ensureCreditBalance).toHaveBeenCalledWith('user-1');
      });

      it('does NOT grant reward for review under 20 characters', async () => {
        const shortContent = 'a'.repeat(19); // one less than MIN_REVIEW_LENGTH
        const review = makeReview('user-1', 'work-1', { content: shortContent });
        prisma.review.upsert.mockResolvedValue(review);

        await service.create('user-1', { workId: 'work-1', content: shortContent });

        await Promise.resolve();
        await Promise.resolve();

        // ensureCreditBalance should not be called for short reviews
        expect(creditService.ensureCreditBalance).not.toHaveBeenCalled();
      });

      it('does NOT grant reward for review of exactly 19 characters', async () => {
        const shortContent = '12345678901234567890'.slice(0, 19);
        const review = makeReview('user-1', 'work-1', { content: shortContent });
        prisma.review.upsert.mockResolvedValue(review);

        await service.create('user-1', { workId: 'work-1', content: shortContent });

        await Promise.resolve();
        await Promise.resolve();

        expect(creditService.ensureCreditBalance).not.toHaveBeenCalled();
      });

      it('grants reward for review of exactly 20 characters (boundary)', async () => {
        const exactContent = '12345678901234567890'; // exactly 20 chars
        const review = makeReview('user-1', 'work-1', { content: exactContent });
        prisma.review.upsert.mockResolvedValue(review);

        await service.create('user-1', { workId: 'work-1', content: exactContent });

        for (let i = 0; i < 10; i++) await Promise.resolve();

        expect(creditService.ensureCreditBalance).toHaveBeenCalledWith('user-1');
      });

      it('inserts creditTransaction with REVIEW_REWARD type and correct amount', async () => {
        const content = 'このレビューは20文字以上あります。テスト用のレビュー。';
        const review = makeReview('user-1', 'work-1', { content });
        prisma.review.upsert.mockResolvedValue(review);

        await service.create('user-1', { workId: 'work-1', content });

        for (let i = 0; i < 10; i++) await Promise.resolve();

        // grantRewardCredits called with REVIEW_REWARD and amount 5
        expect(creditService.grantRewardCredits).toHaveBeenCalledWith(
          'user-1',
          5,
          'REVIEW_REWARD',
          'レビュー報酬 (work-1)',
          2,
          'レビュー報酬',
        );
      });
    });

    // -----------------------------------------------------------------------
    // create — update review (existing review)
    // -----------------------------------------------------------------------

    describe('updating an existing review', () => {
      it('does NOT trigger auto-post on update', async () => {
        const existing = makeReview('user-1', 'work-1');
        prisma.review.findUnique.mockResolvedValue(existing);
        prisma.review.upsert.mockResolvedValue(existing);

        await service.create('user-1', {
          workId: 'work-1',
          content: 'このレビューは更新された内容です。変わりました。',
        });

        await Promise.resolve();
        expect(postsService.createAutoPost).not.toHaveBeenCalled();
      });

      it('does NOT grant Cr reward on update even if content is long enough', async () => {
        const existing = makeReview('user-1', 'work-1');
        prisma.review.findUnique.mockResolvedValue(existing);
        prisma.review.upsert.mockResolvedValue(existing);

        await service.create('user-1', {
          workId: 'work-1',
          content: 'これは更新されたレビューで、20文字を超えています。しかし報酬は付与されない。',
        });

        await Promise.resolve();
        await Promise.resolve();

        expect(creditService.ensureCreditBalance).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    // create — duplicate reward prevention
    // -----------------------------------------------------------------------

    describe('duplicate reward prevention', () => {
      it('calls grantRewardCredits which handles duplicate prevention internally', async () => {
        prisma.review.findUnique.mockResolvedValue(null);
        const review = makeReview('user-1', 'work-1');
        prisma.review.upsert.mockResolvedValue(review);
        creditService.grantRewardCredits.mockResolvedValue(false); // duplicate found

        await service.create('user-1', {
          workId: 'work-1',
          content: 'このレビューは20文字以上あります。二重付与テスト。',
        });

        await Promise.resolve();
        await Promise.resolve();

        // grantRewardCredits was called (returns false when duplicate exists)
        expect(creditService.grantRewardCredits).toHaveBeenCalledWith(
          'user-1',
          5,
          'REVIEW_REWARD',
          'レビュー報酬 (work-1)',
          2,
          'レビュー報酬',
        );
        // prisma.creditBalance.update should NOT be called directly
        expect(prisma.creditBalance.update).not.toHaveBeenCalled();
      });

      it('calls grantRewardCredits with correct workId in description', async () => {
        prisma.review.findUnique.mockResolvedValue(null);
        const review = makeReview('user-1', 'work-42');
        prisma.review.upsert.mockResolvedValue(review);

        await service.create('user-1', {
          workId: 'work-42',
          content: 'このレビューは最低文字数を超えた内容です。',
        });

        await Promise.resolve();
        await Promise.resolve();

        expect(creditService.grantRewardCredits).toHaveBeenCalledWith(
          'user-1',
          5,
          'REVIEW_REWARD',
          'レビュー報酬 (work-42)',
          2,
          'レビュー報酬',
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // findByWork
  // -------------------------------------------------------------------------

  describe('findByWork', () => {
    it('returns reviews for the given workId ordered by createdAt desc', async () => {
      const reviews = [
        makeReview('u1', 'work-1'),
        makeReview('u2', 'work-1'),
      ];
      prisma.review.findMany.mockResolvedValue(reviews);

      const result = await service.findByWork('work-1');

      expect(prisma.review.findMany).toHaveBeenCalledWith({
        where: { workId: 'work-1' },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
          _count: { select: { helpfuls: true } },
        },
      });
      expect(result).toEqual(reviews);
    });

    it('returns empty array when no reviews exist', async () => {
      prisma.review.findMany.mockResolvedValue([]);

      const result = await service.findByWork('work-empty');

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // toggleHelpful
  // -------------------------------------------------------------------------

  describe('toggleHelpful', () => {
    it('removes helpful mark and returns { helpful: false } when it already exists', async () => {
      prisma.reviewHelpful.findUnique.mockResolvedValue({ id: 'helpful-1', userId: 'u1', reviewId: 'r1' });
      prisma.reviewHelpful.delete.mockResolvedValue({});

      const result = await service.toggleHelpful('u1', 'r1');

      expect(prisma.reviewHelpful.delete).toHaveBeenCalledWith({ where: { id: 'helpful-1' } });
      expect(result).toEqual({ helpful: false });
    });

    it('creates helpful mark and returns { helpful: true } when not previously marked', async () => {
      prisma.reviewHelpful.findUnique.mockResolvedValue(null);
      prisma.reviewHelpful.create.mockResolvedValue({});

      const result = await service.toggleHelpful('u1', 'r1');

      expect(prisma.reviewHelpful.create).toHaveBeenCalledWith({ data: { userId: 'u1', reviewId: 'r1' } });
      expect(result).toEqual({ helpful: true });
    });

    it('uses compound unique key userId_reviewId for lookup', async () => {
      prisma.reviewHelpful.findUnique.mockResolvedValue(null);
      prisma.reviewHelpful.create.mockResolvedValue({});

      await service.toggleHelpful('user-abc', 'review-xyz');

      expect(prisma.reviewHelpful.findUnique).toHaveBeenCalledWith({
        where: { userId_reviewId: { userId: 'user-abc', reviewId: 'review-xyz' } },
      });
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe('delete', () => {
    it('deletes review and returns { deleted: true } when owner calls it', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'r1', userId: 'user-1' });
      prisma.review.delete.mockResolvedValue({});

      const result = await service.delete('r1', 'user-1');

      expect(prisma.review.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when review does not exist', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when non-owner attempts deletion', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'r1', userId: 'owner-user' });

      await expect(service.delete('r1', 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('does not call delete when review not found', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.delete('r1', 'u1')).rejects.toThrow();
      expect(prisma.review.delete).not.toHaveBeenCalled();
    });
  });
});

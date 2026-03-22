import { Test, TestingModule } from '@nestjs/testing';
import { ReactionsService } from './reactions.service';
import { PrismaService } from '../common/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

const mockPrismaService = () => ({
  episodeReaction: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  work: {
    findMany: jest.fn(),
  },
});

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

const makeReaction = (
  userId: string,
  episodeId: string,
  workId: string,
  overrides: Record<string, unknown> = {},
) => ({
  id: `reaction-${userId}-${episodeId}`,
  userId,
  episodeId,
  workId,
  claps: 3,
  emotion: 'moved',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
  ...overrides,
});

const makeReactionWithIncludes = (
  userId: string,
  episodeId: string,
  workId: string,
  overrides: Record<string, unknown> = {},
) => ({
  ...makeReaction(userId, episodeId, workId, overrides),
  user: { displayName: 'テストユーザー', name: 'testuser' },
  episode: { title: '第1話', orderIndex: 0 },
});

const makeWork = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `テスト作品 ${id}`,
  genre: 'FANTASY',
  status: 'PUBLISHED',
  author: { displayName: '作者名', name: 'author' },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReactionsService', () => {
  let service: ReactionsService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReactionsService,
        { provide: PrismaService, useFactory: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReactionsService>(ReactionsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // upsertReaction
  // -------------------------------------------------------------------------

  describe('upsertReaction', () => {
    it('creates a new reaction when none exists', async () => {
      const expected = makeReaction('user-1', 'ep-1', 'work-1');
      prisma.episodeReaction.upsert.mockResolvedValue(expected);

      const result = await service.upsertReaction('user-1', 'ep-1', 'work-1', {
        claps: 3,
        emotion: 'moved',
      });

      expect(prisma.episodeReaction.upsert).toHaveBeenCalledWith({
        where: { userId_episodeId: { userId: 'user-1', episodeId: 'ep-1' } },
        create: { userId: 'user-1', episodeId: 'ep-1', workId: 'work-1', claps: 3, emotion: 'moved' },
        update: { claps: 3, emotion: 'moved' },
      });
      expect(result).toEqual(expected);
    });

    it('updates an existing reaction (upsert semantics)', async () => {
      const updated = makeReaction('user-1', 'ep-1', 'work-1', { claps: 5, emotion: 'fired_up' });
      prisma.episodeReaction.upsert.mockResolvedValue(updated);

      const result = await service.upsertReaction('user-1', 'ep-1', 'work-1', {
        claps: 5,
        emotion: 'fired_up',
      });

      expect(prisma.episodeReaction.upsert).toHaveBeenCalledTimes(1);
      expect(result.claps).toBe(5);
      expect(result.emotion).toBe('fired_up');
    });

    it('passes claps value 1 (minimum allowed)', async () => {
      const expected = makeReaction('user-1', 'ep-1', 'work-1', { claps: 1 });
      prisma.episodeReaction.upsert.mockResolvedValue(expected);

      await service.upsertReaction('user-1', 'ep-1', 'work-1', { claps: 1 });

      expect(prisma.episodeReaction.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ claps: 1 }),
          update: expect.objectContaining({ claps: 1 }),
        }),
      );
    });

    it('passes claps value 5 (maximum allowed)', async () => {
      const expected = makeReaction('user-1', 'ep-1', 'work-1', { claps: 5 });
      prisma.episodeReaction.upsert.mockResolvedValue(expected);

      await service.upsertReaction('user-1', 'ep-1', 'work-1', { claps: 5 });

      expect(prisma.episodeReaction.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ claps: 5 }),
          update: expect.objectContaining({ claps: 5 }),
        }),
      );
    });

    it('handles reaction without emotion (emotion is undefined)', async () => {
      const expected = makeReaction('user-1', 'ep-1', 'work-1', { emotion: undefined });
      prisma.episodeReaction.upsert.mockResolvedValue(expected);

      await service.upsertReaction('user-1', 'ep-1', 'work-1', { claps: 2 });

      expect(prisma.episodeReaction.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ emotion: undefined }),
        }),
      );
    });

    it('uses the correct compound unique key (userId + episodeId)', async () => {
      prisma.episodeReaction.upsert.mockResolvedValue(makeReaction('u', 'ep', 'w'));

      await service.upsertReaction('u', 'ep', 'w', { claps: 1 });

      expect(prisma.episodeReaction.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_episodeId: { userId: 'u', episodeId: 'ep' } },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getEpisodeReactions
  // -------------------------------------------------------------------------

  describe('getEpisodeReactions', () => {
    it('returns correct aggregation for multiple reactions', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([
        makeReaction('u1', 'ep-1', 'w1', { claps: 3, emotion: 'moved' }),
        makeReaction('u2', 'ep-1', 'w1', { claps: 5, emotion: 'moved' }),
        makeReaction('u3', 'ep-1', 'w1', { claps: 1, emotion: 'warm' }),
      ]);

      const result = await service.getEpisodeReactions('ep-1');

      expect(result.totalClaps).toBe(9);
      expect(result.reactionCount).toBe(3);
      expect(result.emotions).toEqual({ moved: 2, warm: 1 });
      expect(result.myReaction).toBeNull();
    });

    it('returns myReaction for authenticated user', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([
        makeReaction('user-1', 'ep-1', 'w1', { claps: 4, emotion: 'surprised' }),
        makeReaction('user-2', 'ep-1', 'w1', { claps: 2, emotion: 'warm' }),
      ]);

      const result = await service.getEpisodeReactions('ep-1', 'user-1');

      expect(result.myReaction).toEqual({ claps: 4, emotion: 'surprised' });
    });

    it('returns null myReaction when authenticated user has no reaction', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([
        makeReaction('user-2', 'ep-1', 'w1', { claps: 3, emotion: 'moved' }),
      ]);

      const result = await service.getEpisodeReactions('ep-1', 'user-99');

      expect(result.myReaction).toBeNull();
    });

    it('returns null myReaction for anonymous user (no userId provided)', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([
        makeReaction('user-1', 'ep-1', 'w1', { claps: 3, emotion: 'moved' }),
      ]);

      const result = await service.getEpisodeReactions('ep-1');

      expect(result.myReaction).toBeNull();
    });

    it('returns zeros and empty emotions for episode with no reactions', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([]);

      const result = await service.getEpisodeReactions('ep-empty');

      expect(result.totalClaps).toBe(0);
      expect(result.reactionCount).toBe(0);
      expect(result.emotions).toEqual({});
      expect(result.myReaction).toBeNull();
    });

    it('skips emotion counting when emotion is null/undefined', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([
        makeReaction('u1', 'ep-1', 'w1', { claps: 2, emotion: null }),
        makeReaction('u2', 'ep-1', 'w1', { claps: 3, emotion: undefined }),
      ]);

      const result = await service.getEpisodeReactions('ep-1');

      expect(result.emotions).toEqual({});
      expect(result.totalClaps).toBe(5);
    });

    it('queries by episodeId', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([]);

      await service.getEpisodeReactions('ep-42');

      expect(prisma.episodeReaction.findMany).toHaveBeenCalledWith({
        where: { episodeId: 'ep-42' },
      });
    });

    it('returns only claps and emotion in myReaction (not full record)', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([
        makeReaction('user-1', 'ep-1', 'w1', { claps: 3, emotion: 'warm' }),
      ]);

      const result = await service.getEpisodeReactions('ep-1', 'user-1');

      expect(result.myReaction).toEqual({ claps: 3, emotion: 'warm' });
      expect(result.myReaction).not.toHaveProperty('id');
      expect(result.myReaction).not.toHaveProperty('userId');
    });
  });

  // -------------------------------------------------------------------------
  // getWorkReactions
  // -------------------------------------------------------------------------

  describe('getWorkReactions', () => {
    it('groups reactions by episode and calculates totals', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([
        { ...makeReaction('u1', 'ep-1', 'work-1', { claps: 3 }), episode: { id: 'ep-1', title: '第1話', orderIndex: 0 } },
        { ...makeReaction('u2', 'ep-1', 'work-1', { claps: 2 }), episode: { id: 'ep-1', title: '第1話', orderIndex: 0 } },
        { ...makeReaction('u3', 'ep-2', 'work-1', { claps: 5 }), episode: { id: 'ep-2', title: '第2話', orderIndex: 1 } },
      ]);

      const result = await service.getWorkReactions('work-1');

      expect(result.totalClaps).toBe(10);
      expect(result.totalReactions).toBe(3);
      expect(result.byEpisode).toHaveLength(2);

      const ep1 = result.byEpisode.find(e => e.episodeId === 'ep-1');
      expect(ep1).toEqual({ episodeId: 'ep-1', title: '第1話', orderIndex: 0, claps: 5, reactionCount: 2 });

      const ep2 = result.byEpisode.find(e => e.episodeId === 'ep-2');
      expect(ep2).toEqual({ episodeId: 'ep-2', title: '第2話', orderIndex: 1, claps: 5, reactionCount: 1 });
    });

    it('sorts episodes by orderIndex ascending', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([
        { ...makeReaction('u1', 'ep-3', 'work-1'), episode: { id: 'ep-3', title: '第3話', orderIndex: 2 } },
        { ...makeReaction('u1', 'ep-1', 'work-1'), episode: { id: 'ep-1', title: '第1話', orderIndex: 0 } },
        { ...makeReaction('u1', 'ep-2', 'work-1'), episode: { id: 'ep-2', title: '第2話', orderIndex: 1 } },
      ]);

      const result = await service.getWorkReactions('work-1');

      expect(result.byEpisode[0].orderIndex).toBe(0);
      expect(result.byEpisode[1].orderIndex).toBe(1);
      expect(result.byEpisode[2].orderIndex).toBe(2);
    });

    it('returns empty result when no reactions exist', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([]);

      const result = await service.getWorkReactions('work-empty');

      expect(result.byEpisode).toEqual([]);
      expect(result.totalClaps).toBe(0);
      expect(result.totalReactions).toBe(0);
    });

    it('queries with includes for episode info', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([]);

      await service.getWorkReactions('work-1');

      expect(prisma.episodeReaction.findMany).toHaveBeenCalledWith({
        where: { workId: 'work-1' },
        include: {
          episode: { select: { id: true, title: true, orderIndex: true } },
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // getWorkReactionFeed
  // -------------------------------------------------------------------------

  describe('getWorkReactionFeed', () => {
    it('returns time-ordered feed with user and episode info', async () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const earlier = new Date('2024-01-15T10:00:00Z');

      prisma.episodeReaction.findMany.mockResolvedValue([
        { ...makeReactionWithIncludes('u1', 'ep-1', 'work-1', { createdAt: now, claps: 5, emotion: 'moved' }), user: { displayName: '表示名', name: 'user1' }, episode: { title: '第1話', orderIndex: 0 } },
        { ...makeReactionWithIncludes('u2', 'ep-1', 'work-1', { createdAt: earlier, claps: 3, emotion: 'warm' }), user: { displayName: null, name: 'user2' }, episode: { title: '第1話', orderIndex: 0 } },
      ]);

      const result = await service.getWorkReactionFeed('work-1');

      expect(result).toHaveLength(2);
      expect(result[0].claps).toBe(5);
      expect(result[0].emotion).toBe('moved');
      expect(result[0].episodeTitle).toBe('第1話');
      expect(result[0].episodeOrderIndex).toBe(0);
      expect(result[0].userDisplayName).toBe('表示名');
    });

    it('falls back to name when displayName is null', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([
        {
          ...makeReactionWithIncludes('u1', 'ep-1', 'work-1'),
          user: { displayName: null, name: 'fallback_name' },
          episode: { title: '第1話', orderIndex: 0 },
        },
      ]);

      const result = await service.getWorkReactionFeed('work-1');

      expect(result[0].userDisplayName).toBe('fallback_name');
    });

    it('uses displayName over name when displayName is set', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([
        {
          ...makeReactionWithIncludes('u1', 'ep-1', 'work-1'),
          user: { displayName: 'My Display', name: 'myname' },
          episode: { title: '第1話', orderIndex: 0 },
        },
      ]);

      const result = await service.getWorkReactionFeed('work-1');

      expect(result[0].userDisplayName).toBe('My Display');
    });

    it('maps feed items to the expected shape (id, claps, emotion, createdAt)', async () => {
      const createdAt = new Date('2024-06-01T00:00:00Z');
      prisma.episodeReaction.findMany.mockResolvedValue([
        {
          id: 'rxn-42',
          userId: 'u1',
          episodeId: 'ep-1',
          workId: 'work-1',
          claps: 4,
          emotion: 'thoughtful',
          createdAt,
          user: { displayName: 'Author', name: 'author' },
          episode: { title: 'Ep Title', orderIndex: 2 },
        },
      ]);

      const [item] = await service.getWorkReactionFeed('work-1');

      expect(item).toEqual({
        id: 'rxn-42',
        userDisplayName: 'Author',
        episodeTitle: 'Ep Title',
        episodeOrderIndex: 2,
        claps: 4,
        emotion: 'thoughtful',
        createdAt,
      });
    });

    it('applies default limit of 20', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([]);

      await service.getWorkReactionFeed('work-1');

      expect(prisma.episodeReaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('respects custom limit', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([]);

      await service.getWorkReactionFeed('work-1', 5);

      expect(prisma.episodeReaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('orders by createdAt desc', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([]);

      await service.getWorkReactionFeed('work-1');

      expect(prisma.episodeReaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('returns empty array when no feed items', async () => {
      prisma.episodeReaction.findMany.mockResolvedValue([]);

      const result = await service.getWorkReactionFeed('work-1');

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getTrendingWorks
  // -------------------------------------------------------------------------

  describe('getTrendingWorks', () => {
    it('returns works ordered by reaction count with totals', async () => {
      prisma.episodeReaction.groupBy.mockResolvedValue([
        { workId: 'work-1', _count: 15, _sum: { claps: 45 } },
        { workId: 'work-2', _count: 8, _sum: { claps: 20 } },
      ]);
      prisma.work.findMany.mockResolvedValue([
        makeWork('work-1'),
        makeWork('work-2'),
      ]);

      const result = await service.getTrendingWorks();

      expect(result).toHaveLength(2);
      expect(result[0].reactionCount).toBe(15);
      expect(result[0].totalClaps).toBe(45);
      expect(result[0].work.id).toBe('work-1');
      expect(result[1].reactionCount).toBe(8);
      expect(result[1].totalClaps).toBe(20);
    });

    it('filters out unpublished works (not in work.findMany results)', async () => {
      prisma.episodeReaction.groupBy.mockResolvedValue([
        { workId: 'published-1', _count: 10, _sum: { claps: 30 } },
        { workId: 'draft-1', _count: 5, _sum: { claps: 15 } },
      ]);
      // Only published-1 is returned (draft filtered by status: PUBLISHED in query)
      prisma.work.findMany.mockResolvedValue([makeWork('published-1')]);

      const result = await service.getTrendingWorks();

      expect(result).toHaveLength(1);
      expect(result[0].work.id).toBe('published-1');
    });

    it('returns empty array when no reactions in last 24h', async () => {
      prisma.episodeReaction.groupBy.mockResolvedValue([]);

      const result = await service.getTrendingWorks();

      expect(result).toEqual([]);
      expect(prisma.work.findMany).not.toHaveBeenCalled();
    });

    it('handles _sum.claps being null (no claps in window)', async () => {
      prisma.episodeReaction.groupBy.mockResolvedValue([
        { workId: 'work-1', _count: 3, _sum: { claps: null } },
      ]);
      prisma.work.findMany.mockResolvedValue([makeWork('work-1')]);

      const result = await service.getTrendingWorks();

      expect(result[0].totalClaps).toBe(0);
    });

    it('applies default limit of 5', async () => {
      prisma.episodeReaction.groupBy.mockResolvedValue([]);

      await service.getTrendingWorks();

      expect(prisma.episodeReaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('respects custom limit', async () => {
      prisma.episodeReaction.groupBy.mockResolvedValue([]);

      await service.getTrendingWorks(10);

      expect(prisma.episodeReaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it('filters reactions by last 24h using gte on createdAt', async () => {
      const before = Date.now();
      prisma.episodeReaction.groupBy.mockResolvedValue([]);

      await service.getTrendingWorks();

      const callArgs = prisma.episodeReaction.groupBy.mock.calls[0][0];
      const since: Date = callArgs.where.createdAt.gte;
      const after = Date.now();

      // since should be approximately 24h ago
      const expectedMs = 24 * 60 * 60 * 1000;
      expect(before - since.getTime()).toBeGreaterThanOrEqual(expectedMs - 100);
      expect(after - since.getTime()).toBeLessThanOrEqual(expectedMs + 100);
    });

    it('queries works with status PUBLISHED', async () => {
      prisma.episodeReaction.groupBy.mockResolvedValue([
        { workId: 'w1', _count: 1, _sum: { claps: 1 } },
      ]);
      prisma.work.findMany.mockResolvedValue([]);

      await service.getTrendingWorks();

      expect(prisma.work.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PUBLISHED' }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getAuthorReactionFeed
  // -------------------------------------------------------------------------

  describe('getAuthorReactionFeed', () => {
    it('returns reaction feed across all author works', async () => {
      prisma.work.findMany.mockResolvedValue([
        { id: 'work-1', title: '作品A' },
        { id: 'work-2', title: '作品B' },
      ]);
      const createdAt = new Date('2024-03-01T08:00:00Z');
      prisma.episodeReaction.findMany.mockResolvedValue([
        {
          id: 'rxn-1',
          userId: 'reader-1',
          episodeId: 'ep-1',
          workId: 'work-1',
          claps: 5,
          emotion: 'moved',
          createdAt,
          user: { displayName: '読者A', name: 'reader_a' },
          episode: { title: '第1話', orderIndex: 0 },
        },
        {
          id: 'rxn-2',
          userId: 'reader-2',
          episodeId: 'ep-5',
          workId: 'work-2',
          claps: 3,
          emotion: 'warm',
          createdAt,
          user: { displayName: null, name: 'reader_b' },
          episode: { title: '第5話', orderIndex: 4 },
        },
      ]);

      const result = await service.getAuthorReactionFeed('author-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'rxn-1',
        type: 'reaction',
        userDisplayName: '読者A',
        workTitle: '作品A',
        episodeTitle: '第1話',
        episodeOrderIndex: 0,
        claps: 5,
        emotion: 'moved',
        createdAt,
      });
      expect(result[1].userDisplayName).toBe('reader_b');
      expect(result[1].workTitle).toBe('作品B');
    });

    it('returns empty array when author has no works', async () => {
      prisma.work.findMany.mockResolvedValue([]);

      const result = await service.getAuthorReactionFeed('author-no-works');

      expect(result).toEqual([]);
      expect(prisma.episodeReaction.findMany).not.toHaveBeenCalled();
    });

    it('returns empty array when author has works but no reactions', async () => {
      prisma.work.findMany.mockResolvedValue([{ id: 'work-1', title: '作品A' }]);
      prisma.episodeReaction.findMany.mockResolvedValue([]);

      const result = await service.getAuthorReactionFeed('author-1');

      expect(result).toEqual([]);
    });

    it('sets type to "reaction" on every item', async () => {
      prisma.work.findMany.mockResolvedValue([{ id: 'work-1', title: '作品A' }]);
      prisma.episodeReaction.findMany.mockResolvedValue([
        {
          id: 'rxn-1',
          userId: 'u1',
          episodeId: 'ep-1',
          workId: 'work-1',
          claps: 2,
          emotion: null,
          createdAt: new Date(),
          user: { displayName: 'U', name: 'u' },
          episode: { title: 'T', orderIndex: 0 },
        },
      ]);

      const result = await service.getAuthorReactionFeed('author-1');

      expect(result[0].type).toBe('reaction');
    });

    it('falls back to name when displayName is null', async () => {
      prisma.work.findMany.mockResolvedValue([{ id: 'work-1', title: '作品A' }]);
      prisma.episodeReaction.findMany.mockResolvedValue([
        {
          id: 'rxn-1',
          userId: 'u1',
          episodeId: 'ep-1',
          workId: 'work-1',
          claps: 2,
          emotion: null,
          createdAt: new Date(),
          user: { displayName: null, name: 'fallback' },
          episode: { title: 'T', orderIndex: 0 },
        },
      ]);

      const result = await service.getAuthorReactionFeed('author-1');

      expect(result[0].userDisplayName).toBe('fallback');
    });

    it('queries reactions only for author work IDs', async () => {
      prisma.work.findMany.mockResolvedValue([
        { id: 'w-a', title: 'A' },
        { id: 'w-b', title: 'B' },
      ]);
      prisma.episodeReaction.findMany.mockResolvedValue([]);

      await service.getAuthorReactionFeed('author-1');

      expect(prisma.episodeReaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workId: { in: ['w-a', 'w-b'] } },
        }),
      );
    });

    it('applies default limit of 20', async () => {
      prisma.work.findMany.mockResolvedValue([{ id: 'work-1', title: 'A' }]);
      prisma.episodeReaction.findMany.mockResolvedValue([]);

      await service.getAuthorReactionFeed('author-1');

      expect(prisma.episodeReaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('respects custom limit', async () => {
      prisma.work.findMany.mockResolvedValue([{ id: 'work-1', title: 'A' }]);
      prisma.episodeReaction.findMany.mockResolvedValue([]);

      await service.getAuthorReactionFeed('author-1', 5);

      expect(prisma.episodeReaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('uses empty string for workTitle when workId is not in workMap (defensive)', async () => {
      prisma.work.findMany.mockResolvedValue([{ id: 'work-1', title: '作品A' }]);
      prisma.episodeReaction.findMany.mockResolvedValue([
        {
          id: 'rxn-1',
          userId: 'u1',
          episodeId: 'ep-1',
          workId: 'work-UNKNOWN',
          claps: 1,
          emotion: null,
          createdAt: new Date(),
          user: { displayName: 'U', name: 'u' },
          episode: { title: 'T', orderIndex: 0 },
        },
      ]);

      const result = await service.getAuthorReactionFeed('author-1');

      expect(result[0].workTitle).toBe('');
    });
  });
});

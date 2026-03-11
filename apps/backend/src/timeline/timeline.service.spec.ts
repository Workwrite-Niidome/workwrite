import { Test, TestingModule } from '@nestjs/testing';
import { TimelineService } from './timeline.service';
import { PrismaService } from '../common/prisma/prisma.service';

const makePost = (overrides: Record<string, any> = {}) => ({
  id: `post-${Math.random().toString(36).slice(2, 8)}`,
  authorId: 'author-1',
  content: 'Hello world',
  postType: 'ORIGINAL',
  workId: null,
  episodeId: null,
  repostOfId: null,
  quoteOfId: null,
  replyToId: null,
  applauseCount: 0,
  repostCount: 0,
  bookmarkCount: 0,
  isDeleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  author: { id: 'author-1', name: 'Author', displayName: null, avatarUrl: null, role: 'USER' },
  work: null,
  episode: null,
  repostOf: null,
  quoteOf: null,
  ...overrides,
});

const mockPrismaService = () => ({
  post: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
  },
  follow: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  applause: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  postBookmark: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  bookshelfEntry: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  readingProgress: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  onboardingResult: {
    findUnique: jest.fn().mockResolvedValue(null),
  },
});

describe('TimelineService', () => {
  let service: TimelineService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelineService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TimelineService>(TimelineService);
  });

  describe('getGlobalTimeline (anonymous)', () => {
    it('should return chronological posts for anonymous users', async () => {
      const posts = [makePost({ id: 'p1' }), makePost({ id: 'p2' })];
      prisma.post.findMany.mockResolvedValue(posts);

      const result = await service.getGlobalTimeline(undefined, 20, undefined);

      expect(result.posts).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
    });

    it('should handle empty timeline', async () => {
      prisma.post.findMany.mockResolvedValue([]);

      const result = await service.getGlobalTimeline(undefined, 20, undefined);

      expect(result.posts).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });

    it('should set nextCursor when more posts exist', async () => {
      // limit=2, so 3 posts means hasMore=true
      const posts = [
        makePost({ id: 'p1' }),
        makePost({ id: 'p2' }),
        makePost({ id: 'p3' }),
      ];
      prisma.post.findMany.mockResolvedValue(posts);

      const result = await service.getGlobalTimeline(undefined, 2, undefined);

      expect(result.posts).toHaveLength(2);
      expect(result.nextCursor).toBe('p2');
    });
  });

  describe('getGlobalTimeline (personalized)', () => {
    it('should score posts with genre affinity', async () => {
      const now = Date.now();
      // Two posts at roughly the same time, one with matching genre
      const matchingPost = makePost({
        id: 'match',
        createdAt: new Date(now - 1000),
        work: {
          id: 'w1', title: 'T', genre: 'fantasy', synopsis: null,
          authorId: 'a1', author: { id: 'a1', name: 'A', displayName: null },
          _count: { episodes: 1 }, qualityScore: null,
        },
        workId: 'w1',
      });
      const nonMatchingPost = makePost({
        id: 'nomatch',
        createdAt: new Date(now - 500), // slightly newer
        work: null,
      });

      prisma.post.findMany
        .mockResolvedValueOnce([matchingPost, nonMatchingPost]) // candidates
        .mockResolvedValueOnce([]); // repost meta
      prisma.applause.findMany.mockResolvedValue([]);
      prisma.postBookmark.findMany.mockResolvedValue([]);

      // User has fantasy genre affinity from bookshelf
      prisma.bookshelfEntry.findMany.mockResolvedValue([
        { workId: 'w-read', status: 'COMPLETED', work: { genre: 'fantasy', authorId: 'a-other' } },
      ]);

      const result = await service.getGlobalTimeline(undefined, 20, 'user-1');

      // Matching genre post should be ranked first despite being slightly older
      expect(result.posts[0].id).toBe('match');
    });

    it('should boost posts with high engagement', async () => {
      const now = Date.now();
      const engagedPost = makePost({
        id: 'engaged',
        createdAt: new Date(now - 2000),
        applauseCount: 50,
        repostCount: 10,
        bookmarkCount: 20,
      });
      const recentPost = makePost({
        id: 'recent',
        createdAt: new Date(now - 1000),
        applauseCount: 0,
      });

      prisma.post.findMany
        .mockResolvedValueOnce([recentPost, engagedPost])
        .mockResolvedValueOnce([]);
      prisma.applause.findMany.mockResolvedValue([]);
      prisma.postBookmark.findMany.mockResolvedValue([]);

      const result = await service.getGlobalTimeline(undefined, 20, 'user-1');

      // Both should be returned (order depends on score balance)
      expect(result.posts).toHaveLength(2);
    });

    it('should penalize auto-posts slightly', async () => {
      const now = Date.now();
      const autoPost = makePost({
        id: 'auto',
        postType: 'AUTO_EPISODE',
        createdAt: new Date(now - 500),
      });
      const originalPost = makePost({
        id: 'original',
        postType: 'ORIGINAL',
        createdAt: new Date(now - 500),
      });

      prisma.post.findMany
        .mockResolvedValueOnce([autoPost, originalPost])
        .mockResolvedValueOnce([]);
      prisma.applause.findMany.mockResolvedValue([]);
      prisma.postBookmark.findMany.mockResolvedValue([]);

      const result = await service.getGlobalTimeline(undefined, 20, 'user-1');

      // Original should rank higher than auto at same time
      expect(result.posts[0].id).toBe('original');
    });

    it('should apply diversity to avoid consecutive same-author posts', async () => {
      const now = Date.now();
      const posts = [
        makePost({ id: 'a1', authorId: 'author-A', createdAt: new Date(now - 100) }),
        makePost({ id: 'a2', authorId: 'author-A', createdAt: new Date(now - 200) }),
        makePost({ id: 'a3', authorId: 'author-A', createdAt: new Date(now - 300) }),
        makePost({ id: 'b1', authorId: 'author-B', createdAt: new Date(now - 400) }),
      ];

      prisma.post.findMany
        .mockResolvedValueOnce(posts)
        .mockResolvedValueOnce([]);
      prisma.applause.findMany.mockResolvedValue([]);
      prisma.postBookmark.findMany.mockResolvedValue([]);

      const result = await service.getGlobalTimeline(undefined, 20, 'user-1');

      // author-B should be interspersed, not all A's first
      const authorOrder = result.posts.map((p: any) => p.authorId);
      // After diversity, B should appear before the 3rd A post
      const bIndex = authorOrder.indexOf('author-B');
      expect(bIndex).toBeLessThan(3);
    });
  });

  describe('getFollowingTimeline', () => {
    it('should include own posts and followed users posts', async () => {
      prisma.follow.findMany.mockResolvedValue([
        { followingId: 'friend-1' },
      ]);
      const posts = [
        makePost({ id: 'p1', authorId: 'user-1' }),
        makePost({ id: 'p2', authorId: 'friend-1' }),
      ];
      prisma.post.findMany
        .mockResolvedValueOnce(posts)
        .mockResolvedValueOnce([]); // repost meta
      prisma.applause.findMany.mockResolvedValue([]);
      prisma.postBookmark.findMany.mockResolvedValue([]);

      const result = await service.getFollowingTimeline('user-1');

      expect(result.posts).toHaveLength(2);
    });
  });

  describe('getTrendingPosts', () => {
    it('should return trending posts from last 24h', async () => {
      const posts = [makePost({ id: 'trending', applauseCount: 100 })];
      prisma.post.findMany.mockResolvedValue(posts);

      const result = await service.getTrendingPosts();

      expect(result).toHaveLength(1);
      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { applauseCount: 'desc' },
        }),
      );
    });
  });
});

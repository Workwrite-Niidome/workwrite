import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/** User preference profile for recommendation scoring */
interface UserProfile {
  /** genre -> affinity score (0-1) */
  genreAffinities: Map<string, number>;
  /** Set of author IDs the user has interacted with (read/bookshelf) */
  familiarAuthorIds: Set<string>;
  /** Set of work IDs user has on bookshelf or read */
  interactedWorkIds: Set<string>;
}

/** Scoring weights — tunable constants */
const SCORE_WEIGHTS = {
  TIME_DECAY_HALF_LIFE_HOURS: 24,   // Score halves every 24h
  GENRE_AFFINITY: 0.25,              // Max boost from genre match
  ENGAGEMENT: 0.15,                  // Max boost from engagement
  WORK_ATTACHMENT: 0.10,             // Bonus for posts with work attached
  AUTHOR_FAMILIARITY: 0.12,          // Bonus if user has read this author's works
  QUALITY_SCORE: 0.08,               // Bonus for high-quality attached works
  AUTO_POST_PENALTY: 0.05,           // Slight penalty for auto-generated posts
  DIVERSITY_PENALTY: 0.30,           // Penalty for consecutive posts by same author
};

/** Candidate pool multiplier — fetch N * limit candidates for scoring */
const CANDIDATE_MULTIPLIER = 3;

const POST_INCLUDE = {
  author: {
    select: { id: true, name: true, displayName: true, avatarUrl: true, role: true },
  },
  work: {
    select: {
      id: true,
      title: true,
      genre: true,
      synopsis: true,
      authorId: true,
      author: { select: { id: true, name: true, displayName: true } },
      _count: { select: { episodes: { where: { publishedAt: { not: null } } } } },
    },
  },
  episode: {
    select: { id: true, title: true, orderIndex: true, workId: true },
  },
  repostOf: {
    include: {
      author: {
        select: { id: true, name: true, displayName: true, avatarUrl: true, role: true },
      },
      work: {
        select: { id: true, title: true, genre: true },
      },
    },
  },
  quoteOf: {
    include: {
      author: {
        select: { id: true, name: true, displayName: true, avatarUrl: true, role: true },
      },
    },
  },
};

@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);

  constructor(private prisma: PrismaService) {}

  async getFollowingTimeline(userId: string, cursor?: string, limit = 20) {
    // Get list of followed user IDs
    const follows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });

    const authorIds = [userId, ...follows.map((f) => f.followingId)];

    const posts = await this.prisma.post.findMany({
      where: {
        authorId: { in: authorIds },
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: POST_INCLUDE,
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;

    // Add viewer meta
    const postsWithMeta = await this.addMetaToPosts(items, userId);

    return {
      posts: postsWithMeta,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async getGlobalTimeline(cursor?: string, limit = 20, viewerId?: string) {
    // For anonymous users or if no recommendation data, fall back to chronological
    if (!viewerId) {
      return this.getChronologicalTimeline(cursor, limit);
    }

    // Fetch larger candidate pool for scoring
    const candidateCount = limit * CANDIDATE_MULTIPLIER;
    const candidates = await this.prisma.post.findMany({
      where: {
        isDeleted: false,
        postType: { not: 'REPLY' },
        ...(cursor ? { createdAt: { lt: (await this.prisma.post.findUnique({ where: { id: cursor }, select: { createdAt: true } }))?.createdAt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: candidateCount + 1,
      include: {
        ...POST_INCLUDE,
        work: {
          select: {
            ...POST_INCLUDE.work.select,
            qualityScore: { select: { overall: true } },
          },
        },
      },
    });

    if (candidates.length === 0) {
      return { posts: [], nextCursor: null };
    }

    // Build user profile (parallel queries)
    const profile = await this.buildUserProfile(viewerId);

    // Score and rank candidates
    const hasMore = candidates.length > candidateCount;
    const pool = hasMore ? candidates.slice(0, candidateCount) : candidates;
    const scored = this.scoreAndRank(pool, profile);

    // Take top `limit` results
    const items = scored.slice(0, limit);

    // Use the oldest candidate's ID as cursor for next page
    // (ensures we paginate through the time window, not the scored order)
    const lastCandidate = pool[pool.length - 1];
    const nextCursor = hasMore ? lastCandidate.id : null;

    const postsWithMeta = await this.addMetaToPosts(items, viewerId);

    return {
      posts: postsWithMeta,
      nextCursor,
    };
  }

  /** Chronological fallback for anonymous users */
  private async getChronologicalTimeline(cursor?: string, limit = 20) {
    const posts = await this.prisma.post.findMany({
      where: {
        isDeleted: false,
        postType: { not: 'REPLY' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: POST_INCLUDE,
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;

    return {
      posts: items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /**
   * Build a lightweight user preference profile from reading history.
   * This is computed per-request but only queries aggregated data.
   */
  private async buildUserProfile(userId: string): Promise<UserProfile> {
    const [bookshelfEntries, readingProgress, onboarding] = await Promise.all([
      // Works on bookshelf with their genres
      this.prisma.bookshelfEntry.findMany({
        where: { userId },
        select: {
          workId: true,
          status: true,
          work: { select: { genre: true, authorId: true } },
        },
      }),
      // Works with reading progress
      this.prisma.readingProgress.findMany({
        where: { userId, completed: true },
        select: {
          workId: true,
          work: { select: { genre: true, authorId: true } },
        },
        distinct: ['workId'],
      }),
      // Onboarding emotion profile
      this.prisma.onboardingResult.findUnique({
        where: { userId },
        select: { aiProfile: true },
      }),
    ]);

    // Count genre occurrences weighted by interaction depth
    const genreCounts = new Map<string, number>();
    const familiarAuthorIds = new Set<string>();
    const interactedWorkIds = new Set<string>();

    for (const entry of bookshelfEntries) {
      const genre = entry.work?.genre;
      if (genre) {
        // Weight: COMPLETED > READING > WANT_TO_READ
        const weight = entry.status === 'COMPLETED' ? 3 : entry.status === 'READING' ? 2 : 1;
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + weight);
      }
      if (entry.work?.authorId) familiarAuthorIds.add(entry.work.authorId);
      interactedWorkIds.add(entry.workId);
    }

    for (const rp of readingProgress) {
      const genre = rp.work?.genre;
      if (genre) {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 2);
      }
      if (rp.work?.authorId) familiarAuthorIds.add(rp.work.authorId);
      interactedWorkIds.add(rp.workId);
    }

    // Add recommended genres from onboarding AI profile
    if (onboarding?.aiProfile) {
      const profile = onboarding.aiProfile as any;
      const recommended = profile.recommendedGenres || [];
      for (const genre of recommended) {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      }
    }

    // Normalize to 0-1 affinities
    const maxCount = Math.max(1, ...genreCounts.values());
    const genreAffinities = new Map<string, number>();
    for (const [genre, count] of genreCounts) {
      genreAffinities.set(genre, count / maxCount);
    }

    return { genreAffinities, familiarAuthorIds, interactedWorkIds };
  }

  /**
   * Score candidate posts and return sorted by score descending.
   *
   * Score = timeDecay * (1 + genreBoost + engagementBoost + workBoost + authorBoost + qualityBoost - autoPenalty)
   *
   * Time decay is the dominant factor (recency-first), other signals provide reranking.
   */
  private scoreAndRank(posts: any[], profile: UserProfile): any[] {
    const now = Date.now();
    const halfLifeMs = SCORE_WEIGHTS.TIME_DECAY_HALF_LIFE_HOURS * 60 * 60 * 1000;

    const scored = posts.map((post) => {
      // 1. Time decay (exponential, 0-1)
      const ageMs = now - new Date(post.createdAt).getTime();
      const timeDecay = Math.pow(0.5, ageMs / halfLifeMs);

      // 2. Genre affinity (0 - GENRE_AFFINITY weight)
      let genreBoost = 0;
      const postGenre = post.work?.genre;
      if (postGenre && profile.genreAffinities.has(postGenre)) {
        genreBoost = SCORE_WEIGHTS.GENRE_AFFINITY * profile.genreAffinities.get(postGenre)!;
      }

      // 3. Engagement boost (logarithmic, 0 - ENGAGEMENT weight)
      const totalEngagement = (post.applauseCount || 0) + (post.repostCount || 0) * 2 + (post.bookmarkCount || 0) * 1.5;
      const engagementBoost = totalEngagement > 0
        ? SCORE_WEIGHTS.ENGAGEMENT * Math.min(1, Math.log10(totalEngagement + 1) / 2)
        : 0;

      // 4. Work attachment bonus
      const workBoost = post.workId ? SCORE_WEIGHTS.WORK_ATTACHMENT : 0;

      // 5. Author familiarity (user has read works by this author)
      let authorBoost = 0;
      const workAuthorId = post.work?.authorId;
      if (workAuthorId && profile.familiarAuthorIds.has(workAuthorId)) {
        authorBoost = SCORE_WEIGHTS.AUTHOR_FAMILIARITY;
      } else if (profile.familiarAuthorIds.has(post.authorId)) {
        authorBoost = SCORE_WEIGHTS.AUTHOR_FAMILIARITY * 0.5;
      }

      // 6. Quality score bonus (for attached works with high quality)
      let qualityBoost = 0;
      const overall = post.work?.qualityScore?.overall;
      if (overall && overall > 60) {
        qualityBoost = SCORE_WEIGHTS.QUALITY_SCORE * ((overall - 60) / 40); // Scale 60-100 to 0-1
      }

      // 7. Auto-post penalty (auto-generated are slightly less interesting)
      const isAutoPost = ['AUTO_WORK', 'AUTO_EPISODE', 'AUTO_REVIEW', 'AUTO_READING'].includes(post.postType);
      const autoPenalty = isAutoPost ? SCORE_WEIGHTS.AUTO_POST_PENALTY : 0;

      const score = timeDecay * (1 + genreBoost + engagementBoost + workBoost + authorBoost + qualityBoost - autoPenalty);

      return { ...post, _score: score };
    });

    // Sort by score descending
    scored.sort((a, b) => b._score - a._score);

    // Apply diversity: penalize consecutive posts by the same author
    return this.applyDiversity(scored);
  }

  /**
   * Spread posts by different authors to avoid clusters.
   * Uses a simple sliding window: if the same author appears within
   * the last 2 positions, push the post down slightly.
   */
  private applyDiversity(posts: any[]): any[] {
    if (posts.length <= 2) return posts;

    const result: any[] = [];
    const recentAuthors: string[] = [];

    // Two-pass: first collect "non-duplicate" posts, then interleave pushed-down ones
    const deferred: any[] = [];

    for (const post of posts) {
      if (recentAuthors.includes(post.authorId) && result.length < posts.length - 1) {
        // Push down — will be added later
        post._score *= (1 - SCORE_WEIGHTS.DIVERSITY_PENALTY);
        deferred.push(post);
      } else {
        result.push(post);
        recentAuthors.push(post.authorId);
        if (recentAuthors.length > 2) recentAuthors.shift();
      }
    }

    // Merge deferred posts back, maintaining rough score order
    for (const post of deferred) {
      // Find insertion point
      let inserted = false;
      for (let i = 0; i < result.length; i++) {
        if (post._score > result[i]._score) {
          result.splice(i, 0, post);
          inserted = true;
          break;
        }
      }
      if (!inserted) result.push(post);
    }

    // Strip internal score field
    return result.map(({ _score, ...post }) => post);
  }

  async getTrendingPosts(limit = 10) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return this.prisma.post.findMany({
      where: {
        isDeleted: false,
        createdAt: { gte: since },
        postType: { not: 'REPLY' },
      },
      orderBy: { applauseCount: 'desc' },
      take: limit,
      include: POST_INCLUDE,
    });
  }

  private async addMetaToPosts(posts: any[], viewerId: string) {
    if (posts.length === 0) return posts;

    const postIds = posts.map((p) => p.id);

    const [applauseList, bookmarkList, repostList] = await Promise.all([
      this.prisma.applause.findMany({
        where: { userId: viewerId, postId: { in: postIds } },
        select: { postId: true },
      }),
      this.prisma.postBookmark.findMany({
        where: { userId: viewerId, postId: { in: postIds } },
        select: { postId: true },
      }),
      this.prisma.post.findMany({
        where: { authorId: viewerId, repostOfId: { in: postIds }, isDeleted: false },
        select: { repostOfId: true },
      }),
    ]);

    const applaudedSet = new Set(applauseList.map((a) => a.postId));
    const bookmarkedSet = new Set(bookmarkList.map((b) => b.postId));
    const repostedSet = new Set(repostList.map((r) => r.repostOfId));

    return posts.map((post) => ({
      ...post,
      hasApplauded: applaudedSet.has(post.id),
      hasBookmarked: bookmarkedSet.has(post.id),
      hasReposted: repostedSet.has(post.id),
    }));
  }
}

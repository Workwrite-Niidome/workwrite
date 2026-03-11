import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

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

    const postsWithMeta = viewerId
      ? await this.addMetaToPosts(items, viewerId)
      : items;

    return {
      posts: postsWithMeta,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
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

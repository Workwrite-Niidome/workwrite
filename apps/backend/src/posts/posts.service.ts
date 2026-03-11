import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PostType } from '@prisma/client';

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
      episodes: { select: { id: true }, where: { publishedAt: { not: null } } },
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

// Rate limiter for post creation
const postRateLimitMap = new Map<string, number[]>();
const POST_RATE_WINDOW_MS = 60 * 1000; // 1 minute
const POST_RATE_MAX = 5;

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private checkPostRateLimit(userId: string): boolean {
    const now = Date.now();
    const timestamps = postRateLimitMap.get(userId) || [];
    const recent = timestamps.filter((t) => now - t < POST_RATE_WINDOW_MS);
    if (recent.length >= POST_RATE_MAX) return false;
    recent.push(now);
    postRateLimitMap.set(userId, recent);
    return true;
  }

  async create(
    userId: string,
    dto: {
      content: string;
      workId?: string;
      episodeId?: string;
      highlightId?: string;
      replyToId?: string;
      quoteOfId?: string;
    },
  ) {
    if (!this.checkPostRateLimit(userId)) {
      throw new BadRequestException('投稿の頻度が多すぎます。しばらく待ってから再度お試しください。');
    }

    let postType: PostType = PostType.ORIGINAL;
    let threadRootId: string | undefined;

    if (dto.replyToId) {
      postType = PostType.REPLY;
      const parent = await this.prisma.post.findUnique({
        where: { id: dto.replyToId },
        select: { id: true, threadRootId: true, isDeleted: true },
      });
      if (!parent || parent.isDeleted) {
        throw new NotFoundException('返信先の投稿が見つかりません');
      }
      threadRootId = parent.threadRootId || parent.id;
    }

    if (dto.quoteOfId) {
      postType = PostType.QUOTE;
      const original = await this.prisma.post.findUnique({
        where: { id: dto.quoteOfId },
        select: { id: true, isDeleted: true },
      });
      if (!original || original.isDeleted) {
        throw new NotFoundException('引用元の投稿が見つかりません');
      }
    }

    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          authorId: userId,
          content: dto.content,
          postType,
          workId: dto.workId || null,
          episodeId: dto.episodeId || null,
          highlightId: dto.highlightId || null,
          replyToId: dto.replyToId || null,
          quoteOfId: dto.quoteOfId || null,
          threadRootId: threadRootId || null,
        },
        include: POST_INCLUDE,
      });

      // Increment parent reply count
      if (dto.replyToId) {
        await tx.post.update({
          where: { id: dto.replyToId },
          data: { replyCount: { increment: 1 } },
        });
      }

      return created;
    });

    // Notify on reply
    if (dto.replyToId) {
      const parent = await this.prisma.post.findUnique({
        where: { id: dto.replyToId },
        select: { authorId: true },
      });
      if (parent && parent.authorId !== userId) {
        const userName = post.author?.displayName || post.author?.name || '';
        this.notifications.createNotification(parent.authorId, {
          type: 'post_reply',
          title: `${userName}さんが返信しました`,
          body: dto.content.slice(0, 50),
          data: { postId: post.id },
        }).catch((e) => this.logger.warn(`Notification failed: ${e}`));
      }
    }

    return post;
  }

  async findById(id: string, viewerId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: POST_INCLUDE,
    });
    if (!post || post.isDeleted) {
      throw new NotFoundException('投稿が見つかりません');
    }

    const meta = viewerId ? await this.getPostMeta(id, viewerId) : null;
    return { ...post, ...meta };
  }

  async delete(id: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { authorId: true, isDeleted: true, replyToId: true, postType: true, repostOfId: true },
    });
    if (!post || post.isDeleted) {
      throw new NotFoundException('投稿が見つかりません');
    }
    if (post.authorId !== userId) {
      throw new ForbiddenException('この投稿を削除する権限がありません');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id },
        data: { isDeleted: true },
      });

      if (post.replyToId) {
        await tx.post.update({
          where: { id: post.replyToId },
          data: { replyCount: { decrement: 1 } },
        });
      }

      if (post.postType === PostType.REPOST && post.repostOfId) {
        await tx.post.update({
          where: { id: post.repostOfId },
          data: { repostCount: { decrement: 1 } },
        });
      }
    });
  }

  // === Applause ===

  async applaud(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, isDeleted: true, authorId: true },
    });
    if (!post || post.isDeleted) {
      throw new NotFoundException('投稿が見つかりません');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.applause.upsert({
        where: { userId_postId: { userId, postId } },
        create: { userId, postId },
        update: {},
      });
      await tx.post.update({
        where: { id: postId },
        data: { applauseCount: { increment: 1 } },
      });
    });

    // Notify post author
    if (post.authorId !== userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, displayName: true },
      });
      const userName = user?.displayName || user?.name || '';
      this.notifications.createNotification(post.authorId, {
        type: 'post_applause',
        title: `${userName}さんがあなたのひとことに拍手しました`,
        data: { postId },
      }).catch((e) => this.logger.warn(`Notification failed: ${e}`));
    }
  }

  async removeApplause(postId: string, userId: string) {
    const existing = await this.prisma.applause.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (!existing) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.applause.delete({
        where: { userId_postId: { userId, postId } },
      });
      await tx.post.update({
        where: { id: postId },
        data: { applauseCount: { decrement: 1 } },
      });
    });
  }

  // === Repost ===

  async repost(postId: string, userId: string) {
    const original = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, isDeleted: true },
    });
    if (!original || original.isDeleted) {
      throw new NotFoundException('投稿が見つかりません');
    }
    if (original.authorId === userId) {
      throw new BadRequestException('自分の投稿をおすすめすることはできません');
    }

    // Check if already reposted
    const existing = await this.prisma.post.findFirst({
      where: { authorId: userId, repostOfId: postId, isDeleted: false },
    });
    if (existing) {
      throw new BadRequestException('すでにおすすめしています');
    }

    const [repostPost] = await this.prisma.$transaction([
      this.prisma.post.create({
        data: {
          authorId: userId,
          content: '',
          postType: PostType.REPOST,
          repostOfId: postId,
        },
        include: POST_INCLUDE,
      }),
      this.prisma.post.update({
        where: { id: postId },
        data: { repostCount: { increment: 1 } },
      }),
    ]);

    // Notify
    if (original.authorId !== userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, displayName: true },
      });
      const userName = user?.displayName || user?.name || '';
      this.notifications.createNotification(original.authorId, {
        type: 'post_repost',
        title: `${userName}さんがあなたのひとことをおすすめしました`,
        data: { postId },
      }).catch((e) => this.logger.warn(`Notification failed: ${e}`));
    }

    return repostPost;
  }

  async removeRepost(postId: string, userId: string) {
    const repost = await this.prisma.post.findFirst({
      where: { authorId: userId, repostOfId: postId, isDeleted: false },
    });
    if (!repost) return;

    await this.prisma.$transaction([
      this.prisma.post.update({
        where: { id: repost.id },
        data: { isDeleted: true },
      }),
      this.prisma.post.update({
        where: { id: postId },
        data: { repostCount: { decrement: 1 } },
      }),
    ]);
  }

  // === Bookmark ===

  async bookmark(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, isDeleted: true },
    });
    if (!post || post.isDeleted) {
      throw new NotFoundException('投稿が見つかりません');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.postBookmark.upsert({
        where: { userId_postId: { userId, postId } },
        create: { userId, postId },
        update: {},
      });
      await tx.post.update({
        where: { id: postId },
        data: { bookmarkCount: { increment: 1 } },
      });
    });
  }

  async removeBookmark(postId: string, userId: string) {
    const existing = await this.prisma.postBookmark.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (!existing) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.postBookmark.delete({
        where: { userId_postId: { userId, postId } },
      });
      await tx.post.update({
        where: { id: postId },
        data: { bookmarkCount: { decrement: 1 } },
      });
    });
  }

  async getBookmarks(userId: string, cursor?: string, limit = 20) {
    const bookmarks = await this.prisma.postBookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        post: { include: POST_INCLUDE },
      },
    });

    const hasMore = bookmarks.length > limit;
    const items = hasMore ? bookmarks.slice(0, limit) : bookmarks;
    const posts = items.map((b) => b.post);

    // Add meta for viewer
    const postsWithMeta = await this.addMetaToPosts(posts, userId);

    return {
      posts: postsWithMeta,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  // === Replies ===

  async getReplies(postId: string, cursor?: string, limit = 20, viewerId?: string) {
    const replies = await this.prisma.post.findMany({
      where: { replyToId: postId, isDeleted: false },
      orderBy: { createdAt: 'asc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: POST_INCLUDE,
    });

    const hasMore = replies.length > limit;
    const items = hasMore ? replies.slice(0, limit) : replies;

    const postsWithMeta = viewerId
      ? await this.addMetaToPosts(items, viewerId)
      : items;

    return {
      posts: postsWithMeta,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  // === User posts ===

  async getUserPosts(userId: string, cursor?: string, limit = 20, viewerId?: string) {
    const posts = await this.prisma.post.findMany({
      where: {
        authorId: userId,
        isDeleted: false,
        postType: { not: PostType.REPLY },
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

  async getUserApplaudedPosts(userId: string, cursor?: string, limit = 20, viewerId?: string) {
    const applauseRecords = await this.prisma.applause.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        post: { include: POST_INCLUDE },
      },
    });

    const hasMore = applauseRecords.length > limit;
    const items = hasMore ? applauseRecords.slice(0, limit) : applauseRecords;
    const posts = items.map((a) => a.post).filter((p) => !p.isDeleted);

    const postsWithMeta = viewerId
      ? await this.addMetaToPosts(posts, viewerId)
      : posts;

    return {
      posts: postsWithMeta,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  // === Auto post ===

  async createAutoPost(
    userId: string,
    postType: PostType,
    data: { content: string; workId?: string; episodeId?: string },
  ) {
    return this.prisma.post.create({
      data: {
        authorId: userId,
        content: data.content,
        postType,
        workId: data.workId || null,
        episodeId: data.episodeId || null,
      },
    });
  }

  // === Helpers ===

  private async getPostMeta(postId: string, userId: string) {
    const [applause, bookmark, repost] = await Promise.all([
      this.prisma.applause.findUnique({
        where: { userId_postId: { userId, postId } },
      }),
      this.prisma.postBookmark.findUnique({
        where: { userId_postId: { userId, postId } },
      }),
      this.prisma.post.findFirst({
        where: { authorId: userId, repostOfId: postId, isDeleted: false },
        select: { id: true },
      }),
    ]);

    return {
      hasApplauded: !!applause,
      hasBookmarked: !!bookmark,
      hasReposted: !!repost,
    };
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

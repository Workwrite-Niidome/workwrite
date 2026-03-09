import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class FollowsService {
  constructor(private prisma: PrismaService) {}

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) throw new BadRequestException('Cannot follow yourself');
    const user = await this.prisma.user.findUnique({ where: { id: followingId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      update: {},
      create: { followerId, followingId },
    });
  }

  async unfollow(followerId: string, followingId: string) {
    await this.prisma.follow.deleteMany({
      where: { followerId, followingId },
    });
    return { deleted: true };
  }

  async isFollowing(followerId: string, followingId: string) {
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    return { following: !!follow };
  }

  async getFollowers(userId: string) {
    return this.prisma.follow.findMany({
      where: { followingId: userId },
      include: { follower: { select: { id: true, name: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFollowing(userId: string) {
    return this.prisma.follow.findMany({
      where: { followerId: userId },
      include: { following: { select: { id: true, name: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFollowingFeed(userId: string) {
    const following = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map(f => f.followingId);
    if (followingIds.length === 0) return [];

    return this.prisma.work.findMany({
      where: {
        authorId: { in: followingIds },
        status: 'PUBLISHED',
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        tags: true,
        qualityScore: { select: { overall: true } },
        _count: { select: { reviews: true, episodes: true } },
      },
    });
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { FollowsService } from './follows.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrismaService = () => ({
  user: {
    findUnique: jest.fn(),
  },
  follow: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  work: {
    findMany: jest.fn(),
  },
});

describe('FollowsService', () => {
  let service: FollowsService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FollowsService>(FollowsService);
  });

  describe('follow', () => {
    it('should follow a user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      prisma.follow.upsert.mockResolvedValue({ followerId: 'user-1', followingId: 'user-2' });

      const result = await service.follow('user-1', 'user-2');

      expect(result).toEqual({ followerId: 'user-1', followingId: 'user-2' });
      expect(prisma.follow.upsert).toHaveBeenCalledWith({
        where: { followerId_followingId: { followerId: 'user-1', followingId: 'user-2' } },
        update: {},
        create: { followerId: 'user-1', followingId: 'user-2' },
      });
    });

    it('should throw BadRequestException when following self', async () => {
      await expect(service.follow('user-1', 'user-1'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.follow('user-1', 'nonexistent'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('unfollow', () => {
    it('should unfollow a user', async () => {
      prisma.follow.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.unfollow('user-1', 'user-2');

      expect(result).toEqual({ deleted: true });
      expect(prisma.follow.deleteMany).toHaveBeenCalledWith({
        where: { followerId: 'user-1', followingId: 'user-2' },
      });
    });
  });

  describe('isFollowing', () => {
    it('should return true when following', async () => {
      prisma.follow.findUnique.mockResolvedValue({ followerId: 'user-1', followingId: 'user-2' });

      const result = await service.isFollowing('user-1', 'user-2');

      expect(result).toEqual({ following: true });
    });

    it('should return false when not following', async () => {
      prisma.follow.findUnique.mockResolvedValue(null);

      const result = await service.isFollowing('user-1', 'user-2');

      expect(result).toEqual({ following: false });
    });
  });

  describe('getFollowers', () => {
    it('should return followers list', async () => {
      const mockFollowers = [
        { followerId: 'user-1', follower: { id: 'user-1', name: 'Alice', displayName: null, avatarUrl: null } },
      ];
      prisma.follow.findMany.mockResolvedValue(mockFollowers);

      const result = await service.getFollowers('user-2');

      expect(result).toEqual(mockFollowers);
      expect(prisma.follow.findMany).toHaveBeenCalledWith({
        where: { followingId: 'user-2' },
        include: { follower: { select: { id: true, name: true, displayName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getFollowing', () => {
    it('should return following list', async () => {
      const mockFollowing = [
        { followingId: 'user-2', following: { id: 'user-2', name: 'Bob', displayName: null, avatarUrl: null } },
      ];
      prisma.follow.findMany.mockResolvedValue(mockFollowing);

      const result = await service.getFollowing('user-1');

      expect(result).toEqual(mockFollowing);
      expect(prisma.follow.findMany).toHaveBeenCalledWith({
        where: { followerId: 'user-1' },
        include: { following: { select: { id: true, name: true, displayName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getFollowingFeed', () => {
    it('should return works from followed authors', async () => {
      prisma.follow.findMany.mockResolvedValue([
        { followingId: 'author-1' },
        { followingId: 'author-2' },
      ]);
      const mockWorks = [
        { id: 'work-1', title: 'Story 1', authorId: 'author-1' },
      ];
      prisma.work.findMany.mockResolvedValue(mockWorks);

      const result = await service.getFollowingFeed('user-1');

      expect(result).toEqual(mockWorks);
      expect(prisma.work.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            authorId: { in: ['author-1', 'author-2'] },
            status: 'PUBLISHED',
          },
          orderBy: { publishedAt: 'desc' },
          take: 20,
        }),
      );
    });

    it('should return empty array when not following anyone', async () => {
      prisma.follow.findMany.mockResolvedValue([]);

      const result = await service.getFollowingFeed('user-1');

      expect(result).toEqual([]);
      expect(prisma.work.findMany).not.toHaveBeenCalled();
    });
  });
});

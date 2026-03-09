import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrismaService = () => ({
  comment: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
});

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  describe('create', () => {
    it('should create a top-level comment', async () => {
      const mockComment = {
        id: 'c-1',
        userId: 'user-1',
        episodeId: 'ep-1',
        content: 'Great chapter!',
        parentId: null,
        user: { id: 'user-1', name: 'Alice', displayName: null, avatarUrl: null },
        replies: [],
      };
      prisma.comment.create.mockResolvedValue(mockComment);

      const result = await service.create('user-1', { episodeId: 'ep-1', content: 'Great chapter!' });

      expect(result).toEqual(mockComment);
      expect(prisma.comment.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', episodeId: 'ep-1', content: 'Great chapter!' },
        include: expect.objectContaining({
          user: expect.anything(),
          replies: expect.anything(),
        }),
      });
    });

    it('should create a reply comment with parentId', async () => {
      const mockReply = {
        id: 'c-2',
        userId: 'user-2',
        episodeId: 'ep-1',
        content: 'Thanks!',
        parentId: 'c-1',
        user: { id: 'user-2', name: 'Bob', displayName: null, avatarUrl: null },
        replies: [],
      };
      prisma.comment.create.mockResolvedValue(mockReply);

      const result = await service.create('user-2', {
        episodeId: 'ep-1',
        content: 'Thanks!',
        parentId: 'c-1',
      });

      expect(result.parentId).toBe('c-1');
    });

    it('should create a comment with paragraphId', async () => {
      prisma.comment.create.mockResolvedValue({ id: 'c-3', paragraphId: 'p-5' });

      await service.create('user-1', {
        episodeId: 'ep-1',
        content: 'Inline note',
        paragraphId: 'p-5',
      });

      expect(prisma.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ paragraphId: 'p-5' }),
        }),
      );
    });
  });

  describe('findByEpisode', () => {
    it('should return top-level comments with nested replies', async () => {
      const mockComments = [
        {
          id: 'c-1',
          parentId: null,
          content: 'Top comment',
          user: { id: 'user-1', name: 'Alice', displayName: null, avatarUrl: null },
          replies: [
            {
              id: 'c-2',
              content: 'Reply',
              user: { id: 'user-2', name: 'Bob', displayName: null, avatarUrl: null },
              replies: [],
            },
          ],
        },
      ];
      prisma.comment.findMany.mockResolvedValue(mockComments);

      const result = await service.findByEpisode('ep-1');

      expect(result).toEqual(mockComments);
      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { episodeId: 'ep-1', parentId: null },
          orderBy: { createdAt: 'asc' },
        }),
      );
    });
  });

  describe('delete', () => {
    it('should delete own comment', async () => {
      prisma.comment.findUnique.mockResolvedValue({ id: 'c-1', userId: 'user-1' });
      prisma.comment.delete.mockResolvedValue({ id: 'c-1' });

      const result = await service.delete('c-1', 'user-1');

      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException when comment not found', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'user-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when deleting another user\'s comment', async () => {
      prisma.comment.findUnique.mockResolvedValue({ id: 'c-1', userId: 'other-user' });

      await expect(service.delete('c-1', 'user-1'))
        .rejects.toThrow(ForbiddenException);
    });
  });
});

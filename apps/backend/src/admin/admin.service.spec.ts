import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreditService } from '../billing/credit.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const mockPrismaService = () => ({
  user: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  work: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  review: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  comment: {
    count: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  subscription: {
    count: jest.fn(),
  },
});

describe('AdminService', () => {
  let service: AdminService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: CreditService, useValue: {
          getBalance: jest.fn().mockResolvedValue({ total: 0, monthly: 0, purchased: 0 }),
          grantCredits: jest.fn().mockResolvedValue(undefined),
          consumeCredits: jest.fn(),
          confirmTransaction: jest.fn(),
          refundTransaction: jest.fn(),
        } },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('getStats', () => {
    it('should return aggregated statistics', async () => {
      prisma.user.count
        .mockResolvedValueOnce(100) // total users
        .mockResolvedValueOnce(5); // today's new users
      prisma.work.count
        .mockResolvedValueOnce(50) // total works
        .mockResolvedValueOnce(3); // today's new works
      prisma.review.count.mockResolvedValue(200);
      prisma.comment.count.mockResolvedValue(300);
      prisma.subscription.count
        .mockResolvedValueOnce(10) // standard
        .mockResolvedValueOnce(3); // pro

      const result = await service.getStats();

      expect(result).toEqual({
        totalUsers: 100,
        totalWorks: 50,
        totalReviews: 200,
        totalComments: 300,
        todayNewUsers: 5,
        todayNewWorks: 3,
        planCounts: { free: 87, standard: 10, pro: 3 },
      });
    });
  });

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      const mockUsers = [
        { id: '1', name: 'User1', email: 'u1@test.com', role: 'READER', isBanned: false, createdAt: new Date() },
      ];
      prisma.user.findMany.mockResolvedValue(mockUsers);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.getUsers({ page: 1, limit: 20 });

      expect(result.data).toEqual(mockUsers);
      expect(result.total).toBe(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('should filter by role', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.getUsers({ page: 1, limit: 20, role: 'ADMIN' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'ADMIN' }),
        }),
      );
    });

    it('should search by name or email', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.getUsers({ page: 1, limit: 20, search: 'test' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.anything() }),
              expect.objectContaining({ email: expect.anything() }),
            ]),
          }),
        }),
      );
    });
  });

  describe('updateUserRole', () => {
    it('should update user role', async () => {
      const mockUser = { id: '1', name: 'User1', role: 'READER' };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, role: 'AUTHOR' });

      const result = await service.updateUserRole('admin-id', '1', 'AUTHOR');

      expect(result.role).toBe('AUTHOR');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: { role: 'AUTHOR' },
        }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateUserRole('admin-id', 'nonexistent', 'AUTHOR'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when modifying own role', async () => {
      const mockUser = { id: 'admin-id', name: 'Admin', role: 'ADMIN' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.updateUserRole('admin-id', 'admin-id', 'READER'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('banUser', () => {
    it('should ban a user', async () => {
      const mockUser = { id: '1', name: 'User1', isBanned: false };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, isBanned: true });

      const result = await service.banUser('admin-id', '1', true);

      expect(result.isBanned).toBe(true);
    });

    it('should throw ForbiddenException when banning self', async () => {
      const mockUser = { id: 'admin-id', name: 'Admin' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.banUser('admin-id', 'admin-id', true))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.banUser('admin-id', 'nonexistent', true))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('getWorks', () => {
    it('should return paginated works', async () => {
      const mockWorks = [{ id: '1', title: 'Work1', status: 'PUBLISHED' }];
      prisma.work.findMany.mockResolvedValue(mockWorks);
      prisma.work.count.mockResolvedValue(1);

      const result = await service.getWorks({ page: 1, limit: 20 });

      expect(result.data).toEqual(mockWorks);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.work.findMany.mockResolvedValue([]);
      prisma.work.count.mockResolvedValue(0);

      await service.getWorks({ page: 1, limit: 20, status: 'DRAFT' });

      expect(prisma.work.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DRAFT' }),
        }),
      );
    });
  });

  describe('updateWorkStatus', () => {
    it('should update work status', async () => {
      const mockWork = { id: '1', title: 'Work1', status: 'DRAFT' };
      prisma.work.findUnique.mockResolvedValue(mockWork);
      prisma.work.update.mockResolvedValue({ ...mockWork, status: 'PUBLISHED' });

      const result = await service.updateWorkStatus('1', 'PUBLISHED');

      expect(result.status).toBe('PUBLISHED');
    });

    it('should throw NotFoundException if work not found', async () => {
      prisma.work.findUnique.mockResolvedValue(null);

      await expect(service.updateWorkStatus('nonexistent', 'PUBLISHED'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('getReviews', () => {
    it('should return paginated reviews', async () => {
      const mockReviews = [{ id: '1', content: 'Great!' }];
      prisma.review.findMany.mockResolvedValue(mockReviews);
      prisma.review.count.mockResolvedValue(1);

      const result = await service.getReviews({ page: 1, limit: 20 });

      expect(result.data).toEqual(mockReviews);
      expect(result.total).toBe(1);
    });
  });

  describe('deleteReview', () => {
    it('should delete a review', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: '1' });
      prisma.review.delete.mockResolvedValue({ id: '1' });

      await service.deleteReview('1');

      expect(prisma.review.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('should throw NotFoundException if review not found', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.deleteReview('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });
  });
});

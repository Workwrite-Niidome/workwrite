import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreditService } from '../billing/credit.service';

interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  status?: string;
}

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private creditService: CreditService,
  ) {}

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalUsers, todayNewUsers, totalWorks, todayNewWorks, totalReviews, totalComments] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { createdAt: { gte: today } } }),
        this.prisma.work.count(),
        this.prisma.work.count({ where: { createdAt: { gte: today } } }),
        this.prisma.review.count(),
        this.prisma.comment.count(),
      ]);

    return { totalUsers, totalWorks, totalReviews, totalComments, todayNewUsers, todayNewWorks };
  }

  async getUsers(params: PaginationParams) {
    const { page, limit, search, role } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          role: true,
          isBanned: true,
          createdAt: true,
          _count: { select: { works: true, reviews: true } },
          subscription: { select: { plan: true, status: true, grantedBy: true } },
          creditBalance: { select: { balance: true, monthlyBalance: true, rewardBalance: true, purchasedBalance: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async updateUserRole(adminId: string, userId: string, role: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    if (adminId === userId) throw new ForbiddenException('Cannot modify your own role');

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
      select: { id: true, name: true, role: true },
    });
  }

  async banUser(adminId: string, userId: string, isBanned: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    if (adminId === userId) throw new ForbiddenException('Cannot ban yourself');

    return this.prisma.user.update({
      where: { id: userId },
      data: { isBanned },
      select: { id: true, name: true, isBanned: true },
    });
  }

  async getWorks(params: PaginationParams) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.work.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true, displayName: true } },
          qualityScore: { select: { overall: true } },
          _count: { select: { episodes: true, reviews: true } },
        },
      }),
      this.prisma.work.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async updateWorkStatus(workId: string, status: string) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('Work not found');

    return this.prisma.work.update({
      where: { id: workId },
      data: {
        status: status as any,
        ...(status === 'PUBLISHED' && !work.publishedAt ? { publishedAt: new Date() } : {}),
      },
      select: { id: true, title: true, status: true },
    });
  }

  async getReviews(params: PaginationParams) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, displayName: true } },
          work: { select: { id: true, title: true } },
          _count: { select: { helpfuls: true } },
        },
      }),
      this.prisma.review.count(),
    ]);

    return { data, total, page, limit };
  }

  async deleteReview(reviewId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.review.delete({ where: { id: reviewId } });
  }

  // ─── Credit Grant ────────────────────────────────────────

  /** Grant free credits to a user (ADMIN_GRANT type) */
  async grantCreditsToUser(
    adminId: string,
    userId: string,
    amount: number,
    description?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (amount < 1 || amount > 10000) throw new BadRequestException('amount must be 1-10000');

    // Ensure CreditBalance exists
    await this.creditService.ensureCreditBalance(userId);

    const bal = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT * FROM "CreditBalance" WHERE "userId" = $1 FOR UPDATE',
        userId,
      );

      const current = await tx.creditBalance.findUnique({ where: { userId } });
      if (!current) throw new NotFoundException('CreditBalance not found');

      const newBalance = current.balance + amount;
      await tx.creditBalance.update({
        where: { userId },
        data: {
          balance: { increment: amount },
          purchasedBalance: { increment: amount }, // 管理者付与は購入分扱い（無期限）
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          type: 'ADMIN_GRANT',
          status: 'confirmed',
          balance: newBalance,
          description: description || `管理者付与 (by ${adminId}): ${amount}cr`,
        },
      });

      return { balance: newBalance, purchasedBalance: current.purchasedBalance + amount };
    });

    return {
      granted: amount,
      userId,
      userName: user.name,
      newBalance: bal.balance,
      newPurchasedBalance: bal.purchasedBalance,
    };
  }
}

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';

interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  status?: string;
}

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

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
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async updateUserRole(adminId: string, userId: string, role: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (adminId === userId) throw new ForbiddenException('Cannot modify your own role');

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
      select: { id: true, name: true, role: true },
    });
  }

  async banUser(adminId: string, userId: string, isBanned: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
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

  // ─── Invite Codes ────────────────────────────────────────

  private generateCode(): string {
    return 'WW-' + randomBytes(4).toString('hex').toUpperCase();
  }

  async getInviteCodes() {
    return this.prisma.inviteCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        usages: {
          include: { inviteCode: false },
          orderBy: { usedAt: 'desc' },
          take: 10,
        },
        _count: { select: { usages: true } },
      },
    });
  }

  async createInviteCode(
    adminId: string,
    opts: { label?: string; maxUses?: number; expiresAt?: string },
  ) {
    return this.prisma.inviteCode.create({
      data: {
        code: this.generateCode(),
        label: opts.label || null,
        maxUses: opts.maxUses || 1,
        createdBy: adminId,
        expiresAt: opts.expiresAt ? new Date(opts.expiresAt) : null,
      },
    });
  }

  async toggleInviteCode(id: string) {
    const code = await this.prisma.inviteCode.findUnique({ where: { id } });
    if (!code) throw new NotFoundException('Invite code not found');
    return this.prisma.inviteCode.update({
      where: { id },
      data: { isActive: !code.isActive },
    });
  }

  async deleteInviteCode(id: string) {
    return this.prisma.inviteCode.delete({ where: { id } });
  }
}

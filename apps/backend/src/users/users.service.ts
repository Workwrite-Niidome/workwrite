import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            readingProgress: { where: { completed: true } },
            reviews: true,
            emotionTags: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            readingProgress: { where: { completed: true } },
            reviews: true,
            followers: true,
            following: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateAvatar(userId: string, avatarUrl: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        role: true,
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Exclude avatarUrl from profile update to prevent accidental clearance
    // Avatar updates should go through the dedicated uploadAvatar endpoint
    const { avatarUrl, ...profileData } = dto;
    return this.prisma.user.update({
      where: { id: userId },
      data: profileData,
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        role: true,
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user || !user.passwordHash) {
      throw new NotFoundException('User not found');
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { success: true };
  }

  async deleteAccount(userId: string) {
    this.logger.log(`Account deletion requested: ${userId}`);

    // 1. Cancel active Stripe subscription if exists
    try {
      const sub = await this.prisma.subscription.findUnique({
        where: { userId },
      });
      if (sub?.stripeSubId && sub.status !== 'canceled') {
        // Dynamic import to avoid circular dependency
        const Stripe = (await import('stripe')).default;
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (stripeKey) {
          const stripe = new Stripe(stripeKey);
          await stripe.subscriptions.cancel(sub.stripeSubId).catch((e) =>
            this.logger.warn(`Stripe subscription cancel failed: ${e.message}`),
          );
          this.logger.log(`Stripe subscription ${sub.stripeSubId} cancelled`);
        }
      }
    } catch (e) {
      this.logger.warn(`Subscription cleanup failed: ${e}`);
      // Continue with deletion even if Stripe fails
    }

    // 2. Delete user (cascades to all related data via onDelete: Cascade)
    await this.prisma.user.delete({ where: { id: userId } });

    this.logger.log(`Account deleted: ${userId}`);
    return { deleted: true };
  }
}

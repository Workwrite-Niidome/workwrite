import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateAnnouncementDto) {
    const announcement = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        category: dto.category || 'update',
        notifyAll: dto.notifyAll || false,
        isPinned: dto.isPinned || false,
        createdBy: userId,
      },
      include: { creator: { select: { id: true, name: true, displayName: true } } },
    });

    return announcement;
  }

  async update(id: string, dto: UpdateAnnouncementDto) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');

    return this.prisma.announcement.update({
      where: { id },
      data: dto,
      include: { creator: { select: { id: true, name: true, displayName: true } } },
    });
  }

  async delete(id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');

    await this.prisma.announcement.delete({ where: { id } });
    return { id };
  }

  async findAll(options?: { isPublished?: boolean; category?: string }) {
    const where: Record<string, unknown> = {};
    if (options?.isPublished !== undefined) where.isPublished = options.isPublished;
    if (options?.category) where.category = options.category;

    return this.prisma.announcement.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: { creator: { select: { id: true, name: true, displayName: true } } },
    });
  }

  async findPublished(limit = 20, cursor?: string) {
    const where: Record<string, unknown> = { isPublished: true };
    const take = limit + 1;

    const items = await this.prisma.announcement.findMany({
      where: cursor ? { ...where, createdAt: { lt: (await this.prisma.announcement.findUnique({ where: { id: cursor } }))?.createdAt } } : where,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take,
      include: { creator: { select: { id: true, name: true, displayName: true } } },
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, nextCursor };
  }

  async findOne(id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
      include: { creator: { select: { id: true, name: true, displayName: true } } },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');
    return announcement;
  }

  async publish(id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');

    const announcement = await this.prisma.announcement.update({
      where: { id },
      data: { isPublished: true },
      include: { creator: { select: { id: true, name: true, displayName: true } } },
    });

    // Send notifications if notifyAll is true and not yet notified
    if (announcement.notifyAll && !announcement.notifiedAt) {
      await this.sendNotificationsToAllUsers(announcement.id, announcement.title);
      await this.prisma.announcement.update({
        where: { id },
        data: { notifiedAt: new Date() },
      });
    }

    return announcement;
  }

  async unpublish(id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');

    return this.prisma.announcement.update({
      where: { id },
      data: { isPublished: false },
      include: { creator: { select: { id: true, name: true, displayName: true } } },
    });
  }

  private async sendNotificationsToAllUsers(announcementId: string, title: string) {
    const users = await this.prisma.user.findMany({
      where: { isBanned: false },
      select: { id: true },
    });

    // Create notifications in batches
    const batchSize = 100;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      await Promise.all(
        batch.map((user) =>
          this.notificationsService.createNotification(user.id, {
            type: 'announcement',
            title: `お知らせ: ${title}`,
            body: title,
            data: { announcementId },
          }),
        ),
      );
    }
  }
}

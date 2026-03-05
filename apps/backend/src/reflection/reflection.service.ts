import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ReflectionService {
  constructor(private prisma: PrismaService) {}

  // State Change
  async saveStateChange(userId: string, data: { workId: string; axis: string; before: number; after: number }) {
    return this.prisma.stateChange.upsert({
      where: { userId_workId_axis: { userId, workId: data.workId, axis: data.axis } },
      update: { before: data.before, after: data.after },
      create: { userId, workId: data.workId, axis: data.axis, before: data.before, after: data.after },
    });
  }

  async saveMultipleStateChanges(userId: string, workId: string, changes: { axis: string; before: number; after: number }[]) {
    return Promise.all(
      changes.map((c) => this.saveStateChange(userId, { workId, ...c })),
    );
  }

  async getStateChangesForWork(userId: string, workId: string) {
    return this.prisma.stateChange.findMany({
      where: { userId, workId },
    });
  }

  // Self-transformation Timeline
  async getTimeline(userId: string) {
    const [stateChanges, emotionTags, reviews] = await Promise.all([
      this.prisma.stateChange.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { work: { select: { id: true, title: true, coverUrl: true } } },
      }),
      this.prisma.userEmotionTag.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          tag: true,
          work: { select: { id: true, title: true, coverUrl: true } },
        },
      }),
      this.prisma.review.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { work: { select: { id: true, title: true, coverUrl: true } } },
      }),
    ]);

    // Merge into unified timeline
    type TimelineEntry = {
      type: 'state_change' | 'emotion_tag' | 'review';
      date: Date;
      data: unknown;
    };

    const timeline: TimelineEntry[] = [
      ...stateChanges.map((sc) => ({
        type: 'state_change' as const,
        date: sc.createdAt,
        data: sc,
      })),
      ...emotionTags.map((et) => ({
        type: 'emotion_tag' as const,
        date: et.createdAt,
        data: et,
      })),
      ...reviews.map((r) => ({
        type: 'review' as const,
        date: r.createdAt,
        data: r,
      })),
    ];

    timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Compute growth summary
    const axisChanges = new Map<string, { total: number; count: number }>();
    for (const sc of stateChanges) {
      const diff = sc.after - sc.before;
      const existing = axisChanges.get(sc.axis) || { total: 0, count: 0 };
      existing.total += diff;
      existing.count += 1;
      axisChanges.set(sc.axis, existing);
    }

    const growthSummary = Object.fromEntries(
      Array.from(axisChanges.entries()).map(([axis, { total, count }]) => [
        axis,
        { totalChange: total, avgChange: Math.round((total / count) * 10) / 10, count },
      ]),
    );

    return { timeline, growthSummary, totalWorks: new Set(stateChanges.map((s) => s.workId)).size };
  }

  // Points
  async getPoints(userId: string) {
    let account = await this.prisma.pointAccount.findUnique({ where: { userId } });
    if (!account) {
      account = await this.prisma.pointAccount.create({ data: { userId } });
    }
    return account;
  }

  async addPoints(userId: string, amount: number, type: 'EARN_REVIEW' | 'EARN_EMOTION_TAG' | 'EARN_STATE_CHANGE', reason?: string) {
    let account = await this.prisma.pointAccount.findUnique({ where: { userId } });
    if (!account) {
      account = await this.prisma.pointAccount.create({ data: { userId } });
    }

    const [updatedAccount, transaction] = await this.prisma.$transaction([
      this.prisma.pointAccount.update({
        where: { id: account.id },
        data: { balance: { increment: amount } },
      }),
      this.prisma.pointTransaction.create({
        data: { userId, accountId: account.id, amount, type, reason },
      }),
    ]);

    return { account: updatedAccount, transaction };
  }

  async getPointHistory(userId: string) {
    return this.prisma.pointTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

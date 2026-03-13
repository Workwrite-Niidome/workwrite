import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';

@Injectable()
export class ReflectionService {
  private readonly logger = new Logger(ReflectionService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
  ) {}

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

  async generateTimelineNarrative(userId: string) {
    const enabled = await this.aiSettings.isAiEnabled();
    if (!enabled) throw new ServiceUnavailableException('AI is currently disabled');

    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    const model = await this.aiSettings.getModel();

    // Gather timeline data
    const [stateChanges, emotionTags, reviews] = await Promise.all([
      this.prisma.stateChange.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        include: { work: { select: { title: true } } },
      }),
      this.prisma.userEmotionTag.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        include: { tag: true, work: { select: { title: true } } },
      }),
      this.prisma.review.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        include: { work: { select: { title: true } } },
      }),
    ]);

    const timelineData = [
      ...stateChanges.map((sc) => `${sc.createdAt.toISOString().slice(0, 10)}: 「${sc.work.title}」で${sc.axis}が${sc.before}→${sc.after}に変化`),
      ...emotionTags.map((et) => `${et.createdAt.toISOString().slice(0, 10)}: 「${et.work.title}」で${et.tag.name}(強度:${et.intensity})を感じた`),
      ...reviews.map((r) => `${r.createdAt.toISOString().slice(0, 10)}: 「${r.work.title}」にレビューを投稿`),
    ].sort();

    if (timelineData.length === 0) {
      return { narrative: '読書活動がまだありません。作品を読んで感情タグやレビューを残してみましょう。' };
    }

    const prompt = `以下は一人の読者の読書タイムラインです。この読者の成長の物語をナラティブとして300-600字で語ってください。

タイムラインデータ:
${timelineData.join('\n')}

JSON形式で回答: { "narrative": "成長の物語...", "keyMoments": ["転機1", "転機2"], "overallTheme": "この読者の読書テーマ" }`;

    const startTime = Date.now();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Claude API error: ${response.status} ${errorText}`);
      throw new ServiceUnavailableException('AI service error');
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';
    const durationMs = Date.now() - startTime;

    // Log usage
    await this.prisma.aiUsageLog.create({
      data: {
        userId,
        feature: 'timeline_narrative',
        inputTokens: result.usage?.input_tokens || 0,
        outputTokens: result.usage?.output_tokens || 0,
        model,
        durationMs,
      },
    }).catch((e) => this.logger.error('Failed to log AI usage', e));

    // Parse JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      this.logger.warn('Failed to parse AI JSON response');
    }
    return { narrative: text };
  }
}

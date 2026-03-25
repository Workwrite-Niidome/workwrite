import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { StripeService } from '../billing/stripe.service';
import { NotificationsService } from '../notifications/notifications.service';

const PAYOUT_DEADLINE_DAYS = 90;

@Injectable()
export class LetterPayoutScheduler {
  private readonly logger = new Logger(LetterPayoutScheduler.name);

  constructor(
    private prisma: PrismaService,
    private billingService: BillingService,
    private stripeService: StripeService,
    private notifications: NotificationsService,
  ) {}

  /** Run daily at 9:00 AM JST — send reminders and process refunds */
  @Cron('0 0 * * *') // midnight UTC = 9 AM JST
  async processPayoutRemindersAndRefunds() {
    await this.transferPendingPayouts();
    await this.sendAuthorReminders();
    await this.sendSenderWarnings();
    await this.processRefunds();
  }

  /** Auto-transfer pending payouts for authors who now have Stripe Connect */
  private async transferPendingPayouts() {
    // Find all authors with pending payouts
    const authorsWithPending = await this.prisma.letter.groupBy({
      by: ['recipientId'],
      where: { payoutStatus: 'pending', moderationStatus: 'approved' },
    });

    for (const group of authorsWithPending) {
      try {
        const { transferred, totalAmount } = await this.billingService.transferPendingLetterPayouts(group.recipientId);
        if (transferred > 0) {
          this.logger.log(`Auto-transferred ${transferred} pending payouts (¥${totalAmount}) to author ${group.recipientId}`);
        }
      } catch (e: any) {
        // Author doesn't have Connect yet — skip silently
      }
    }
  }

  /** Notify authors with pending payouts at Day 30 and Day 60 */
  private async sendAuthorReminders() {
    const now = new Date();

    // Day 30 reminder: letters created 29-30 days ago
    const day30Start = new Date(now);
    day30Start.setDate(day30Start.getDate() - 30);
    const day30End = new Date(now);
    day30End.setDate(day30End.getDate() - 29);

    // Day 60 reminder: letters created 59-60 days ago
    const day60Start = new Date(now);
    day60Start.setDate(day60Start.getDate() - 60);
    const day60End = new Date(now);
    day60End.setDate(day60End.getDate() - 59);

    for (const [start, end, daysLeft] of [[day30Start, day30End, 60], [day60Start, day60End, 30]] as const) {
      const pendingAuthors = await this.prisma.letter.groupBy({
        by: ['recipientId'],
        where: {
          payoutStatus: 'pending',
          moderationStatus: 'approved',
          createdAt: { gte: start, lt: end },
        },
        _sum: { amount: true },
        _count: true,
      });

      for (const group of pendingAuthors) {
        const totalAmount = Math.floor((group._sum.amount ?? 0) * 0.8);
        await this.notifications.createNotification(group.recipientId, {
          type: 'letter',
          title: `保留中のレター収益が¥${totalAmount}あります`,
          body: `Stripe設定を完了すると受け取れます。あと${daysLeft}日で送信者に返金されます。`,
        }).catch((e) => this.logger.error(`Reminder notification failed: ${e.message}`));
      }
    }
  }

  /** Notify senders 5 days before refund (Day 85) */
  private async sendSenderWarnings() {
    const day85Start = new Date();
    day85Start.setDate(day85Start.getDate() - 85);
    const day85End = new Date();
    day85End.setDate(day85End.getDate() - 84);

    const letters = await this.prisma.letter.findMany({
      where: {
        payoutStatus: 'pending',
        moderationStatus: 'approved',
        createdAt: { gte: day85Start, lt: day85End },
      },
      include: {
        recipient: { select: { displayName: true, name: true } },
      },
    });

    for (const letter of letters) {
      const authorName = letter.recipient.displayName || letter.recipient.name || '著者';
      await this.notifications.createNotification(letter.senderId, {
        type: 'letter',
        title: `${authorName}さんへのレター(¥${letter.amount})が5日後に返金されます`,
        body: '著者がまだ収益受け取り設定を完了していないため、期限到来後に自動返金されます。',
      }).catch((e) => this.logger.error(`Sender warning failed: ${e.message}`));
    }
  }

  /** Auto-refund letters past 90 days */
  private async processRefunds() {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() - PAYOUT_DEADLINE_DAYS);

    const expiredLetters = await this.prisma.letter.findMany({
      where: {
        payoutStatus: 'pending',
        moderationStatus: 'approved',
        createdAt: { lt: deadline },
        paymentId: { not: null },
      },
      include: {
        recipient: { select: { displayName: true, name: true } },
      },
    });

    for (const letter of expiredLetters) {
      try {
        // Find the Payment to get the Stripe payment intent ID
        const payment = await this.prisma.payment.findUnique({
          where: { id: letter.paymentId! },
        });

        if (payment?.stripePaymentId) {
          await this.stripeService.refundPayment(payment.stripePaymentId, {
            type: 'letter_payout_expired',
            letterId: letter.id,
          });
        }

        await this.prisma.letter.update({
          where: { id: letter.id },
          data: { payoutStatus: 'refunded' },
        });

        // Notify sender
        const authorName = letter.recipient.displayName || letter.recipient.name || '著者';
        await this.notifications.createNotification(letter.senderId, {
          type: 'letter',
          title: `${authorName}さんへのレター(¥${letter.amount})を返金しました`,
          body: '著者が収益受け取り設定を完了しなかったため、お支払い金額を返金しました。レターのメッセージは著者に届いています。',
        }).catch(() => {});

        this.logger.log(`Refunded letter ${letter.id} (¥${letter.amount}) to sender ${letter.senderId}`);
      } catch (e: any) {
        this.logger.error(`Failed to refund letter ${letter.id}: ${e.message}`);
      }
    }

    if (expiredLetters.length > 0) {
      this.logger.log(`Processed ${expiredLetters.length} letter refunds`);
    }
  }
}

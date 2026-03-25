import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { StripeService } from '../billing/stripe.service';
import { randomUUID } from 'crypto';

const PLATFORM_FEE_RATE = 0.2; // 20%

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private stripeService: StripeService,
  ) {}

  async createTip(payerId: string, recipientId: string, amount: number) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new BadRequestException('決済機能が現在利用できません。管理者にお問い合わせください。');
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { stripeAccountId: true },
    });
    if (!recipient?.stripeAccountId) {
      throw new BadRequestException('この著者はまだ収益受取設定を完了していないため、ギフトレターを送れません。');
    }

    const payer = await this.prisma.user.findUnique({
      where: { id: payerId },
      select: { email: true, stripeCustomerId: true },
    });
    if (!payer?.email) {
      throw new BadRequestException('メールアドレスが設定されていません。');
    }

    try {
      const customerId = await this.stripeService.getOrCreateCustomer(payerId, payer.email);
      const idempotencyKey = `letter_tip_${payerId}_${recipientId}_${randomUUID()}`;

      const { paymentIntentId, status } = await this.stripeService.createConnectPaymentIntent(
        customerId,
        recipient.stripeAccountId,
        amount,
        PLATFORM_FEE_RATE,
        { payerId, recipientId, type: 'letter_tip' },
        idempotencyKey,
      );

      // Use Stripe's actual status; webhook will update if it changes
      const payment = await this.prisma.payment.create({
        data: {
          stripePaymentId: paymentIntentId,
          payerId,
          recipientId,
          amount,
          type: 'LETTER',
          status: status === 'succeeded' ? 'succeeded' : 'pending',
        },
      });

      this.logger.log(`Connect payment created: ${paymentIntentId}, status=${status}, amount=${amount}, fee=${Math.round(amount * PLATFORM_FEE_RATE)}`);
      return payment;
    } catch (e: any) {
      this.logger.error(`Stripe Connect payment failed: ${e.message}`);
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('決済に失敗しました。もう一度お試しください。');
    }
  }

  async getSubscriptionStatus(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    return sub ? { active: sub.status === 'active', plan: sub.plan, currentPeriodEnd: sub.currentPeriodEnd } : { active: false };
  }

  async getPaymentHistory(userId: string) {
    return this.prisma.payment.findMany({
      where: { payerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

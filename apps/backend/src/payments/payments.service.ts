import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async createTip(payerId: string, recipientId: string, amount: number) {
    // In production, this would create a Stripe PaymentIntent
    // For MVP, we record the intent
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      this.logger.warn('STRIPE_SECRET_KEY not set, recording tip without payment processing');
    }

    const payment = await this.prisma.payment.create({
      data: {
        stripePaymentId: `tip_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        payerId,
        recipientId,
        amount,
        type: 'TIP',
        status: stripeKey ? 'pending' : 'mock',
      },
    });

    return payment;
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

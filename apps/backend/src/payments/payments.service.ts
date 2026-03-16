import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { StripeService } from '../billing/stripe.service';

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

    // Check if recipient has a Connect account
    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { stripeAccountId: true },
    });

    const payer = await this.prisma.user.findUnique({
      where: { id: payerId },
      select: { email: true, stripeCustomerId: true },
    });

    // If Stripe is configured AND recipient has Connect account → real payment
    if (stripeKey && recipient?.stripeAccountId && payer?.email) {
      try {
        // Ensure payer has a Stripe customer
        const customerId = await this.stripeService.getOrCreateCustomer(payerId, payer.email);

        // Create payment with Connect destination
        const { paymentIntentId } = await this.stripeService.createConnectPaymentIntent(
          customerId,
          recipient.stripeAccountId,
          amount,
          PLATFORM_FEE_RATE,
          {
            payerId,
            recipientId,
            type: 'letter_tip',
          },
        );

        const payment = await this.prisma.payment.create({
          data: {
            stripePaymentId: paymentIntentId,
            payerId,
            recipientId,
            amount,
            type: 'TIP',
            status: 'succeeded',
          },
        });

        this.logger.log(`Connect payment created: ${paymentIntentId}, amount=${amount}, fee=${Math.round(amount * PLATFORM_FEE_RATE)}`);
        return payment;
      } catch (e: any) {
        this.logger.error(`Stripe Connect payment failed: ${e.message}`);
        throw new BadRequestException('決済に失敗しました。もう一度お試しください。');
      }
    }

    // Fallback: mock payment (no Stripe key or no Connect account)
    if (!stripeKey) {
      this.logger.warn('STRIPE_SECRET_KEY not set, recording tip without payment processing');
    } else if (!recipient?.stripeAccountId) {
      this.logger.warn(`Recipient ${recipientId} has no Connect account, recording mock tip`);
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

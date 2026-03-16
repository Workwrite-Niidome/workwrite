import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { CreateCheckoutDto, GetTransactionsDto } from './dto/billing.dto';
import { CreditService } from './credit.service';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private billingService: BillingService,
    private stripeService: StripeService,
    private creditService: CreditService,
  ) {}

  @Get('status')
  async getBillingStatus(@Req() req: any) {
    return this.billingService.getBillingStatus(req.user.id);
  }

  @Post('checkout')
  async createCheckout(@Req() req: any, @Body() dto: CreateCheckoutDto) {
    return this.stripeService.createCheckoutSession(
      req.user.id,
      req.user.email,
      dto.plan,
    );
  }

  @Post('cancel')
  async cancelSubscription(@Req() req: any) {
    // Just set cancelAtPeriodEnd — actual cancellation happens at period end via webhook
    const sub = await (this.billingService as any).prisma.subscription.findUnique({
      where: { userId: req.user.id },
    });
    if (sub?.stripeSubId) {
      // Cancel at period end via Stripe
      const stripe = (this.stripeService as any).stripe;
      if (stripe) {
        await stripe.subscriptions.update(sub.stripeSubId, {
          cancel_at_period_end: true,
        });
      }
    }
    return { success: true };
  }

  @Post('credits/purchase')
  async purchaseCredits(@Req() req: any) {
    return this.stripeService.createCreditPurchaseSession(
      req.user.id,
      req.user.email,
    );
  }

  @Get('transactions')
  async getTransactions(
    @Req() req: any,
    @Query() query: GetTransactionsDto,
  ) {
    return this.creditService.getTransactionHistory(
      req.user.id,
      query.page || 1,
      query.limit || 20,
    );
  }

  @Post('portal')
  async createPortal(@Req() req: any) {
    return this.stripeService.createPortalSession(req.user.id);
  }

  // ─── Stripe Connect ──────────────────────────────

  @Get('connect/status')
  async getConnectStatus(@Req() req: any) {
    return { data: await this.stripeService.getConnectStatus(req.user.id) };
  }

  @Post('connect/onboarding')
  async createConnectOnboarding(@Req() req: any) {
    try {
      return await this.stripeService.createConnectOnboardingLink(req.user.id, req.user.email);
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        err?.message || 'Stripe Connectの設定に失敗しました。しばらくしてからお試しください。',
      );
    }
  }

  @Post('connect/login')
  async createConnectLogin(@Req() req: any) {
    try {
      return await this.stripeService.createConnectLoginLink(req.user.id);
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        err?.message || 'Stripeダッシュボードのリンク生成に失敗しました。',
      );
    }
  }
}

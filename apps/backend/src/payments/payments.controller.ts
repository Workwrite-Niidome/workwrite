import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreateTipDto } from './dto/create-tip.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('tip')
  @ApiOperation({ summary: 'Send a tip to an author' })
  createTip(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTipDto,
  ) {
    return this.paymentsService.createTip(userId, dto.recipientId, dto.amount);
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Get subscription status' })
  getSubscription(@CurrentUser('id') userId: string) {
    return this.paymentsService.getSubscriptionStatus(userId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get payment history' })
  getHistory(@CurrentUser('id') userId: string) {
    return this.paymentsService.getPaymentHistory(userId);
  }
}

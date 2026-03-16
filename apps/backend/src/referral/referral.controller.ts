import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReferralService } from './referral.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Referral')
@Controller('referral')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReferralController {
  constructor(private referralService: ReferralService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get referral dashboard (invite codes + rewards)' })
  async getDashboard(@CurrentUser('id') userId: string) {
    return { data: await this.referralService.getDashboard(userId) };
  }
}

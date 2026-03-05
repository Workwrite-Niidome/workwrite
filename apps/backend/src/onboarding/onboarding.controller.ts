import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { SubmitOnboardingDto } from './dto/onboarding.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Onboarding')
@Controller('users/me/onboarding')
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  @Get('questions')
  @ApiOperation({ summary: 'Get onboarding diagnosis questions' })
  getQuestions() {
    return this.onboardingService.getQuestions();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit onboarding diagnosis answers' })
  submit(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitOnboardingDto,
  ) {
    return this.onboardingService.submitOnboarding(userId, dto);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check onboarding status' })
  status(@CurrentUser('id') userId: string) {
    return this.onboardingService.getOnboardingStatus(userId);
  }
}

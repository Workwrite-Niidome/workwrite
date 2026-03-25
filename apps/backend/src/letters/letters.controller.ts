import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LettersService } from './letters.service';
import { StampsService } from './stamps/stamps.service';
import { StripeService } from '../billing/stripe.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateLetterDto } from './dto/create-letter.dto';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('Letters')
@Controller('letters')
export class LettersController {
  constructor(
    private lettersService: LettersService,
    private stampsService: StampsService,
    private stripeService: StripeService,
    private prisma: PrismaService,
  ) {}

  @Get('episode/:episodeId')
  @ApiOperation({ summary: 'Get letters for an episode' })
  findByEpisode(@Param('episodeId') episodeId: string) {
    return this.lettersService.findByEpisode(episodeId);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create letter + Stripe Checkout session (redirect flow)' })
  createCheckout(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') email: string,
    @Body() dto: CreateLetterDto,
  ) {
    return this.lettersService.createCheckout(userId, email, dto);
  }

  @Get('received')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get letters received (for authors)' })
  findReceived(@CurrentUser('id') userId: string) {
    return this.lettersService.findReceived(userId);
  }

  @Get('sent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get letters sent by current user' })
  findSent(@CurrentUser('id') userId: string) {
    return this.lettersService.findSent(userId);
  }

  @Get('earnings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get letter earnings summary (for authors)' })
  getEarnings(@CurrentUser('id') userId: string) {
    return this.lettersService.getEarnings(userId);
  }

  @Get('author-payment-status/:episodeId')
  @ApiOperation({ summary: 'Check if the episode author can receive letter payments' })
  async getAuthorPaymentStatus(@Param('episodeId') episodeId: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: { work: { select: { authorId: true } } },
    });
    if (!episode) return { canReceivePayment: false };

    const author = await this.prisma.user.findUnique({
      where: { id: episode.work.authorId },
      select: { stripeAccountId: true },
    });
    if (!author?.stripeAccountId) return { canReceivePayment: false };

    try {
      const status = await this.stripeService.getConnectStatus(episode.work.authorId);
      return { canReceivePayment: status.chargesEnabled && status.payoutsEnabled };
    } catch {
      return { canReceivePayment: false };
    }
  }
}

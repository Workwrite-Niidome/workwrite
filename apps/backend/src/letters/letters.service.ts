import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StripeService } from '../billing/stripe.service';
import { LetterModerationService } from './letter-moderation.service';
import { CreateLetterDto, LETTER_CONFIG } from './dto/create-letter.dto';

const userSelect = {
  id: true,
  name: true,
  displayName: true,
  avatarUrl: true,
};

@Injectable()
export class LettersService {
  private readonly logger = new Logger(LettersService.name);

  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
    private notifications: NotificationsService,
    private stripeService: StripeService,
    private moderation: LetterModerationService,
  ) {}

  async create(senderId: string, dto: CreateLetterDto) {
    const config = LETTER_CONFIG[dto.type];

    // Validate content length
    if (dto.content.length > config.maxChars) {
      throw new BadRequestException(
        `${dto.type}レターは${config.maxChars}文字までです`,
      );
    }

    // Get episode to find recipient (author)
    const episode = await this.prisma.episode.findUnique({
      where: { id: dto.episodeId },
      include: { work: { select: { authorId: true } } },
    });
    if (!episode) throw new NotFoundException('エピソードが見つかりません');

    const recipientId = episode.work.authorId;
    if (recipientId === senderId) {
      throw new BadRequestException('自分の作品にはレターを送れません');
    }

    // AI moderation
    const moderationResult = await this.moderation.moderate(dto.content);
    if (!moderationResult.approved && !moderationResult.needsManualReview) {
      throw new BadRequestException(
        moderationResult.reason || 'レター内容が不適切と判断されました',
      );
    }

    // Calculate amount
    const amount =
      dto.type === 'GIFT'
        ? (dto.giftAmount ?? 1000)
        : config.price;

    // If manual review needed, save letter as pending without processing payment
    if (moderationResult.needsManualReview) {
      const letter = await this.prisma.letter.create({
        data: {
          senderId,
          recipientId,
          episodeId: dto.episodeId,
          type: dto.type,
          content: dto.content,
          amount,
          isHighlighted: config.highlighted,
          moderationStatus: 'pending',
          moderationReason: 'AI審査が一時的に利用できないため、管理者による手動審査待ちです',
        },
        include: { sender: { select: userSelect } },
      });
      return letter;
    }

    // Process payment
    const payment = await this.payments.createTip(
      senderId,
      recipientId,
      amount,
    );

    // Create letter
    const letter = await this.prisma.letter.create({
      data: {
        senderId,
        recipientId,
        episodeId: dto.episodeId,
        type: dto.type,
        content: dto.content,
        amount,
        isHighlighted: config.highlighted,
        paymentId: payment.id,
        moderationStatus: 'approved',
      },
      include: { sender: { select: userSelect } },
    });

    // Notify author
    await this.notifications.createNotification(recipientId, {
      type: 'letter',
      title: 'レターが届きました',
      body: `${letter.sender.displayName || letter.sender.name}さんから¥${amount}のレターが届きました`,
      data: { letterId: letter.id, episodeId: dto.episodeId },
    });

    return letter;
  }

  /**
   * Create a PendingLetter + Stripe Checkout session.
   * Returns the Checkout URL for redirect.
   */
  async createCheckout(
    senderId: string,
    senderEmail: string,
    dto: CreateLetterDto,
  ): Promise<{ pendingLetterId: string; checkoutUrl: string }> {
    const config = LETTER_CONFIG[dto.type];

    // Validate content length
    if (dto.content.length > config.maxChars) {
      throw new BadRequestException(
        `${dto.type}レターは${config.maxChars}文字までです`,
      );
    }

    // Get episode to find recipient (author)
    const episode = await this.prisma.episode.findUnique({
      where: { id: dto.episodeId },
      include: { work: { select: { authorId: true } } },
    });
    if (!episode) throw new NotFoundException('エピソードが見つかりません');

    const recipientId = episode.work.authorId;
    if (recipientId === senderId) {
      throw new BadRequestException('自分の作品にはレターを送れません');
    }

    // AI moderation
    const moderationResult = await this.moderation.moderate(dto.content);
    if (!moderationResult.approved && !moderationResult.needsManualReview) {
      throw new BadRequestException(
        moderationResult.reason || 'レター内容が不適切と判断されました',
      );
    }

    // Calculate amount
    const amount =
      dto.type === 'GIFT'
        ? (dto.giftAmount ?? 1000)
        : config.price;

    // Create PendingLetter (stripeSessionId uses own ID as temporary unique placeholder)
    const pendingLetter = await this.prisma.pendingLetter.create({
      data: {
        senderId,
        recipientId,
        episodeId: dto.episodeId,
        type: dto.type,
        content: dto.content,
        amount,
        giftAmount: dto.type === 'GIFT' ? (dto.giftAmount ?? 1000) : null,
        moderationStatus: moderationResult.approved ? 'approved' : 'pending',
        moderationReason: moderationResult.needsManualReview
          ? 'AI審査が一時的に利用できないため、管理者による手動審査待ちです'
          : null,
        stripeSessionId: `placeholder`, // updated immediately below
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72h: Stripe webhook retry window is up to 3 days
      },
    });

    // Update placeholder to own ID (guaranteed unique by cuid)
    await this.prisma.pendingLetter.update({
      where: { id: pendingLetter.id },
      data: { stripeSessionId: pendingLetter.id },
    });

    // Create Stripe Checkout session — if this fails, clean up the PendingLetter
    let url: string;
    let sessionId: string;
    try {
      const result = await this.stripeService.createLetterCheckoutSession(
        senderId,
        senderEmail,
        pendingLetter.id,
        amount,
        { recipientId, episodeId: dto.episodeId, letterType: dto.type },
      );
      url = result.url;
      sessionId = result.sessionId;
    } catch (err) {
      // Stripe Checkout creation failed — delete orphaned PendingLetter
      await this.prisma.pendingLetter.delete({ where: { id: pendingLetter.id } }).catch(() => {});
      this.logger.error(`Stripe Checkout creation failed for PendingLetter ${pendingLetter.id}: ${err}`);
      throw err;
    }

    // Store real Stripe session ID for audit trail
    await this.prisma.pendingLetter.update({
      where: { id: pendingLetter.id },
      data: { stripeSessionId: sessionId },
    });

    return { pendingLetterId: pendingLetter.id, checkoutUrl: url };
  }

  async findByEpisode(episodeId: string) {
    return this.prisma.letter.findMany({
      where: { episodeId, moderationStatus: 'approved' },
      orderBy: [{ isHighlighted: 'desc' }, { createdAt: 'desc' }],
      include: { sender: { select: userSelect } },
    });
  }

  async findReceived(userId: string) {
    return this.prisma.letter.findMany({
      where: { recipientId: userId, moderationStatus: 'approved' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sender: { select: userSelect },
        episode: { select: { id: true, title: true, workId: true } },
      },
    });
  }

  async findSent(userId: string) {
    return this.prisma.letter.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        recipient: { select: userSelect },
        episode: { select: { id: true, title: true, workId: true } },
      },
    });
  }

  async getEarnings(userId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalLetters, monthlyLetters, totalEarnings, monthlyEarnings] =
      await Promise.all([
        this.prisma.letter.count({
          where: { recipientId: userId, moderationStatus: 'approved' },
        }),
        this.prisma.letter.count({
          where: {
            recipientId: userId,
            moderationStatus: 'approved',
            createdAt: { gte: monthStart },
          },
        }),
        this.prisma.letter.aggregate({
          where: { recipientId: userId, moderationStatus: 'approved' },
          _sum: { amount: true },
        }),
        this.prisma.letter.aggregate({
          where: {
            recipientId: userId,
            moderationStatus: 'approved',
            createdAt: { gte: monthStart },
          },
          _sum: { amount: true },
        }),
      ]);

    const platformCut = 0.2;
    const totalGross = totalEarnings._sum.amount ?? 0;
    const monthlyGross = monthlyEarnings._sum.amount ?? 0;

    return {
      totalLetters,
      monthlyLetters,
      totalEarnings: Math.floor(totalGross * (1 - platformCut)),
      monthlyEarnings: Math.floor(monthlyGross * (1 - platformCut)),
      platformCutRate: platformCut,
    };
  }
}

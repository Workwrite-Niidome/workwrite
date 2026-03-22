import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/register.dto';

const REFERRAL_REWARD_CR = 20;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        displayName: dto.displayName || dto.name,
      },
    });

    // Create point account
    await this.prisma.pointAccount.create({
      data: { userId: user.id },
    });

    // Grant referral reward if invited
    if (dto.referrerId) {
      this.grantReferralReward(dto.referrerId, user.id).catch((e) =>
        this.logger.warn(`Referral reward failed: ${e}`),
      );
    }

    return this.generateTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('Account has been suspended');
    }

    return this.generateTokens(user);
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_SECRET'),
      });
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async findOrCreateOAuthUser(profile: {
    provider: string;
    providerId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): Promise<AuthResponseDto> {
    // Check if OAuth account exists
    const oauthAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerId: {
          provider: profile.provider,
          providerId: profile.providerId,
        },
      },
      include: { user: true },
    });

    if (oauthAccount) {
      return this.generateTokens(oauthAccount.user);
    }

    // Check if user with this email exists
    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          displayName: profile.name,
          avatarUrl: profile.avatarUrl,
          emailVerified: true,
        },
      });
      await this.prisma.pointAccount.create({
        data: { userId: user.id },
      });
    }

    // Link OAuth account
    await this.prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: profile.provider,
        providerId: profile.providerId,
      },
    });

    return this.generateTokens(user);
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        role: true,
        avatarUrl: true,
        isBanned: true,
      },
    });
    if (user?.isBanned) return null;
    return user;
  }

  /**
   * Grant Cr reward to the referrer when a new user registers via invite link.
   */
  private async grantReferralReward(referrerId: string, newUserId: string) {
    // Prevent self-referral
    if (referrerId === newUserId) return;

    // Verify referrer exists
    const referrer = await this.prisma.user.findUnique({ where: { id: referrerId } });
    if (!referrer) return;

    // Ensure credit balance exists
    await this.prisma.creditBalance.upsert({
      where: { userId: referrerId },
      update: {},
      create: { userId: referrerId, balance: 20, monthlyBalance: 20, purchasedBalance: 0, monthlyGranted: 20, lastGrantedAt: new Date() },
    });

    // Atomic: lock + check + grant inside single transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT * FROM "CreditBalance" WHERE "userId" = $1 FOR UPDATE', referrerId,
      );

      // Check for duplicate (inside transaction = race-safe)
      const existing = await tx.creditTransaction.findFirst({
        where: { userId: referrerId, type: 'REFERRAL_REWARD', description: `招待報酬 (${newUserId})` },
      });
      if (existing) return;

      const balance = await tx.creditBalance.update({
        where: { userId: referrerId },
        data: {
          balance: { increment: REFERRAL_REWARD_CR },
          purchasedBalance: { increment: REFERRAL_REWARD_CR },
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId: referrerId,
          amount: REFERRAL_REWARD_CR,
          type: 'REFERRAL_REWARD',
          status: 'confirmed',
          balance: balance.balance,
          description: `招待報酬 (${newUserId})`,
        },
      });
    });

    this.logger.log(`Granted ${REFERRAL_REWARD_CR}Cr referral reward to ${referrerId} for inviting ${newUserId}`);
  }

  private generateTokens(user: {
    id: string;
    email: string;
    name: string;
    displayName: string | null;
    role: string;
    avatarUrl: string | null;
  }): AuthResponseDto {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN', '1h'),
    });

    const refreshToken = this.jwt.sign(
      { ...payload, type: 'refresh', jti: uuidv4() },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        displayName: user.displayName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  }
}

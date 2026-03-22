import { Controller, Post, Get, Body, Res, HttpCode, HttpStatus, Logger, BadRequestException, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

// In-memory store for PKCE code_verifier (short-lived, keyed by state)
const pkceStore = new Map<string, { codeVerifier: string; createdAt: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pkceStore) {
    if (now - val.createdAt > 10 * 60 * 1000) pkceStore.delete(key);
  }
}, 5 * 60 * 1000);

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register with email/password' })
  @ApiResponse({ status: 201, description: 'User registered' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Get('referral')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get referral info for current user' })
  @ApiResponse({ status: 200, description: 'Referral info returned' })
  getReferralInfo(@CurrentUser('id') userId: string) {
    return this.authService.getReferralInfo(userId);
  }

  // ─── Twitter/X OAuth 2.0 PKCE ────────────────────────────

  @Get('twitter')
  @ApiOperation({ summary: 'Redirect to Twitter for OAuth 2.0 login' })
  async twitterAuth(@Res() res: Response) {
    const clientId = this.config.get<string>('TWITTER_CLIENT_ID');
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'https://workwrite.jp';
    const callbackUrl = `${frontendUrl}/auth/twitter/callback`;

    if (!clientId) {
      throw new BadRequestException('Twitter OAuth is not configured');
    }

    // Generate PKCE code_verifier and code_challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const state = crypto.randomBytes(16).toString('hex');

    // Store code_verifier for callback
    pkceStore.set(state, { codeVerifier, createdAt: Date.now() });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'tweet.read users.read offline.access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    res.redirect(`https://twitter.com/i/oauth2/authorize?${params.toString()}`);
  }

  @Post('twitter/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Twitter OAuth 2.0 callback' })
  async twitterCallback(@Body() body: { code: string; state: string }) {
    const clientId = this.config.get<string>('TWITTER_CLIENT_ID');
    const clientSecret = this.config.get<string>('TWITTER_CLIENT_SECRET');
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'https://workwrite.jp';
    const callbackUrl = `${frontendUrl}/auth/twitter/callback`;

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Twitter OAuth is not configured');
    }

    const stored = pkceStore.get(body.state);
    if (!stored) {
      throw new BadRequestException('無効または期限切れの認証リクエストです。もう一度お試しください。');
    }
    pkceStore.delete(body.state);

    try {
      // Exchange authorization code for access token
      const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          code: body.code,
          grant_type: 'authorization_code',
          redirect_uri: callbackUrl,
          code_verifier: stored.codeVerifier,
        }).toString(),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        this.logger.error(`Twitter token exchange failed: ${tokenRes.status} ${err}`);
        throw new Error(`Token exchange failed: ${tokenRes.status}`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Fetch user profile from Twitter API v2
      const profileRes = await fetch('https://api.twitter.com/2/users/me?user.fields=name,username,profile_image_url', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!profileRes.ok) {
        throw new Error(`Profile fetch failed: ${profileRes.status}`);
      }

      const profileData = await profileRes.json();
      const profile = profileData.data;

      // Create or link account
      return this.authService.findOrCreateOAuthUser({
        provider: 'twitter',
        providerId: profile.id,
        email: `twitter_${profile.id}@workwrite.jp`,
        name: profile.name || profile.username,
        avatarUrl: profile.profile_image_url?.replace('_normal', '') || undefined,
      });
    } catch (err: any) {
      this.logger.error(`Twitter OAuth callback failed: ${err.message}`);
      throw new BadRequestException('Twitter認証に失敗しました。もう一度お試しください。');
    }
  }
}

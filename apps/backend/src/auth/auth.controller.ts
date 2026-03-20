import { Controller, Post, Get, Body, Query, Res, HttpCode, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/register.dto';

// In-memory store for OAuth request tokens (short-lived)
const oauthTokenStore = new Map<string, { secret: string; createdAt: number }>();

// Clean up expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthTokenStore) {
    if (now - val.createdAt > 10 * 60 * 1000) oauthTokenStore.delete(key);
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

  // ─── Twitter/X OAuth 1.0a ─────────────────────────────────

  @Get('twitter')
  @ApiOperation({ summary: 'Redirect to Twitter for OAuth login' })
  async twitterAuth(@Res() res: Response) {
    const apiKey = this.config.get<string>('TWITTER_API_KEY');
    const apiSecret = this.config.get<string>('TWITTER_API_SECRET');
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'https://workwrite.jp';
    const callbackUrl = `${frontendUrl}/auth/twitter/callback`;

    if (!apiKey || !apiSecret) {
      throw new BadRequestException('Twitter OAuth is not configured');
    }

    try {
      const requestTokenData = await this.getOAuthRequestToken(apiKey, apiSecret, callbackUrl);
      oauthTokenStore.set(requestTokenData.oauth_token, {
        secret: requestTokenData.oauth_token_secret,
        createdAt: Date.now(),
      });

      res.redirect(`https://api.twitter.com/oauth/authenticate?oauth_token=${requestTokenData.oauth_token}`);
    } catch (err: any) {
      this.logger.error(`Twitter OAuth request token failed: ${err.message}`);
      throw new BadRequestException('Twitter認証の開始に失敗しました');
    }
  }

  @Post('twitter/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Twitter OAuth callback' })
  async twitterCallback(@Body() body: { oauth_token: string; oauth_verifier: string }) {
    const apiKey = this.config.get<string>('TWITTER_API_KEY');
    const apiSecret = this.config.get<string>('TWITTER_API_SECRET');

    if (!apiKey || !apiSecret) {
      throw new BadRequestException('Twitter OAuth is not configured');
    }

    const stored = oauthTokenStore.get(body.oauth_token);
    if (!stored) {
      throw new BadRequestException('無効または期限切れの認証リクエストです。もう一度お試しください。');
    }
    oauthTokenStore.delete(body.oauth_token);

    try {
      // Exchange request token for access token
      const accessData = await this.getOAuthAccessToken(
        apiKey, apiSecret, body.oauth_token, stored.secret, body.oauth_verifier,
      );

      // Fetch user profile
      const profile = await this.getTwitterProfile(apiKey, apiSecret, accessData.oauth_token, accessData.oauth_token_secret);

      // Create or link account
      return this.authService.findOrCreateOAuthUser({
        provider: 'twitter',
        providerId: profile.id_str,
        email: `twitter_${profile.id_str}@workwrite.jp`, // Twitter doesn't always provide email
        name: profile.name || profile.screen_name,
        avatarUrl: profile.profile_image_url_https?.replace('_normal', '') || undefined,
      });
    } catch (err: any) {
      this.logger.error(`Twitter OAuth callback failed: ${err.message}`);
      throw new BadRequestException('Twitter認証に失敗しました。もう一度お試しください。');
    }
  }

  // ─── OAuth 1.0a Helpers ───────────────────────────────────

  private async getOAuthRequestToken(apiKey: string, apiSecret: string, callbackUrl: string) {
    const params = this.buildOAuthParams(apiKey, {
      oauth_callback: callbackUrl,
    });
    const signature = this.signRequest('POST', 'https://api.twitter.com/oauth/request_token', params, apiSecret, '');
    params.oauth_signature = signature;

    const res = await fetch('https://api.twitter.com/oauth/request_token', {
      method: 'POST',
      headers: { Authorization: this.buildAuthHeader(params) },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Request token failed: ${res.status} ${text}`);
    }

    const body = await res.text();
    return Object.fromEntries(new URLSearchParams(body)) as Record<string, string>;
  }

  private async getOAuthAccessToken(
    apiKey: string, apiSecret: string,
    oauthToken: string, oauthTokenSecret: string, oauthVerifier: string,
  ) {
    const params = this.buildOAuthParams(apiKey, {
      oauth_token: oauthToken,
      oauth_verifier: oauthVerifier,
    });
    const signature = this.signRequest('POST', 'https://api.twitter.com/oauth/access_token', params, apiSecret, oauthTokenSecret);
    params.oauth_signature = signature;

    const res = await fetch('https://api.twitter.com/oauth/access_token', {
      method: 'POST',
      headers: { Authorization: this.buildAuthHeader(params) },
    });

    if (!res.ok) throw new Error(`Access token failed: ${res.status}`);

    const body = await res.text();
    return Object.fromEntries(new URLSearchParams(body)) as Record<string, string>;
  }

  private async getTwitterProfile(
    apiKey: string, apiSecret: string,
    oauthToken: string, oauthTokenSecret: string,
  ) {
    const url = 'https://api.twitter.com/1.1/account/verify_credentials.json?include_email=true';
    const params = this.buildOAuthParams(apiKey, { oauth_token: oauthToken });
    const signature = this.signRequest('GET', url.split('?')[0], { ...params, include_email: 'true' }, apiSecret, oauthTokenSecret);
    params.oauth_signature = signature;

    const res = await fetch(url, {
      headers: { Authorization: this.buildAuthHeader(params) },
    });

    if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
    return res.json();
  }

  private buildOAuthParams(apiKey: string, extra: Record<string, string> = {}): Record<string, string> {
    return {
      oauth_consumer_key: apiKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0',
      ...extra,
    };
  }

  private signRequest(method: string, url: string, params: Record<string, string>, apiSecret: string, tokenSecret: string): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((k) => `${this.pctEncode(k)}=${this.pctEncode(params[k])}`)
      .join('&');

    const baseString = `${method}&${this.pctEncode(url)}&${this.pctEncode(sortedParams)}`;
    const signingKey = `${this.pctEncode(apiSecret)}&${this.pctEncode(tokenSecret)}`;

    return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  }

  private buildAuthHeader(params: Record<string, string>): string {
    const parts = Object.keys(params)
      .filter((k) => k.startsWith('oauth_'))
      .sort()
      .map((k) => `${this.pctEncode(k)}="${this.pctEncode(params[k])}"`)
      .join(', ');
    return `OAuth ${parts}`;
  }

  private pctEncode(str: string): string {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  }
}

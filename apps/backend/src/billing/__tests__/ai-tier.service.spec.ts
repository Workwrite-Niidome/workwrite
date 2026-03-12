import { Test, TestingModule } from '@nestjs/testing';
import { AiTierService } from '../../ai-settings/ai-tier.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiSettingsService } from '../../ai-settings/ai-settings.service';
import { CreditService } from '../credit.service';

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockPrismaService = () => ({
  subscription: { findUnique: jest.fn() },
  aiUsageLog: { count: jest.fn() },
});

const mockAiSettingsService = () => ({
  getModel: jest.fn().mockResolvedValue('claude-sonnet-4-6'),
});

const mockCreditService = () => ({
  getBalance: jest.fn(),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AiTierService', () => {
  let service: AiTierService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let creditService: ReturnType<typeof mockCreditService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    creditService = mockCreditService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiTierService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiSettingsService, useValue: mockAiSettingsService() },
        { provide: CreditService, useValue: creditService },
      ],
    }).compile();

    service = module.get<AiTierService>(AiTierService);
  });

  // ─── getCreditCost ─────────────────────────────────────────────────────────

  describe('getCreditCost', () => {
    // Companion
    it('returns 0 for companion feature', () => {
      expect(service.getCreditCost('companion')).toBe(0);
    });

    it('returns 0 for companion even with premiumMode and isOpus flags', () => {
      expect(service.getCreditCost('companion', true, true)).toBe(0);
    });

    // Light features (free, Haiku)
    it('returns 0 for proofread (light feature)', () => {
      expect(service.getCreditCost('proofread')).toBe(0);
    });

    it('returns 0 for scoring (light feature)', () => {
      expect(service.getCreditCost('scoring')).toBe(0);
    });

    it('returns 0 for episode_scoring (light feature)', () => {
      expect(service.getCreditCost('episode_scoring')).toBe(0);
    });

    it('returns 0 for synopsis-gen (light feature)', () => {
      expect(service.getCreditCost('synopsis-gen')).toBe(0);
    });

    it('returns 0 for highlight_explain (light feature)', () => {
      expect(service.getCreditCost('highlight_explain')).toBe(0);
    });

    it('returns 0 for onboarding_profile (light feature)', () => {
      expect(service.getCreditCost('onboarding_profile')).toBe(0);
    });

    it('returns 0 for embedding_generation (light feature)', () => {
      expect(service.getCreditCost('embedding_generation')).toBe(0);
    });

    it('returns 0 for light features even with premiumMode and isOpus flags', () => {
      expect(service.getCreditCost('proofread', true, true)).toBe(0);
    });

    // Normal Sonnet (1cr)
    it('returns 1 for a normal writing feature (Sonnet)', () => {
      expect(service.getCreditCost('writing')).toBe(1);
    });

    it('returns 1 for creation_wizard', () => {
      expect(service.getCreditCost('creation_wizard')).toBe(1);
    });

    it('returns 1 for an unknown feature without premium flags', () => {
      expect(service.getCreditCost('unknown_feature')).toBe(1);
    });

    // Thinking mode (2cr)
    it('returns 2 for thinking mode (premiumMode=true, isOpus=false)', () => {
      expect(service.getCreditCost('writing', true, false)).toBe(2);
    });

    it('returns 2 for thinking mode with default isOpus', () => {
      expect(service.getCreditCost('writing', true)).toBe(2);
    });

    // Opus mode (5cr)
    it('returns 5 for opus mode (premiumMode=true, isOpus=true)', () => {
      expect(service.getCreditCost('writing', true, true)).toBe(5);
    });

    it('returns 5 for creation_wizard in opus mode', () => {
      expect(service.getCreditCost('creation_wizard', true, true)).toBe(5);
    });

    // Edge cases
    it('returns 0 for companion regardless of isOpus', () => {
      expect(service.getCreditCost('companion', false, true)).toBe(0);
    });

    it('returns 1 when premiumMode is false and isOpus is true (isOpus without premiumMode = normal)', () => {
      // isOpus alone doesn't trigger opus mode; requires premiumMode=true too
      expect(service.getCreditCost('writing', false, true)).toBe(1);
    });

    it('returns 0 for empty string feature (treated as non-light, non-companion)', () => {
      // '' is not in LIGHT_FEATURES and not 'companion' → falls through to return 1
      expect(service.getCreditCost('')).toBe(1);
    });
  });

  // ─── getUserTier ───────────────────────────────────────────────────────────

  describe('getUserTier', () => {
    it('returns pro tier capabilities for active pro subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ status: 'active', plan: 'pro' });
      creditService.getBalance.mockResolvedValue({ total: 600, monthly: 600, purchased: 0 });

      const tier = await service.getUserTier('user-1');

      expect(tier.plan).toBe('pro');
      expect(tier.canUseAi).toBe(true);
      expect(tier.canUseThinking).toBe(true);
      expect(tier.canUseOpus).toBe(true);
      expect(tier.remainingFreeUses).toBeNull();
    });

    it('returns standard tier capabilities for active standard subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ status: 'active', plan: 'standard' });
      creditService.getBalance.mockResolvedValue({ total: 200, monthly: 200, purchased: 0 });

      const tier = await service.getUserTier('user-1');

      expect(tier.plan).toBe('standard');
      expect(tier.canUseAi).toBe(true);
      expect(tier.canUseThinking).toBe(true);
      expect(tier.canUseOpus).toBe(false);
      expect(tier.remainingFreeUses).toBeNull();
    });

    it('returns free tier with canUseAi=true when credits remain', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      creditService.getBalance.mockResolvedValue({ total: 10, monthly: 10, purchased: 0 });

      const tier = await service.getUserTier('user-1');

      expect(tier.plan).toBe('free');
      expect(tier.canUseAi).toBe(true);
      expect(tier.canUseThinking).toBe(false);
      expect(tier.canUseOpus).toBe(false);
      expect(tier.remainingFreeUses).toBe(10);
    });

    it('returns free tier with canUseAi=false when credits are 0', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      creditService.getBalance.mockResolvedValue({ total: 0, monthly: 0, purchased: 0 });

      const tier = await service.getUserTier('user-1');

      expect(tier.plan).toBe('free');
      expect(tier.canUseAi).toBe(false);
      expect(tier.remainingFreeUses).toBe(0);
    });

    it('falls back to free tier when subscription is not active', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ status: 'canceled', plan: 'pro' });
      creditService.getBalance.mockResolvedValue({ total: 5, monthly: 5, purchased: 0 });

      const tier = await service.getUserTier('user-1');

      expect(tier.plan).toBe('free');
      expect(tier.canUseOpus).toBe(false);
    });
  });
});

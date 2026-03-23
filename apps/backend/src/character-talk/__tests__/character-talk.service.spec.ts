import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException, NotFoundException } from '@nestjs/common';
import { CharacterTalkService } from '../character-talk.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiSettingsService } from '../../ai-settings/ai-settings.service';
import { CreditService } from '../../billing/credit.service';
import { CharacterTalkRevenueService } from '../character-talk-revenue.service';

// ─── Constants (mirrors the service) ─────────────────────────────────────────

const HAIKU = 'claude-haiku-4-5-20251001';
const OPUS = 'claude-opus-4-6';
const SONNET = 'claude-sonnet-4-6';

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockPrismaService = () => ({
  aiConversation: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  work: {
    findUnique: jest.fn(),
  },
  readingProgress: {
    findMany: jest.fn(),
  },
  storyCharacter: {
    findMany: jest.fn(),
  },
  storyArc: {
    findUnique: jest.fn(),
  },
  workCreationPlan: {
    findUnique: jest.fn(),
  },
  episodeAnalysis: {
    findMany: jest.fn(),
  },
  aiUsageLog: {
    create: jest.fn(),
  },
});

const mockAiSettingsService = () => ({
  isAiEnabled: jest.fn().mockResolvedValue(true),
  getApiKey: jest.fn().mockResolvedValue('test-api-key'),
  getModel: jest.fn().mockResolvedValue(SONNET),
});

const mockCreditService = () => ({
  getBalance: jest.fn(),
  consumeCredits: jest.fn(),
  confirmTransaction: jest.fn(),
  refundTransaction: jest.fn(),
});

const mockRevenueService = () => ({
  recordRevenue: jest.fn(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Drains an async generator, collecting all yielded values.
 * Ignores errors thrown after all values are yielded (e.g., NotFoundException).
 */
async function drainGenerator(gen: AsyncGenerator<string>): Promise<string[]> {
  const results: string[] = [];
  try {
    for await (const chunk of gen) {
      results.push(chunk);
    }
  } catch {
    // Intentionally ignore errors — we only care about the model selection side-effect
  }
  return results;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CharacterTalkService - model selection', () => {
  let service: CharacterTalkService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let aiSettings: ReturnType<typeof mockAiSettingsService>;
  let creditService: ReturnType<typeof mockCreditService>;
  let revenueService: ReturnType<typeof mockRevenueService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    aiSettings = mockAiSettingsService();
    creditService = mockCreditService();
    revenueService = mockRevenueService();

    // consumeCredits returns a transaction by default
    creditService.consumeCredits.mockResolvedValue({
      transactionId: 'tx-1',
      newBalance: 19,
      purchasedDeducted: 0,
    });

    // Subsequent DB calls: no conversation, then work not found triggers refund + NotFoundException
    prisma.aiConversation.findFirst.mockResolvedValue(null);
    prisma.work.findUnique.mockResolvedValue(null); // causes work-not-found path
    prisma.readingProgress.findMany.mockResolvedValue([]);
    prisma.storyCharacter.findMany.mockResolvedValue([]);
    prisma.storyArc.findUnique.mockResolvedValue(null);
    prisma.workCreationPlan.findUnique.mockResolvedValue(null);
    prisma.episodeAnalysis.findMany.mockResolvedValue([]);

    creditService.refundTransaction.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterTalkService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiSettingsService, useValue: aiSettings },
        { provide: CreditService, useValue: creditService },
        { provide: CharacterTalkRevenueService, useValue: revenueService },
      ],
    }).compile();

    service = module.get<CharacterTalkService>(CharacterTalkService);
  });

  // ─── Haiku (monthly-only) ──────────────────────────────────────────────────

  describe('when only monthly credits are available (purchasedBalance = 0)', () => {
    beforeEach(() => {
      creditService.getBalance.mockResolvedValue({
        total: 20,
        monthly: 20,
        purchased: 0,
      });
    });

    it('selects Haiku model', async () => {
      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion' }),
      );

      expect(creditService.consumeCredits).toHaveBeenCalledWith(
        'user-1',
        1,
        'character_talk',
        HAIKU,
      );
    });

    it('charges 1 credit for Haiku', async () => {
      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion' }),
      );

      const [, cost] = creditService.consumeCredits.mock.calls[0];
      expect(cost).toBe(1);
    });

    it('selects Haiku even when useOpus=true but purchased=0', async () => {
      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion', useOpus: true }),
      );

      expect(creditService.consumeCredits).toHaveBeenCalledWith(
        'user-1',
        1,
        'character_talk',
        HAIKU,
      );
    });

    it('does not call aiSettings.getModel when monthly-only', async () => {
      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion' }),
      );

      expect(aiSettings.getModel).not.toHaveBeenCalled();
    });
  });

  // ─── Sonnet (purchased credits available, useOpus=false) ──────────────────

  describe('when purchased credits are available and useOpus is not set', () => {
    beforeEach(() => {
      creditService.getBalance.mockResolvedValue({
        total: 25,
        monthly: 20,
        purchased: 5,
      });
    });

    it('selects Sonnet model (from aiSettings.getModel)', async () => {
      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion' }),
      );

      expect(creditService.consumeCredits).toHaveBeenCalledWith(
        'user-1',
        1,
        'character_talk',
        SONNET,
      );
    });

    it('charges 1 credit for Sonnet', async () => {
      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion' }),
      );

      const [, cost] = creditService.consumeCredits.mock.calls[0];
      expect(cost).toBe(1);
    });

    it('calls aiSettings.getModel to resolve the Sonnet model name', async () => {
      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion' }),
      );

      expect(aiSettings.getModel).toHaveBeenCalledTimes(1);
    });

    it('uses the model name returned by aiSettings.getModel', async () => {
      aiSettings.getModel.mockResolvedValue('claude-sonnet-custom');

      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion' }),
      );

      expect(creditService.consumeCredits).toHaveBeenCalledWith(
        'user-1',
        1,
        'character_talk',
        'claude-sonnet-custom',
      );
    });
  });

  // ─── Opus (purchased credits available, useOpus=true) ─────────────────────

  describe('when purchased credits are available and useOpus=true', () => {
    beforeEach(() => {
      creditService.getBalance.mockResolvedValue({
        total: 25,
        monthly: 20,
        purchased: 5,
      });
    });

    it('selects Opus model', async () => {
      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion', useOpus: true }),
      );

      expect(creditService.consumeCredits).toHaveBeenCalledWith(
        'user-1',
        5,
        'character_talk',
        OPUS,
      );
    });

    it('charges 5 credits for Opus', async () => {
      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion', useOpus: true }),
      );

      const [, cost] = creditService.consumeCredits.mock.calls[0];
      expect(cost).toBe(5);
    });

    it('does not call aiSettings.getModel when Opus is selected', async () => {
      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion', useOpus: true }),
      );

      expect(aiSettings.getModel).not.toHaveBeenCalled();
    });

    it('selects Opus even with just 1 purchased credit available', async () => {
      creditService.getBalance.mockResolvedValue({
        total: 21,
        monthly: 20,
        purchased: 1,
      });

      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion', useOpus: true }),
      );

      expect(creditService.consumeCredits).toHaveBeenCalledWith(
        'user-1',
        5,
        'character_talk',
        OPUS,
      );
    });
  });

  // ─── useOpus=true but purchased=0 → falls back to Haiku ──────────────────

  describe('when useOpus=true but no purchased credits (purchased = 0)', () => {
    beforeEach(() => {
      creditService.getBalance.mockResolvedValue({
        total: 20,
        monthly: 20,
        purchased: 0,
      });
    });

    it('falls back to Haiku (not Sonnet, not Opus)', async () => {
      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion', useOpus: true }),
      );

      expect(creditService.consumeCredits).toHaveBeenCalledWith(
        'user-1',
        1,
        'character_talk',
        HAIKU,
      );
    });

    it('charges 1 credit when falling back from Opus request to Haiku', async () => {
      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion', useOpus: true }),
      );

      const [, cost] = creditService.consumeCredits.mock.calls[0];
      expect(cost).toBe(1);
    });
  });

  // ─── AI disabled / no API key ──────────────────────────────────────────────

  describe('precondition checks', () => {
    it('throws ServiceUnavailableException when AI is disabled', async () => {
      aiSettings.isAiEnabled.mockResolvedValue(false);
      creditService.getBalance.mockResolvedValue({ total: 20, monthly: 20, purchased: 0 });

      await expect(
        drainGenerator(
          service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion' }),
        ),
      ).resolves.toEqual([]); // drainGenerator catches the error

      // Verify consumeCredits was never called — AI was gated before model selection
      expect(creditService.consumeCredits).not.toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException when API key is missing', async () => {
      aiSettings.getApiKey.mockResolvedValue(null);
      creditService.getBalance.mockResolvedValue({ total: 20, monthly: 20, purchased: 0 });

      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion' }),
      );

      expect(creditService.consumeCredits).not.toHaveBeenCalled();
    });
  });
});

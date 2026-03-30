import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException, NotFoundException } from '@nestjs/common';
import { CharacterTalkService } from '../character-talk.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiSettingsService } from '../../ai-settings/ai-settings.service';
import { CreditService } from '../../billing/credit.service';
import { CharacterTalkRevenueService } from '../character-talk-revenue.service';
import { CharacterExtractionService } from '../character-extraction.service';

// ─── Constants (mirrors the service) ─────────────────────────────────────────

const HAIKU = 'claude-haiku-4-5-20251001';
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
        { provide: CharacterExtractionService, useValue: { triggerIfNeeded: jest.fn(), triggerWorkExtraction: jest.fn() } },
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

    it('does not call aiSettings.getModel when useSonnet is not set', async () => {
      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion' }),
      );

      expect(aiSettings.getModel).not.toHaveBeenCalled();
    });
  });

  // ─── Sonnet (useSonnet=true) ────────────────────────────────────────────────

  describe('when useSonnet=true', () => {
    it('selects Sonnet model and charges 3 credits', async () => {
      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion', useSonnet: true }),
      );

      expect(creditService.consumeCredits).toHaveBeenCalledWith(
        'user-1',
        2,
        'character_talk',
        SONNET,
      );
    });

    it('calls aiSettings.getModel to resolve the Sonnet model name', async () => {
      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion', useSonnet: true }),
      );

      expect(aiSettings.getModel).toHaveBeenCalledTimes(1);
    });

    it('uses the model name returned by aiSettings.getModel', async () => {
      aiSettings.getModel.mockResolvedValue('claude-sonnet-custom');

      await drainGenerator(
        service.streamChat('user-1', 'work-1', 'hello', { mode: 'companion', useSonnet: true }),
      );

      expect(creditService.consumeCredits).toHaveBeenCalledWith(
        'user-1',
        2,
        'character_talk',
        'claude-sonnet-custom',
      );
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

// ─── getAvailableCharacters ────────────────────────────────────────────────────

describe('CharacterTalkService - getAvailableCharacters', () => {
  let service: CharacterTalkService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let extraction: { triggerIfNeeded: jest.Mock; triggerWorkExtraction: jest.Mock };

  // ─── Shared test fixtures ────────────────────────────────────────────────

  const WORK_ID = 'work-abc';
  const USER_ID = 'user-xyz';

  /** A published episode with no AI data at all. */
  const makeEpisode = (
    id: string,
    orderIndex: number,
    overrides: {
      aiAnalysis?: { characters: any[] } | null;
      extractedCharacters?: any[] | null;
    } = {},
  ) => ({
    id,
    orderIndex,
    extractedCharacters: overrides.extractedCharacters ?? null,
    aiAnalysis: overrides.aiAnalysis !== undefined ? overrides.aiAnalysis : null,
  });

  /** A minimal work object with enableCharacterTalk = true by default. */
  const makeWork = (
    enabled: boolean,
    episodes: ReturnType<typeof makeEpisode>[],
  ) => ({
    enableCharacterTalk: enabled,
    episodes,
  });

  /** A StoryCharacter record. */
  const makeChar = (id: string, name: string) => ({
    id,
    name,
    role: '主要',
    personality: null,
    speechStyle: null,
  });

  beforeEach(async () => {
    prisma = mockPrismaService();
    extraction = { triggerIfNeeded: jest.fn(), triggerWorkExtraction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterTalkService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiSettingsService, useValue: mockAiSettingsService() },
        { provide: CreditService, useValue: mockCreditService() },
        { provide: CharacterTalkRevenueService, useValue: mockRevenueService() },
        { provide: CharacterExtractionService, useValue: extraction },
      ],
    }).compile();

    service = module.get<CharacterTalkService>(CharacterTalkService);
  });

  // ─── 1. Work not found ─────────────────────────────────────────────────────

  describe('when the work does not exist', () => {
    it('throws NotFoundException', async () => {
      prisma.work.findUnique.mockResolvedValue(null);
      prisma.storyCharacter.findMany.mockResolvedValue([]);

      await expect(
        service.getAvailableCharacters(USER_ID, WORK_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── 2. enableCharacterTalk = false ───────────────────────────────────────

  describe('when enableCharacterTalk is false', () => {
    it('returns an empty array immediately', async () => {
      prisma.work.findUnique.mockResolvedValue(makeWork(false, []));
      prisma.storyCharacter.findMany.mockResolvedValue([makeChar('c1', 'Alice')]);

      const result = await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(result).toEqual({ characters: [], status: 'disabled' });
    });

    it('does not query reading progress', async () => {
      prisma.work.findUnique.mockResolvedValue(makeWork(false, []));
      prisma.storyCharacter.findMany.mockResolvedValue([]);

      await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(prisma.readingProgress.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── 3. No reading progress ────────────────────────────────────────────────

  describe('when no reading progress exists for the user', () => {
    it('returns an empty array', async () => {
      const ep = makeEpisode('ep-1', 1, { aiAnalysis: { characters: [{ name: 'Alice' }] } });
      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep]));
      prisma.storyCharacter.findMany.mockResolvedValue([makeChar('c1', 'Alice')]);
      prisma.readingProgress.findMany.mockResolvedValue([]);

      const result = await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(result).toEqual({ characters: [], status: 'no_episode' });
    });

    it('does not trigger extraction', async () => {
      const ep = makeEpisode('ep-1', 1);
      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep]));
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.readingProgress.findMany.mockResolvedValue([]);

      await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(extraction.triggerIfNeeded).not.toHaveBeenCalled();
    });
  });

  // ─── 4. No extraction data → triggers batch extraction ────────────────────

  describe('when no aiAnalysis and no extractedCharacters exist', () => {
    it('returns an empty array', async () => {
      const ep = makeEpisode('ep-1', 1); // both null
      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep]));
      prisma.storyCharacter.findMany.mockResolvedValue([makeChar('c1', 'Alice')]);
      prisma.readingProgress.findMany.mockResolvedValue([{ episodeId: 'ep-1' }]);

      const result = await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(result).toEqual({ characters: [], status: 'extracting' });
    });

    it('calls triggerIfNeeded with the latest read episode id', async () => {
      const ep = makeEpisode('ep-1', 1);
      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep]));
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.readingProgress.findMany.mockResolvedValue([{ episodeId: 'ep-1' }]);

      await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(extraction.triggerIfNeeded).toHaveBeenCalledWith('ep-1');
    });

    it('calls triggerIfNeeded even when extractedCharacters is an empty array', async () => {
      const ep = makeEpisode('ep-1', 1, { extractedCharacters: [] });
      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep]));
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.readingProgress.findMany.mockResolvedValue([{ episodeId: 'ep-1' }]);

      await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(extraction.triggerIfNeeded).toHaveBeenCalledWith('ep-1');
    });
  });

  // ─── 5. Priority: extractedCharacters over aiAnalysis ──────────────────

  describe('when both extractedCharacters and aiAnalysis are present', () => {
    it('uses extractedCharacters (priority 1) over aiAnalysis', async () => {
      const ep = makeEpisode('ep-1', 1, {
        extractedCharacters: [{ name: 'Charlie' }],
        aiAnalysis: { characters: [{ name: 'Alice' }, { name: 'Bob' }] },
      });
      const alice = makeChar('c1', 'Alice');
      const charlie = makeChar('c2', 'Charlie');

      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep]));
      prisma.storyCharacter.findMany.mockResolvedValue([alice, charlie]);
      prisma.readingProgress.findMany.mockResolvedValue([{ episodeId: 'ep-1' }]);

      const result = await service.getAvailableCharacters(USER_ID, WORK_ID);

      // Charlie from extractedCharacters; Alice from aiAnalysis is ignored
      expect(result).toEqual({ characters: [charlie], status: 'ready' });
    });
  });

  describe('when only aiAnalysis is present (fallback)', () => {
    it('uses aiAnalysis and triggers extraction for future accuracy', async () => {
      const ep = makeEpisode('ep-1', 1, {
        aiAnalysis: { characters: [{ name: 'Alice' }] },
      });

      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep]));
      prisma.storyCharacter.findMany.mockResolvedValue([makeChar('c1', 'Alice')]);
      prisma.readingProgress.findMany.mockResolvedValue([{ episodeId: 'ep-1' }]);

      const result = await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(result).toEqual({ characters: [makeChar('c1', 'Alice')], status: 'ready' });
      expect(extraction.triggerIfNeeded).toHaveBeenCalledWith('ep-1');
    });
  });

  // ─── 6. Priority 2: extractedCharacters ───────────────────────────────────

  describe('when aiAnalysis is absent but extractedCharacters is present', () => {
    it('returns matched StoryCharacters from extractedCharacters (priority 2)', async () => {
      const ep = makeEpisode('ep-1', 1, {
        aiAnalysis: null,
        extractedCharacters: [{ name: 'Bob' }],
      });
      const bob = makeChar('c1', 'Bob');
      const alice = makeChar('c2', 'Alice');

      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep]));
      prisma.storyCharacter.findMany.mockResolvedValue([bob, alice]);
      prisma.readingProgress.findMany.mockResolvedValue([{ episodeId: 'ep-1' }]);

      const result = await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(result).toEqual({ characters: [bob], status: 'ready' });
    });

    it('does not call triggerIfNeeded when extractedCharacters has data', async () => {
      const ep = makeEpisode('ep-1', 1, {
        aiAnalysis: null,
        extractedCharacters: [{ name: 'Bob' }],
      });

      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep]));
      prisma.storyCharacter.findMany.mockResolvedValue([makeChar('c1', 'Bob')]);
      prisma.readingProgress.findMany.mockResolvedValue([{ episodeId: 'ep-1' }]);

      await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(extraction.triggerIfNeeded).not.toHaveBeenCalled();
    });
  });

  // ─── 7. Only the most recently read episode is used ───────────────────────

  describe('most recently read episode selection', () => {
    it('uses the episode with the highest orderIndex among read episodes', async () => {
      // ep-2 is read and has a higher orderIndex than ep-1
      const ep1 = makeEpisode('ep-1', 1, {
        aiAnalysis: { characters: [{ name: 'Alice' }] },
      });
      const ep2 = makeEpisode('ep-2', 2, {
        aiAnalysis: { characters: [{ name: 'Bob' }] },
      });
      const alice = makeChar('c1', 'Alice');
      const bob = makeChar('c2', 'Bob');

      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep1, ep2]));
      prisma.storyCharacter.findMany.mockResolvedValue([alice, bob]);
      // User has read both episodes — latest (ep-2) should win
      prisma.readingProgress.findMany.mockResolvedValue([
        { episodeId: 'ep-1' },
        { episodeId: 'ep-2' },
      ]);

      const result = await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(result.characters).toEqual([bob]);
      expect(result.characters).not.toContainEqual(alice);
    });

    it('ignores episodes that the user has not read', async () => {
      // Only ep-1 read; ep-2 has richer data but should not be used
      const ep1 = makeEpisode('ep-1', 1, {
        aiAnalysis: { characters: [{ name: 'Alice' }] },
      });
      const ep2 = makeEpisode('ep-2', 2, {
        aiAnalysis: { characters: [{ name: 'Bob' }] },
      });
      const alice = makeChar('c1', 'Alice');
      const bob = makeChar('c2', 'Bob');

      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep1, ep2]));
      prisma.storyCharacter.findMany.mockResolvedValue([alice, bob]);
      prisma.readingProgress.findMany.mockResolvedValue([{ episodeId: 'ep-1' }]);

      const result = await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(result.characters).toEqual([alice]);
    });
  });

  // ─── 8. Fuzzy matching ────────────────────────────────────────────────────

  describe('matchStoryCharacters fuzzy logic', () => {
    it('matches by exact name equality', async () => {
      const ep = makeEpisode('ep-1', 1, {
        aiAnalysis: { characters: [{ name: 'Alice' }] },
      });
      const alice = makeChar('c1', 'Alice');

      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep]));
      prisma.storyCharacter.findMany.mockResolvedValue([alice]);
      prisma.readingProgress.findMany.mockResolvedValue([{ episodeId: 'ep-1' }]);

      const result = await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(result.characters).toContainEqual(alice);
    });

    it('matches when StoryCharacter name contains the extracted name (c.name.includes(name))', async () => {
      // StoryCharacter full name = "Alice Smith", extracted = "Alice"
      const ep = makeEpisode('ep-1', 1, {
        aiAnalysis: { characters: [{ name: 'Alice' }] },
      });
      const aliceSmith = makeChar('c1', 'Alice Smith');

      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep]));
      prisma.storyCharacter.findMany.mockResolvedValue([aliceSmith]);
      prisma.readingProgress.findMany.mockResolvedValue([{ episodeId: 'ep-1' }]);

      const result = await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(result.characters).toContainEqual(aliceSmith);
    });

    it('matches when extracted name contains the StoryCharacter name (name.includes(c.name))', async () => {
      // StoryCharacter name = "Alice", extracted = "Alice Smith"
      const ep = makeEpisode('ep-1', 1, {
        aiAnalysis: { characters: [{ name: 'Alice Smith' }] },
      });
      const alice = makeChar('c1', 'Alice');

      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep]));
      prisma.storyCharacter.findMany.mockResolvedValue([alice]);
      prisma.readingProgress.findMany.mockResolvedValue([{ episodeId: 'ep-1' }]);

      const result = await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(result.characters).toContainEqual(alice);
    });

    it('does not match when names share no substring relationship', async () => {
      const ep = makeEpisode('ep-1', 1, {
        aiAnalysis: { characters: [{ name: 'Bob' }] },
      });
      const alice = makeChar('c1', 'Alice');

      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep]));
      prisma.storyCharacter.findMany.mockResolvedValue([alice]);
      prisma.readingProgress.findMany.mockResolvedValue([{ episodeId: 'ep-1' }]);

      const result = await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(result.characters).toEqual([]);
    });

    it('excludes StoryCharacters whose name is not referenced by any extracted name', async () => {
      const ep = makeEpisode('ep-1', 1, {
        aiAnalysis: { characters: [{ name: 'Alice' }] },
      });
      const alice = makeChar('c1', 'Alice');
      const charlie = makeChar('c2', 'Charlie');

      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep]));
      prisma.storyCharacter.findMany.mockResolvedValue([alice, charlie]);
      prisma.readingProgress.findMany.mockResolvedValue([{ episodeId: 'ep-1' }]);

      const result = await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(result.characters).toContainEqual(alice);
      expect(result.characters).not.toContainEqual(charlie);
    });

    it('ignores extracted character entries that have no name field', async () => {
      const ep = makeEpisode('ep-1', 1, {
        aiAnalysis: { characters: [{ name: null }, { description: 'unnamed' }] },
      });
      const alice = makeChar('c1', 'Alice');

      prisma.work.findUnique.mockResolvedValue(makeWork(true, [ep]));
      prisma.storyCharacter.findMany.mockResolvedValue([alice]);
      prisma.readingProgress.findMany.mockResolvedValue([{ episodeId: 'ep-1' }]);

      const result = await service.getAvailableCharacters(USER_ID, WORK_ID);

      expect(result.characters).toEqual([]);
    });
  });
});

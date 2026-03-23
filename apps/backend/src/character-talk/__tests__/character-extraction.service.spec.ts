import { Test, TestingModule } from '@nestjs/testing';
import { CharacterExtractionService } from '../character-extraction.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiSettingsService } from '../../ai-settings/ai-settings.service';
import { Prisma } from '@prisma/client';

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockPrismaService = () => ({
  episode: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
});

const mockAiSettingsService = () => ({
  getApiKey: jest.fn().mockResolvedValue('test-api-key'),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Flush all pending microtasks and macrotasks so that fire-and-forget async
 * chains initiated by triggerIfNeeded / triggerWorkExtraction fully complete.
 *
 * A single setImmediate tick is not enough for deeply-nested async chains
 * (e.g. triggerWorkExtraction -> extractWork -> N * extractIfNeeded -> callHaiku).
 * We drain the queue multiple times to let every await boundary settle.
 */
async function flushPromises(rounds = 20): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

/** Build a minimal published episode fixture. */
function makeEpisode(overrides: Partial<{
  id: string;
  title: string;
  content: string;
  extractedCharacters: unknown;
  publishedAt: Date | null;
}> = {}) {
  return {
    id: 'ep-1',
    title: 'Test Episode',
    content: 'A'.repeat(100), // 100 chars — above the 50-char threshold
    extractedCharacters: null,
    publishedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

/** Build a minimal Anthropic API success response. */
function makeAnthropicResponse(text: string) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({
      content: [{ text }],
    }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CharacterExtractionService', () => {
  let service: CharacterExtractionService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let aiSettings: ReturnType<typeof mockAiSettingsService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    aiSettings = mockAiSettingsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterExtractionService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiSettingsService, useValue: aiSettings },
      ],
    }).compile();

    service = module.get<CharacterExtractionService>(CharacterExtractionService);

    // Mock global fetch by default (success path)
    global.fetch = jest.fn().mockResolvedValue(
      makeAnthropicResponse('[{"name":"Alice","role":"主人公"}]'),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── triggerIfNeeded ───────────────────────────────────────────────────────

  describe('triggerIfNeeded', () => {
    it('skips if already in flight for that episodeId', async () => {
      // The inFlight set is populated AFTER findUnique resolves, inside extractIfNeeded.
      // To test the guard, we let findUnique resolve immediately but make the fetch
      // hang so the episode stays in-flight (inFlight.add fires, inFlight.delete hasn't yet).
      prisma.episode.findUnique.mockResolvedValue(makeEpisode());

      let resolveFetch!: (value: ReturnType<typeof makeAnthropicResponse>) => void;
      const hangingFetch = new Promise<ReturnType<typeof makeAnthropicResponse>>(
        (resolve) => { resolveFetch = resolve; },
      );
      global.fetch = jest.fn().mockReturnValue(hangingFetch);

      // First trigger — findUnique resolves quickly, then hangs on fetch
      service.triggerIfNeeded('ep-1');
      // Flush so extractIfNeeded runs up to inFlight.add (which is before the fetch await)
      await flushPromises();

      // At this point inFlight has 'ep-1'. Second trigger should be skipped.
      service.triggerIfNeeded('ep-1');
      // Resolve the hanging fetch so the first extraction can complete
      resolveFetch(makeAnthropicResponse('[{"name":"Alice","role":"主人公"}]'));
      prisma.episode.update.mockResolvedValue({});
      await flushPromises();

      // fetch should have been called only once (the second trigger was a no-op)
      expect(global.fetch).toHaveBeenCalledTimes(1);
      // findUnique was also only called once
      expect(prisma.episode.findUnique).toHaveBeenCalledTimes(1);
    });

    it('skips if extractedCharacters already exists on the episode', async () => {
      prisma.episode.findUnique.mockResolvedValue(
        makeEpisode({ extractedCharacters: [{ name: 'Bob', role: '脇役' }] }),
      );

      service.triggerIfNeeded('ep-1');
      await flushPromises();

      expect(prisma.episode.update).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('skips if episode is unpublished (publishedAt is null)', async () => {
      prisma.episode.findUnique.mockResolvedValue(
        makeEpisode({ publishedAt: null }),
      );

      service.triggerIfNeeded('ep-1');
      await flushPromises();

      expect(prisma.episode.update).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('skips if episode content is shorter than 50 characters', async () => {
      prisma.episode.findUnique.mockResolvedValue(
        makeEpisode({ content: 'Short' }), // only 5 chars
      );

      service.triggerIfNeeded('ep-1');
      await flushPromises();

      expect(prisma.episode.update).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('skips if episode content is exactly 49 characters (boundary: < 50)', async () => {
      prisma.episode.findUnique.mockResolvedValue(
        makeEpisode({ content: 'A'.repeat(49) }),
      );

      service.triggerIfNeeded('ep-1');
      await flushPromises();

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('calls Haiku API and saves extracted characters to the database', async () => {
      const episode = makeEpisode();
      prisma.episode.findUnique.mockResolvedValue(episode);
      prisma.episode.update.mockResolvedValue({ ...episode, extractedCharacters: [] });

      const expectedCharacters = [
        { name: 'Alice', role: '主人公' },
        { name: 'Bob', role: '脇役' },
      ];
      global.fetch = jest.fn().mockResolvedValue(
        makeAnthropicResponse(JSON.stringify(expectedCharacters)),
      );

      service.triggerIfNeeded('ep-1');
      await flushPromises();

      // Verify fetch was called with the Anthropic endpoint
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
            'anthropic-version': '2023-06-01',
          }),
        }),
      );

      // Verify the parsed characters were saved
      expect(prisma.episode.update).toHaveBeenCalledWith({
        where: { id: 'ep-1' },
        data: { extractedCharacters: expectedCharacters },
      });
    });

    it('handles API error gracefully without crashing', async () => {
      prisma.episode.findUnique.mockResolvedValue(makeEpisode());
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      // Must not throw
      expect(() => service.triggerIfNeeded('ep-1')).not.toThrow();
      await flushPromises();

      // DB should not have been updated when the API failed
      expect(prisma.episode.update).not.toHaveBeenCalled();
    });

    it('removes episodeId from inFlight after successful extraction', async () => {
      prisma.episode.findUnique.mockResolvedValue(makeEpisode());
      prisma.episode.update.mockResolvedValue({});

      service.triggerIfNeeded('ep-1');
      await flushPromises();

      // After completion, a second triggerIfNeeded should proceed to findUnique again
      prisma.episode.findUnique.mockResolvedValue(
        makeEpisode({ extractedCharacters: [{ name: 'Alice', role: '主人公' }] }),
      );
      service.triggerIfNeeded('ep-1');
      await flushPromises();

      // findUnique should have been called twice (once per trigger)
      expect(prisma.episode.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  // ─── triggerWorkExtraction ─────────────────────────────────────────────────

  describe('triggerWorkExtraction', () => {
    it('skips if already in flight for that workId', async () => {
      // Make findMany hang so the first call stays in-flight
      let resolveFindMany!: (value: { id: string }[]) => void;
      const hangingPromise = new Promise<{ id: string }[]>(
        (resolve) => { resolveFindMany = resolve; },
      );
      prisma.episode.findMany.mockReturnValue(hangingPromise);

      // First trigger — stays in-flight while findMany hangs
      service.triggerWorkExtraction('work-1');
      await flushPromises();

      // Second trigger — should be ignored
      service.triggerWorkExtraction('work-1');

      resolveFindMany([]);
      await flushPromises();

      expect(prisma.episode.findMany).toHaveBeenCalledTimes(1);
    });

    it('processes all unextracted published episodes sequentially', async () => {
      const episodes = [
        { id: 'ep-1' },
        { id: 'ep-2' },
        { id: 'ep-3' },
      ];
      prisma.episode.findMany.mockResolvedValue(episodes);

      // Each episode findUnique returns a full extractable episode
      prisma.episode.findUnique
        .mockResolvedValueOnce(makeEpisode({ id: 'ep-1' }))
        .mockResolvedValueOnce(makeEpisode({ id: 'ep-2' }))
        .mockResolvedValueOnce(makeEpisode({ id: 'ep-3' }));

      prisma.episode.update.mockResolvedValue({});

      service.triggerWorkExtraction('work-1');
      await flushPromises();

      // findMany was queried with the correct work filter
      expect(prisma.episode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workId: 'work-1' }),
        }),
      );

      // All three episodes were individually looked up
      expect(prisma.episode.findUnique).toHaveBeenCalledTimes(3);

      // All three episodes were updated
      expect(prisma.episode.update).toHaveBeenCalledTimes(3);
    });

    it('queries only published episodes with no extracted characters', async () => {
      prisma.episode.findMany.mockResolvedValue([]);

      service.triggerWorkExtraction('work-1');
      await flushPromises();

      expect(prisma.episode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workId: 'work-1',
            publishedAt: { not: null },
            extractedCharacters: { equals: Prisma.DbNull },
          },
        }),
      );
    });

    it('removes workId from inFlight after all episodes are processed', async () => {
      prisma.episode.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      service.triggerWorkExtraction('work-1');
      await flushPromises();

      // After first run completes, a second call should be accepted
      service.triggerWorkExtraction('work-1');
      await flushPromises();

      expect(prisma.episode.findMany).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Haiku response parsing (via triggerIfNeeded) ─────────────────────────

  describe('Haiku response parsing', () => {
    beforeEach(() => {
      prisma.episode.findUnique.mockResolvedValue(makeEpisode());
      prisma.episode.update.mockResolvedValue({});
    });

    it('parses a valid JSON array from the response', async () => {
      const characters = [
        { name: 'Alice', role: '主人公' },
        { name: 'Bob', role: '敵' },
      ];
      global.fetch = jest.fn().mockResolvedValue(
        makeAnthropicResponse(JSON.stringify(characters)),
      );

      service.triggerIfNeeded('ep-1');
      await flushPromises();

      expect(prisma.episode.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { extractedCharacters: characters },
        }),
      );
    });

    it('does not save when response contains no JSON array', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        makeAnthropicResponse('I cannot extract characters from this text.'),
      );

      service.triggerIfNeeded('ep-1');
      await flushPromises();

      expect(prisma.episode.update).not.toHaveBeenCalled();
    });

    it('does not save when response JSON is malformed', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        makeAnthropicResponse('[{name: "Alice", role: }]'), // invalid JSON
      );

      service.triggerIfNeeded('ep-1');
      await flushPromises();

      expect(prisma.episode.update).not.toHaveBeenCalled();
    });

    it('does not save when response JSON is not an array', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        makeAnthropicResponse('{"name":"Alice","role":"主人公"}'), // object, not array
      );

      service.triggerIfNeeded('ep-1');
      await flushPromises();

      expect(prisma.episode.update).not.toHaveBeenCalled();
    });

    it('filters out entries missing the name property', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        makeAnthropicResponse('[{"role":"主人公"},{"name":"Bob","role":"脇役"}]'),
      );

      service.triggerIfNeeded('ep-1');
      await flushPromises();

      expect(prisma.episode.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { extractedCharacters: [{ name: 'Bob', role: '脇役' }] },
        }),
      );
    });

    it('trims whitespace from name and role fields', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        makeAnthropicResponse('[{"name":"  Alice  ","role":"  主人公  "}]'),
      );

      service.triggerIfNeeded('ep-1');
      await flushPromises();

      expect(prisma.episode.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { extractedCharacters: [{ name: 'Alice', role: '主人公' }] },
        }),
      );
    });

    it('defaults role to "不明" when role field is absent', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        makeAnthropicResponse('[{"name":"Alice"}]'),
      );

      service.triggerIfNeeded('ep-1');
      await flushPromises();

      expect(prisma.episode.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { extractedCharacters: [{ name: 'Alice', role: '不明' }] },
        }),
      );
    });

    it('truncates content longer than 8000 characters before sending to API', async () => {
      const longContent = 'A'.repeat(9000);
      prisma.episode.findUnique.mockResolvedValue(
        makeEpisode({ content: longContent }),
      );

      service.triggerIfNeeded('ep-1');
      await flushPromises();

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const userMessage = body.messages[0].content as string;

      // Should contain only the first 8000 chars plus the truncation marker
      expect(userMessage).toContain('A'.repeat(8000));
      expect(userMessage).toContain('...(以下省略)');
      // The full 9000-char string should NOT be present
      expect(userMessage.length).toBeLessThan(9000 + 500); // some overhead for title etc.
    });
  });

  // ─── No API key available ─────────────────────────────────────────────────

  describe('when no API key is available', () => {
    beforeEach(() => {
      aiSettings.getApiKey.mockResolvedValue(null);
      prisma.episode.findUnique.mockResolvedValue(makeEpisode());
      prisma.episode.update.mockResolvedValue({});
    });

    it('does not call the Anthropic API', async () => {
      service.triggerIfNeeded('ep-1');
      await flushPromises();

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not update the episode in the database', async () => {
      service.triggerIfNeeded('ep-1');
      await flushPromises();

      expect(prisma.episode.update).not.toHaveBeenCalled();
    });

    it('does not throw or crash the caller', async () => {
      expect(() => service.triggerIfNeeded('ep-1')).not.toThrow();
      await flushPromises();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { EpisodeAnalysisService } from './episode-analysis.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockPrismaService = () => ({
  episode: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  episodeAnalysis: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  foreshadowing: {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
  },
  worldSetting: {
    upsert: jest.fn(),
  },
  characterDialogueSample: {
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
  storyCharacter: {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
  },
});

const mockAiSettingsService = () => ({
  getApiKey: jest.fn(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid AnalysisResult JSON as a string */
const makeAnalysisJson = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    summary: 'テスト要約です。このエピソードでは主人公が旅立ちます。',
    endState: '主人公は出発した',
    narrativePOV: '三人称限定',
    emotionalArc: '期待→不安→決意',
    timelineStart: '翌朝',
    timelineEnd: '日暮れ',
    locations: [{ name: '王都', description: '賑やかな城下町' }],
    characters: [
      { name: '勇者', role: '主人公', action: '出発', currentState: '旅の途中' },
    ],
    foreshadowings: [],
    dialogueSamples: [],
    newWorldRules: [],
    ...overrides,
  });

/** Build a mock fetch response */
const mockFetchOk = (text: string) =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({ content: [{ type: 'text', text }] }),
    text: () => Promise.resolve(text),
  } as unknown as Response);

const mockFetchError = (status: number, body = 'Bad Request') =>
  Promise.resolve({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  } as unknown as Response);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EpisodeAnalysisService', () => {
  let service: EpisodeAnalysisService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let aiSettings: ReturnType<typeof mockAiSettingsService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    aiSettings = mockAiSettingsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EpisodeAnalysisService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiSettingsService, useValue: aiSettings },
      ],
    }).compile();

    service = module.get<EpisodeAnalysisService>(EpisodeAnalysisService);

    // Silence logger output during tests
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'debug').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

    // Reset global fetch mock between tests
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // needsAnalysis
  // =========================================================================

  describe('needsAnalysis', () => {
    it('returns true when no analysis exists', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
      });

      const result = await service.needsAnalysis('ep-1');

      expect(result).toBe(true);
    });

    it('returns false when analysis version matches contentVersion', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 3,
        aiAnalysis: { version: 3 },
      });

      const result = await service.needsAnalysis('ep-1');

      expect(result).toBe(false);
    });

    it('returns true when analysis version mismatches contentVersion', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 5,
        aiAnalysis: { version: 3 },
      });

      const result = await service.needsAnalysis('ep-1');

      expect(result).toBe(true);
    });

    it('returns false when episode is not found', async () => {
      prisma.episode.findUnique.mockResolvedValue(null);

      const result = await service.needsAnalysis('nonexistent');

      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // analyzeEpisode
  // =========================================================================

  describe('analyzeEpisode', () => {
    it('skips when episode is not found', async () => {
      prisma.episode.findUnique.mockResolvedValue(null);

      await service.analyzeEpisode('work-1', 'ep-missing');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(prisma.episodeAnalysis.upsert).not.toHaveBeenCalled();
    });

    it('skips when analysis is up to date (version matches)', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 2,
        aiAnalysis: { version: 2 },
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });

      await service.analyzeEpisode('work-1', 'ep-1');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(prisma.episodeAnalysis.upsert).not.toHaveBeenCalled();
    });

    it('skips when API key is not configured', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 2,
        aiAnalysis: { version: 1 },
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue(null);

      await service.analyzeEpisode('work-1', 'ep-1');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(prisma.episodeAnalysis.upsert).not.toHaveBeenCalled();
    });

    it('calls Claude API and saves analysis when episode needs re-analysis', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 2,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文テキスト',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk(makeAnalysisJson()),
      );
      prisma.episodeAnalysis.upsert.mockResolvedValue({});

      await service.analyzeEpisode('work-1', 'ep-1');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'x-api-key': 'sk-test-key' }),
        }),
      );
      expect(prisma.episodeAnalysis.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { episodeId: 'ep-1' },
          create: expect.objectContaining({ episodeId: 'ep-1', workId: 'work-1' }),
        }),
      );
    });

    it('handles API error gracefully without throwing', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(500, 'Internal Server Error'),
      );

      // Should not throw
      await expect(service.analyzeEpisode('work-1', 'ep-1')).resolves.toBeUndefined();
      expect(prisma.episodeAnalysis.upsert).not.toHaveBeenCalled();
    });

    it('handles network fetch rejection gracefully without throwing', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(service.analyzeEpisode('work-1', 'ep-1')).resolves.toBeUndefined();
    });

    it('creates Foreshadowing entry for "plant" type foreshadowing', async () => {
      const foreshadowing = { description: '謎の手紙の伏線', type: 'plant' };
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk(makeAnalysisJson({ foreshadowings: [foreshadowing] })),
      );
      prisma.episodeAnalysis.upsert.mockResolvedValue({});
      prisma.foreshadowing.findFirst.mockResolvedValue(null); // no existing

      await service.analyzeEpisode('work-1', 'ep-1');

      expect(prisma.foreshadowing.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workId: 'work-1',
          description: '謎の手紙の伏線',
          status: 'open',
          plantedIn: 0,
        }),
      });
    });

    it('does not duplicate existing "plant" foreshadowing', async () => {
      const foreshadowing = { description: '謎の手紙の伏線', type: 'plant' };
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk(makeAnalysisJson({ foreshadowings: [foreshadowing] })),
      );
      prisma.episodeAnalysis.upsert.mockResolvedValue({});
      prisma.foreshadowing.findFirst.mockResolvedValue({ id: 'f-existing' }); // already exists

      await service.analyzeEpisode('work-1', 'ep-1');

      expect(prisma.foreshadowing.create).not.toHaveBeenCalled();
    });

    it('resolves existing Foreshadowing for "resolve" type', async () => {
      const foreshadowing = { description: '謎の手紙の伏線が回収された', type: 'resolve' };
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-2',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 1,
        title: '第2話',
        content: '本文2',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk(makeAnalysisJson({ foreshadowings: [foreshadowing] })),
      );
      prisma.episodeAnalysis.upsert.mockResolvedValue({});
      prisma.foreshadowing.findFirst.mockResolvedValue({ id: 'f-open-1', status: 'open' });
      prisma.foreshadowing.findMany.mockResolvedValue([
        { id: 'f-open-1', description: '謎の手紙の伏線が回収された', status: 'open', plantedIn: 0 },
      ]);
      prisma.foreshadowing.update.mockResolvedValue({});

      await service.analyzeEpisode('work-1', 'ep-2');

      expect(prisma.foreshadowing.update).toHaveBeenCalledWith({
        where: { id: 'f-open-1' },
        data: { resolvedIn: 1, status: 'resolved' },
      });
    });

    it('saves WorldSetting entries via upsert', async () => {
      const newWorldRules = [
        { category: 'magic', name: '魔法陣', description: '魔力を増幅させる陣' },
      ];
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk(makeAnalysisJson({ newWorldRules })),
      );
      prisma.episodeAnalysis.upsert.mockResolvedValue({});
      prisma.worldSetting.upsert.mockResolvedValue({});

      await service.analyzeEpisode('work-1', 'ep-1');

      expect(prisma.worldSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workId_category_name: {
              workId: 'work-1',
              category: 'magic',
              name: '魔法陣',
            },
          },
          create: expect.objectContaining({
            workId: 'work-1',
            category: 'magic',
            name: '魔法陣',
            description: '魔力を増幅させる陣',
          }),
        }),
      );
    });

    it('saves CharacterDialogueSample entries', async () => {
      const dialogueSamples = [
        { character: '勇者', line: '行くぞ！', context: '出発前', emotion: '決意' },
      ];
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk(makeAnalysisJson({ dialogueSamples })),
      );
      prisma.episodeAnalysis.upsert.mockResolvedValue({});
      prisma.characterDialogueSample.deleteMany.mockResolvedValue({ count: 0 });
      prisma.storyCharacter.findFirst.mockResolvedValue({ id: 'char-1', name: '勇者' });
      prisma.characterDialogueSample.create.mockResolvedValue({});

      await service.analyzeEpisode('work-1', 'ep-1');

      expect(prisma.characterDialogueSample.deleteMany).toHaveBeenCalledWith({
        where: { workId: 'work-1', episodeOrder: 0 },
      });
      expect(prisma.characterDialogueSample.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workId: 'work-1',
          characterId: 'char-1',
          characterName: '勇者',
          line: '行くぞ！',
          episodeOrder: 0,
        }),
      });
    });

    it('saves CharacterDialogueSample with null characterId when character not found', async () => {
      const dialogueSamples = [
        { character: '謎の人物', line: '待て…', context: '追跡中', emotion: '焦り' },
      ];
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk(makeAnalysisJson({ dialogueSamples })),
      );
      prisma.episodeAnalysis.upsert.mockResolvedValue({});
      prisma.characterDialogueSample.deleteMany.mockResolvedValue({ count: 0 });
      prisma.storyCharacter.findFirst.mockResolvedValue(null); // character not found
      prisma.characterDialogueSample.create.mockResolvedValue({});

      await service.analyzeEpisode('work-1', 'ep-1');

      expect(prisma.characterDialogueSample.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ characterId: null }),
      });
    });

    it('updates StoryCharacter.currentState from analysis', async () => {
      const characters = [
        { name: '勇者', role: '主人公', action: '出発', currentState: '旅の途中' },
      ];
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk(makeAnalysisJson({ characters })),
      );
      prisma.episodeAnalysis.upsert.mockResolvedValue({});
      prisma.storyCharacter.findFirst.mockResolvedValue({ id: 'char-1', name: '勇者' });
      prisma.storyCharacter.update.mockResolvedValue({});

      await service.analyzeEpisode('work-1', 'ep-1');

      expect(prisma.storyCharacter.update).toHaveBeenCalledWith({
        where: { id: 'char-1' },
        data: { currentState: '旅の途中' },
      });
    });

    it('skips StoryCharacter update when character not found in DB', async () => {
      const characters = [
        { name: 'モブキャラ', role: '脇役', action: '通過', currentState: '不明' },
      ];
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk(makeAnalysisJson({ characters })),
      );
      prisma.episodeAnalysis.upsert.mockResolvedValue({});
      prisma.storyCharacter.findFirst.mockResolvedValue(null);

      await service.analyzeEpisode('work-1', 'ep-1');

      expect(prisma.storyCharacter.update).not.toHaveBeenCalled();
    });

    it('skips StoryCharacter update when currentState is empty', async () => {
      const characters = [
        { name: '勇者', role: '主人公', action: '出発', currentState: '' },
      ];
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk(makeAnalysisJson({ characters })),
      );
      prisma.episodeAnalysis.upsert.mockResolvedValue({});

      await service.analyzeEpisode('work-1', 'ep-1');

      expect(prisma.storyCharacter.update).not.toHaveBeenCalled();
    });

    it('handles invalid JSON from Claude API gracefully without throwing', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      // Claude returns non-JSON text (no braces at all)
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk('申し訳ありませんが、要約できませんでした。'),
      );

      await expect(service.analyzeEpisode('work-1', 'ep-1')).resolves.toBeUndefined();
      expect(prisma.episodeAnalysis.upsert).not.toHaveBeenCalled();
    });

    it('handles malformed JSON with braces but invalid syntax gracefully', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      // Claude returns something with braces but invalid JSON
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk('{ summary: "不正なJSON", missing_quotes: true, }'),
      );

      await expect(service.analyzeEpisode('work-1', 'ep-1')).resolves.toBeUndefined();
      expect(prisma.episodeAnalysis.upsert).not.toHaveBeenCalled();
    });

    it('saves analysis with null/undefined optional fields defaulting to null/[]', async () => {
      // Test the || null and || [] falsy branches in upsert create/update
      const minimalAnalysis = JSON.stringify({
        summary: '最小限の要約',
        // all optional fields missing
      });
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk(minimalAnalysis),
      );
      prisma.episodeAnalysis.upsert.mockResolvedValue({});

      await service.analyzeEpisode('work-1', 'ep-1');

      expect(prisma.episodeAnalysis.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            endState: null,
            narrativePOV: null,
            locations: [],
            characters: [],
            foreshadowings: [],
            dialogueSamples: [],
            newWorldRules: [],
          }),
        }),
      );
    });

    it('skips previous context when previous episode has no aiAnalysis', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-2',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 1,
        title: '第2話',
        content: '本文2',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      // Previous episode exists but has NO aiAnalysis
      prisma.episode.findFirst.mockResolvedValue({
        id: 'ep-1',
        orderIndex: 0,
        aiAnalysis: null,
      });
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk(makeAnalysisJson()),
      );
      prisma.episodeAnalysis.upsert.mockResolvedValue({});

      await service.analyzeEpisode('work-1', 'ep-2');

      // Should still call fetch but without previous context
      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.messages[0].content).not.toContain('前回のエピソードの要約');
    });

    it('handles non-Error thrown in try/catch gracefully', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      // Throw a non-Error value (string) to cover `error instanceof Error` = false branch
      (global.fetch as jest.Mock).mockRejectedValue('string error not an Error object');

      await expect(service.analyzeEpisode('work-1', 'ep-1')).resolves.toBeUndefined();
    });

    it('uses （なし） fallback when previous episode endState is null', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-2',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 1,
        title: '第2話',
        content: '本文2',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      prisma.episode.findFirst.mockResolvedValue({
        id: 'ep-1',
        orderIndex: 0,
        aiAnalysis: { summary: '前回の要約', endState: null }, // null endState → （なし）
      });
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk(makeAnalysisJson()),
      );
      prisma.episodeAnalysis.upsert.mockResolvedValue({});

      await service.analyzeEpisode('work-1', 'ep-2');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.messages[0].content).toContain('（なし）');
    });

    it('handles empty content array in Claude API response gracefully', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 0,
        title: 'テスト話',
        content: '本文',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      // Return response with no content array
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ content: [] }), // empty content
          text: () => Promise.resolve(''),
        } as unknown as Response),
      );

      await expect(service.analyzeEpisode('work-1', 'ep-1')).resolves.toBeUndefined();
      // parseAnalysisJson('') returns null, so upsert should not be called
      expect(prisma.episodeAnalysis.upsert).not.toHaveBeenCalled();
    });

    it('includes previous episode context when orderIndex > 0', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-2',
        contentVersion: 1,
        aiAnalysis: null,
        orderIndex: 1,
        title: '第2話',
        content: '本文2',
      });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      prisma.episode.findFirst.mockResolvedValue({
        id: 'ep-1',
        orderIndex: 0,
        aiAnalysis: { summary: '前回の要約', endState: '前回の終了状態' },
      });
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk(makeAnalysisJson()),
      );
      prisma.episodeAnalysis.upsert.mockResolvedValue({});

      await service.analyzeEpisode('work-1', 'ep-2');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.messages[0].content).toContain('前回の要約');
    });
  });

  // =========================================================================
  // analyzeAllEpisodes
  // =========================================================================

  describe('analyzeAllEpisodes', () => {
    it('returns { analyzed: 0, skipped: 0 } when no episodes exist', async () => {
      prisma.episode.findMany.mockResolvedValue([]);

      const result = await service.analyzeAllEpisodes('work-1');

      expect(result).toEqual({ analyzed: 0, skipped: 0 });
    });

    it('processes all episodes and returns correct analyzed/skipped counts', async () => {
      // analyzeAllEpisodes flow:
      //   for each ep, call needsAnalysis(ep.id) → episode.findUnique (call A)
      //   if needs: call analyzeEpisode(workId, ep.id) → episode.findUnique again (call B)
      //
      // ep-1 (orderIndex=0): needsAnalysis→findUnique(A), analyzeEpisode→findUnique(B)
      //   analyzeEpisode: orderIndex===0, skip findFirst
      // ep-2 (orderIndex=1): needsAnalysis→findUnique(A) → skipped, no analyzeEpisode
      // ep-3 (orderIndex=2): needsAnalysis→findUnique(A), analyzeEpisode→findUnique(B)
      //   analyzeEpisode: orderIndex>0 → findFirst for previous episode

      const ep1 = { id: 'ep-1', contentVersion: 1, aiAnalysis: null, orderIndex: 0, title: '話1', content: '内容1' };
      const ep2 = { id: 'ep-2', contentVersion: 3, aiAnalysis: { version: 3 }, orderIndex: 1, title: '話2', content: '内容2' };
      const ep3 = { id: 'ep-3', contentVersion: 5, aiAnalysis: { version: 2 }, orderIndex: 2, title: '話3', content: '内容3' };

      prisma.episode.findMany.mockResolvedValue([
        { id: 'ep-1' },
        { id: 'ep-2' },
        { id: 'ep-3' },
      ]);

      // Sequence: needsAnalysis(ep-1), analyzeEpisode(ep-1),
      //           needsAnalysis(ep-2),
      //           needsAnalysis(ep-3), analyzeEpisode(ep-3)
      prisma.episode.findUnique
        .mockResolvedValueOnce(ep1)  // needsAnalysis ep-1 → needs analysis
        .mockResolvedValueOnce(ep1)  // analyzeEpisode ep-1 → proceed
        .mockResolvedValueOnce(ep2)  // needsAnalysis ep-2 → up to date, skip
        .mockResolvedValueOnce(ep3)  // needsAnalysis ep-3 → needs analysis
        .mockResolvedValueOnce(ep3); // analyzeEpisode ep-3 → proceed

      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      // ep-3 has orderIndex=2, so analyzeEpisode will call findFirst for prev episode
      prisma.episode.findFirst.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchOk(makeAnalysisJson()),
      );
      prisma.episodeAnalysis.upsert.mockResolvedValue({});

      const result = await service.analyzeAllEpisodes('work-1');

      expect(result).toEqual({ analyzed: 2, skipped: 1 });
    });

    it('counts as analyzed even when analyzeEpisode encounters an API error', async () => {
      // analyzeAllEpisodes increments analyzed regardless of internal errors
      // because needsAnalysis returned true (it tried to analyze)
      prisma.episode.findMany.mockResolvedValue([{ id: 'ep-1' }]);
      prisma.episode.findUnique
        .mockResolvedValueOnce({
          id: 'ep-1', contentVersion: 1, aiAnalysis: null,
          orderIndex: 0, title: '話1', content: '内容1',
        })
        .mockResolvedValueOnce({
          id: 'ep-1', contentVersion: 1, aiAnalysis: null,
          orderIndex: 0, title: '話1', content: '内容1',
        });
      aiSettings.getApiKey.mockResolvedValue('sk-test-key');
      (global.fetch as jest.Mock).mockImplementation(() =>
        mockFetchError(500),
      );

      const result = await service.analyzeAllEpisodes('work-1');

      expect(result).toEqual({ analyzed: 1, skipped: 0 });
    });
  });

  // =========================================================================
  // getAnalysisForWork
  // =========================================================================

  describe('getAnalysisForWork', () => {
    it('returns analyses ordered by episode orderIndex', async () => {
      const mockAnalyses = [
        { id: 'a-1', episodeId: 'ep-1', workId: 'work-1', summary: '第1話要約' },
        { id: 'a-2', episodeId: 'ep-2', workId: 'work-1', summary: '第2話要約' },
      ];
      prisma.episodeAnalysis.findMany.mockResolvedValue(mockAnalyses);

      const result = await service.getAnalysisForWork('work-1');

      expect(result).toEqual(mockAnalyses);
      expect(prisma.episodeAnalysis.findMany).toHaveBeenCalledWith({
        where: { workId: 'work-1' },
        orderBy: { episode: { orderIndex: 'asc' } },
      });
    });

    it('returns empty array when no analyses exist', async () => {
      prisma.episodeAnalysis.findMany.mockResolvedValue([]);

      const result = await service.getAnalysisForWork('work-1');

      expect(result).toEqual([]);
    });
  });
});

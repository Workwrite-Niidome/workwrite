import { Test, TestingModule } from '@nestjs/testing';
import { AiContextBuilderService, AiWritingContext } from './ai-context-builder.service';
import { PrismaService } from '../common/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

const mockPrismaService = () => ({
  episodeAnalysis: {
    findMany: jest.fn(),
  },
  storyCharacter: {
    findMany: jest.fn(),
  },
  foreshadowing: {
    findMany: jest.fn(),
  },
  worldSetting: {
    findMany: jest.fn(),
  },
  characterDialogueSample: {
    findMany: jest.fn(),
  },
});

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

const makeAnalysis = (
  orderIndex: number,
  overrides: Record<string, unknown> = {},
) => ({
  id: `analysis-${orderIndex}`,
  episodeId: `ep-${orderIndex}`,
  workId: 'work-1',
  summary: `第${orderIndex + 1}話の要約テキストです。主人公が冒険します。`,
  endState: `第${orderIndex + 1}話の終了状態です。`,
  narrativePOV: '三人称限定',
  emotionalArc: '期待→決意',
  timelineEnd: `${orderIndex + 1}日後`,
  episode: { orderIndex, title: `第${orderIndex + 1}話タイトル` },
  ...overrides,
});

const makeCharacter = (
  id: string,
  name: string,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  name,
  role: '主人公',
  personality: '勇気がある',
  speechStyle: '丁寧語',
  firstPerson: '私',
  currentState: '旅の途中',
  sortOrder: 0,
  ...overrides,
});

const makeDialogueSample = (
  characterId: string,
  characterName: string,
  episodeOrder: number,
) => ({
  id: `ds-${characterId}-${episodeOrder}`,
  characterId,
  characterName,
  episodeOrder,
  line: `${characterName}のセリフです`,
  context: '重要な場面で',
  emotion: '決意',
  workId: 'work-1',
});

const makeForeshadowing = (id: string, plantedIn: number, description: string) => ({
  id,
  workId: 'work-1',
  description,
  plantedIn,
  status: 'open',
  importance: null,
});

const makeWorldSetting = (id: string, category: string, name: string, description: string) => ({
  id,
  workId: 'work-1',
  category,
  name,
  description,
  isActive: true,
});

// Empty context for formatForPrompt tests
const emptyContext = (): AiWritingContext => ({
  currentEpisodeOrder: 5,
  episodeSummaries: [],
  recentDetailedSummary: '',
  characters: [],
  openForeshadowings: [],
  worldSettings: [],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AiContextBuilderService', () => {
  let service: AiContextBuilderService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiContextBuilderService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AiContextBuilderService>(AiContextBuilderService);

    jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // buildContext
  // =========================================================================

  describe('buildContext', () => {
    it('returns empty arrays when no data exists', async () => {
      prisma.episodeAnalysis.findMany.mockResolvedValue([]);
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([]);

      const ctx = await service.buildContext('work-1', 3);

      expect(ctx.episodeSummaries).toEqual([]);
      expect(ctx.characters).toEqual([]);
      expect(ctx.openForeshadowings).toEqual([]);
      expect(ctx.worldSettings).toEqual([]);
      expect(ctx.recentDetailedSummary).toBe('');
      expect(ctx.currentEpisodeOrder).toBe(3);
    });

    it('includes episode summaries from analyses', async () => {
      prisma.episodeAnalysis.findMany.mockResolvedValue([
        makeAnalysis(0),
        makeAnalysis(1),
      ]);
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.episodeSummaries).toHaveLength(2);
      expect(ctx.episodeSummaries[0]).toMatchObject({
        order: 0,
        title: '第1話タイトル',
      });
      expect(ctx.episodeSummaries[0].summary.length).toBeLessThanOrEqual(150);
    });

    it('includes recent detailed summary for last 2 episodes before currentEpisodeOrder', async () => {
      prisma.episodeAnalysis.findMany.mockResolvedValue([
        makeAnalysis(0),
        makeAnalysis(1),
        makeAnalysis(2),
        makeAnalysis(3), // this should be excluded (>= currentEpisodeOrder=3)
      ]);
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([]);

      const ctx = await service.buildContext('work-1', 3);

      // Should include episodes 1 and 2 (orderIndex < 3, last 2)
      expect(ctx.recentDetailedSummary).toContain('第2話');
      expect(ctx.recentDetailedSummary).toContain('第3話');
      expect(ctx.recentDetailedSummary).not.toContain('第4話');
    });

    it('includes character data with dialogue samples', async () => {
      const character = makeCharacter('char-1', '勇者');
      prisma.episodeAnalysis.findMany.mockResolvedValue([]);
      prisma.storyCharacter.findMany.mockResolvedValue([character]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([
        makeDialogueSample('char-1', '勇者', 0),
        makeDialogueSample('char-1', '勇者', 1),
      ]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.characters).toHaveLength(1);
      expect(ctx.characters[0].name).toBe('勇者');
      expect(ctx.characters[0].dialogueSamples).toHaveLength(2);
      expect(ctx.characters[0].dialogueSamples[0]).toContain('勇者のセリフです');
    });

    it('limits dialogue samples to 3 per character', async () => {
      const character = makeCharacter('char-1', '勇者');
      prisma.episodeAnalysis.findMany.mockResolvedValue([]);
      prisma.storyCharacter.findMany.mockResolvedValue([character]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([
        makeDialogueSample('char-1', '勇者', 0),
        makeDialogueSample('char-1', '勇者', 1),
        makeDialogueSample('char-1', '勇者', 2),
        makeDialogueSample('char-1', '勇者', 3), // 4th sample should be dropped
      ]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.characters[0].dialogueSamples).toHaveLength(3);
    });

    it('includes open foreshadowings', async () => {
      prisma.episodeAnalysis.findMany.mockResolvedValue([]);
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.foreshadowing.findMany.mockResolvedValue([
        makeForeshadowing('f-1', 0, '謎の手紙'),
        makeForeshadowing('f-2', 2, '鍵の行方'),
      ]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.openForeshadowings).toHaveLength(2);
      expect(ctx.openForeshadowings[0]).toContain('謎の手紙');
      expect(ctx.openForeshadowings[1]).toContain('鍵の行方');
    });

    it('formats foreshadowing with episode number (1-indexed)', async () => {
      prisma.episodeAnalysis.findMany.mockResolvedValue([]);
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.foreshadowing.findMany.mockResolvedValue([
        makeForeshadowing('f-1', 2, '伏線内容'), // plantedIn=2 → 第3話
      ]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.openForeshadowings[0]).toContain('[第3話]');
    });

    it('marks critical foreshadowings with warning indicator', async () => {
      prisma.episodeAnalysis.findMany.mockResolvedValue([]);
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.foreshadowing.findMany.mockResolvedValue([
        { ...makeForeshadowing('f-1', 0, '重要な伏線'), importance: 'critical' },
      ]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.openForeshadowings[0]).toContain('⚠重要');
    });

    it('includes active world settings', async () => {
      prisma.episodeAnalysis.findMany.mockResolvedValue([]);
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([
        makeWorldSetting('ws-1', 'magic', '魔法陣', '魔力を増幅させる陣'),
        makeWorldSetting('ws-2', 'geography', '王都', '大陸の中心に位置する'),
      ]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.worldSettings).toHaveLength(2);
      expect(ctx.worldSettings[0]).toContain('[magic]');
      expect(ctx.worldSettings[0]).toContain('魔法陣');
      expect(ctx.worldSettings[1]).toContain('[geography]');
    });

    it('filters episode summaries — includes all episodes regardless of currentEpisodeOrder', async () => {
      // episodeSummaries contains ALL analyses, not filtered
      prisma.episodeAnalysis.findMany.mockResolvedValue([
        makeAnalysis(0),
        makeAnalysis(1),
        makeAnalysis(2),
      ]);
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([]);

      const ctx = await service.buildContext('work-1', 1);

      // All 3 analyses are included in episodeSummaries
      expect(ctx.episodeSummaries).toHaveLength(3);
    });

    it('filters recentDetailedSummary to only episodes before currentEpisodeOrder', async () => {
      prisma.episodeAnalysis.findMany.mockResolvedValue([
        makeAnalysis(0),
        makeAnalysis(1),
        makeAnalysis(2),
      ]);
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([]);

      const ctx = await service.buildContext('work-1', 1);

      // Only episode 0 is before currentEpisodeOrder=1
      expect(ctx.recentDetailedSummary).toContain('第1話');
      expect(ctx.recentDetailedSummary).not.toContain('第2話');
      expect(ctx.recentDetailedSummary).not.toContain('第3話');
    });

    it('sets narrativePOV and emotionalTone from most recent analysis before currentEpisodeOrder', async () => {
      prisma.episodeAnalysis.findMany.mockResolvedValue([
        makeAnalysis(0, { narrativePOV: '一人称主人公', emotionalArc: '期待→絶望' }),
        makeAnalysis(1, { narrativePOV: '三人称限定', emotionalArc: '怒り→決意', timelineEnd: '2日後' }),
        makeAnalysis(2, { narrativePOV: '三人称神視点', emotionalArc: '悲しみ→希望' }), // excluded (>= 2)
      ]);
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([]);

      const ctx = await service.buildContext('work-1', 2);

      expect(ctx.narrativePOV).toBe('三人称限定');
      expect(ctx.emotionalTone).toBe('怒り→決意');
      expect(ctx.timeline).toBe('2日後');
    });

    it('matches dialogue samples by characterName when characterId does not match', async () => {
      const character = makeCharacter('char-1', '魔法使い');
      prisma.episodeAnalysis.findMany.mockResolvedValue([]);
      prisma.storyCharacter.findMany.mockResolvedValue([character]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      // Dialogue sample has no characterId but matches by name
      prisma.characterDialogueSample.findMany.mockResolvedValue([
        {
          id: 'ds-1',
          characterId: null,
          characterName: '魔法使い',
          episodeOrder: 0,
          line: '魔法を使う！',
          context: '戦闘中',
          emotion: '集中',
          workId: 'work-1',
        },
      ]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.characters[0].dialogueSamples).toHaveLength(1);
      expect(ctx.characters[0].dialogueSamples[0]).toContain('魔法を使う！');
    });

    it('formats dialogue sample with empty string when both emotion and context are null', async () => {
      const character = makeCharacter('char-1', '勇者');
      prisma.episodeAnalysis.findMany.mockResolvedValue([]);
      prisma.storyCharacter.findMany.mockResolvedValue([character]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([
        {
          id: 'ds-1',
          characterId: 'char-1',
          characterName: '勇者',
          episodeOrder: 0,
          line: 'セリフのみ',
          context: null,
          emotion: null,
          workId: 'work-1',
        },
      ]);

      const ctx = await service.buildContext('work-1', 5);

      // When both emotion and context are null, the fallback '' is used
      expect(ctx.characters[0].dialogueSamples[0]).toBe('「セリフのみ」()');
    });

    it('formats dialogue sample using context when emotion is null', async () => {
      const character = makeCharacter('char-1', '勇者');
      prisma.episodeAnalysis.findMany.mockResolvedValue([]);
      prisma.storyCharacter.findMany.mockResolvedValue([character]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([
        {
          id: 'ds-1',
          characterId: 'char-1',
          characterName: '勇者',
          episodeOrder: 0,
          line: '文脈だけセリフ',
          context: '戦闘前',
          emotion: null,
          workId: 'work-1',
        },
      ]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.characters[0].dialogueSamples[0]).toBe('「文脈だけセリフ」(戦闘前)');
    });

    it('returns undefined for character fields when DB values are null', async () => {
      const character = {
        id: 'char-1',
        name: '謎の人',
        role: '不明',
        personality: null,
        speechStyle: null,
        firstPerson: null,
        currentState: null,
        sortOrder: 0,
      };
      prisma.episodeAnalysis.findMany.mockResolvedValue([]);
      prisma.storyCharacter.findMany.mockResolvedValue([character]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.characters[0].personality).toBeUndefined();
      expect(ctx.characters[0].speechStyle).toBeUndefined();
      expect(ctx.characters[0].firstPerson).toBeUndefined();
      expect(ctx.characters[0].currentState).toBeUndefined();
    });

    it('queries foreshadowings with status=open filter', async () => {
      prisma.episodeAnalysis.findMany.mockResolvedValue([]);
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([]);

      await service.buildContext('work-1', 3);

      expect(prisma.foreshadowing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workId: 'work-1', status: 'open' },
        }),
      );
    });

    it('queries world settings with isActive=true filter', async () => {
      prisma.episodeAnalysis.findMany.mockResolvedValue([]);
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([]);

      await service.buildContext('work-1', 3);

      expect(prisma.worldSetting.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workId: 'work-1', isActive: true },
        }),
      );
    });
  });

  // =========================================================================
  // formatForPrompt
  // =========================================================================

  describe('formatForPrompt', () => {
    it('produces non-empty string when context has data', () => {
      const ctx: AiWritingContext = {
        currentEpisodeOrder: 2,
        episodeSummaries: [{ order: 0, title: '第1話', summary: '第1話の要約' }],
        recentDetailedSummary: '直前の詳細要約テキスト',
        characters: [
          {
            name: '勇者',
            role: '主人公',
            dialogueSamples: ['「行くぞ！」(決意)'],
          },
        ],
        openForeshadowings: ['[第1話] 謎の手紙'],
        worldSettings: ['[magic] 魔法陣: 詳細説明'],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).not.toBe('');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns empty string when context is completely empty', () => {
      const ctx = emptyContext();

      const result = service.formatForPrompt(ctx);

      expect(result).toBe('');
    });

    it('includes recent detailed summary in priority-1 position', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        recentDetailedSummary: '直前の詳細要約テキスト',
        episodeSummaries: [{ order: 0, title: '第1話', summary: '第1話要約' }],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【直前のあらすじ】');
      expect(result).toContain('直前の詳細要約テキスト');
      // Recent summary should appear before episode list
      const recentIdx = result.indexOf('【直前のあらすじ】');
      const episodesIdx = result.indexOf('【これまでの話の流れ】');
      expect(recentIdx).toBeLessThan(episodesIdx);
    });

    it('includes characters section', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        characters: [
          {
            name: '勇者',
            role: '主人公',
            speechStyle: '丁寧語',
            firstPerson: '私',
            currentState: '旅の途中',
            dialogueSamples: [],
          },
        ],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【登場キャラクター】');
      expect(result).toContain('勇者');
      expect(result).toContain('口調:丁寧語');
      expect(result).toContain('一人称:私');
      expect(result).toContain('現在:旅の途中');
    });

    it('includes episode summaries section', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        episodeSummaries: [
          { order: 0, title: '第1話タイトル', summary: '第1話の要約です' },
        ],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【これまでの話の流れ】');
      expect(result).toContain('第1話「第1話タイトル」');
    });

    it('includes foreshadowings section', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        openForeshadowings: ['[第1話] 謎の手紙の伏線'],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【未回収の伏線】');
      expect(result).toContain('謎の手紙の伏線');
    });

    it('includes world settings section', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        worldSettings: ['[magic] 魔法陣: 魔力を増幅させる'],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【世界設定】');
      expect(result).toContain('魔法陣');
    });

    it('includes narrative metadata section when POV or tone is available', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        narrativePOV: '三人称限定',
        emotionalTone: '期待→決意',
        timeline: '3日後',
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【文体情報】');
      expect(result).toContain('視点: 三人称限定');
      expect(result).toContain('感情の流れ: 期待→決意');
      expect(result).toContain('時間軸: 3日後');
    });

    it('respects MAX_CONTEXT_CHARS budget — drops low-priority sections when budget is exceeded', () => {
      // Priority 1 (recent summary) has NO budget guard and always gets added.
      // Fill the budget via a very large recent summary so that lower-priority
      // sections (world settings = priority 5) cannot fit.
      const MAX_CONTEXT_CHARS = 8000;
      // The section string is "【直前のあらすじ】\n" + content, so content needs to
      // push charCount past MAX_CONTEXT_CHARS before the world-settings check.
      const longSummary = 'あ'.repeat(MAX_CONTEXT_CHARS + 500);
      const ctx: AiWritingContext = {
        ...emptyContext(),
        recentDetailedSummary: longSummary,
        worldSettings: ['[magic] 魔法陣: これは表示されないはずです'],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).not.toContain('【世界設定】');
    });

    it('sections appear in priority order: recent summary > characters > episodes > foreshadowings > world settings', () => {
      const ctx: AiWritingContext = {
        currentEpisodeOrder: 5,
        recentDetailedSummary: '直前の要約',
        characters: [{ name: '勇者', role: '主人公', dialogueSamples: [] }],
        episodeSummaries: [{ order: 0, title: '第1話', summary: '第1話要約' }],
        openForeshadowings: ['[第1話] 伏線'],
        worldSettings: ['[magic] 設定'],
      };

      const result = service.formatForPrompt(ctx);

      const recentIdx = result.indexOf('【直前のあらすじ】');
      const charsIdx = result.indexOf('【登場キャラクター】');
      const episodesIdx = result.indexOf('【これまでの話の流れ】');
      const foreshadowingsIdx = result.indexOf('【未回収の伏線】');
      const worldIdx = result.indexOf('【世界設定】');

      expect(recentIdx).toBeLessThan(charsIdx);
      expect(charsIdx).toBeLessThan(episodesIdx);
      expect(episodesIdx).toBeLessThan(foreshadowingsIdx);
      expect(foreshadowingsIdx).toBeLessThan(worldIdx);
    });

    it('omits character fields that are undefined', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        characters: [
          {
            name: '謎の人物',
            role: '謎',
            // no speechStyle, firstPerson, currentState, dialogueSamples
            dialogueSamples: [],
          },
        ],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).not.toContain('口調:');
      expect(result).not.toContain('一人称:');
      expect(result).not.toContain('現在:');
    });

    it('includes dialogue samples inline in character entry', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        characters: [
          {
            name: '勇者',
            role: '主人公',
            dialogueSamples: ['「行くぞ！」(決意)', '「まだ諦めない」(希望)'],
          },
        ],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('セリフ例:');
      expect(result).toContain('「行くぞ！」(決意)');
    });

    it('omits recentDetailedSummary section when empty string', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        recentDetailedSummary: '',
        episodeSummaries: [{ order: 0, title: '第1話', summary: '要約' }],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).not.toContain('【直前のあらすじ】');
      expect(result).toContain('【これまでの話の流れ】');
    });

    it('truncates world setting descriptions to 100 chars in buildContext output', async () => {
      const longDescription = 'あ'.repeat(200);
      prisma.episodeAnalysis.findMany.mockResolvedValue([]);
      prisma.storyCharacter.findMany.mockResolvedValue([]);
      prisma.foreshadowing.findMany.mockResolvedValue([]);
      prisma.worldSetting.findMany.mockResolvedValue([
        makeWorldSetting('ws-1', 'magic', '魔法陣', longDescription),
      ]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([]);

      const ctx = await service.buildContext('work-1', 5);

      // The description is sliced to 100 in buildContext
      expect(ctx.worldSettings[0]).toContain('あ'.repeat(100));
      // Should not contain more than 100 あ's in the description part
      const descriptionPart = ctx.worldSettings[0].split(': ')[1];
      expect(descriptionPart.length).toBeLessThanOrEqual(100);
    });
  });
});

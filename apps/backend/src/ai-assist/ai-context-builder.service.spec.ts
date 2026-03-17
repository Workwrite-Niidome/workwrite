import { Test, TestingModule } from '@nestjs/testing';
import { AiContextBuilderService, AiWritingContext } from './ai-context-builder.service';
import { PrismaService } from '../common/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

const mockPrismaService = () => ({
  work: { findUnique: jest.fn() },
  episodeAnalysis: { findMany: jest.fn() },
  storyCharacter: { findMany: jest.fn() },
  storyCharacterRelation: { findMany: jest.fn() },
  foreshadowing: { findMany: jest.fn() },
  worldSetting: { findMany: jest.fn() },
  characterDialogueSample: { findMany: jest.fn() },
  episode: { findFirst: jest.fn() },
  storyScene: { findFirst: jest.fn() },
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
  characters: [{ name: `キャラ${orderIndex}`, role: '主人公', action: '冒険' }],
  episode: { orderIndex, title: `第${orderIndex + 1}話タイトル`, id: `ep-${orderIndex}` },
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

// Helper to set default empty mocks
function setEmptyMocks(prisma: ReturnType<typeof mockPrismaService>) {
  prisma.work.findUnique.mockResolvedValue({ genre: null, settingEra: null });
  prisma.episodeAnalysis.findMany.mockResolvedValue([]);
  prisma.storyCharacter.findMany.mockResolvedValue([]);
  prisma.storyCharacterRelation.findMany.mockResolvedValue([]);
  prisma.foreshadowing.findMany.mockResolvedValue([]);
  prisma.worldSetting.findMany.mockResolvedValue([]);
  prisma.characterDialogueSample.findMany.mockResolvedValue([]);
  prisma.episode.findFirst.mockResolvedValue(null);
  prisma.storyScene.findFirst.mockResolvedValue(null);
}

// Empty context for formatForPrompt tests
const emptyContext = (): AiWritingContext => ({
  currentEpisodeOrder: 5,
  episodeSummaries: [],
  recentDetailedSummary: '',
  recentRawText: '',
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
      setEmptyMocks(prisma);

      const ctx = await service.buildContext('work-1', 3);

      expect(ctx.episodeSummaries).toEqual([]);
      expect(ctx.characters).toEqual([]);
      expect(ctx.openForeshadowings).toEqual([]);
      expect(ctx.worldSettings).toEqual([]);
      expect(ctx.recentDetailedSummary).toBe('');
      expect(ctx.currentEpisodeOrder).toBe(3);
    });

    it('includes episode summaries from analyses', async () => {
      setEmptyMocks(prisma);
      prisma.episodeAnalysis.findMany.mockResolvedValue([
        makeAnalysis(0),
        makeAnalysis(1),
      ]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.episodeSummaries).toHaveLength(2);
      expect(ctx.episodeSummaries[0]).toMatchObject({
        order: 0,
        title: '第1話タイトル',
      });
      expect(ctx.episodeSummaries[0].summary.length).toBeLessThanOrEqual(150);
    });

    it('includes recent detailed summary for last 2 episodes before currentEpisodeOrder', async () => {
      setEmptyMocks(prisma);
      prisma.episodeAnalysis.findMany.mockResolvedValue([
        makeAnalysis(0),
        makeAnalysis(1),
        makeAnalysis(2),
        makeAnalysis(3),
      ]);

      const ctx = await service.buildContext('work-1', 3);

      expect(ctx.recentDetailedSummary).toContain('第2話');
      expect(ctx.recentDetailedSummary).toContain('第3話');
      expect(ctx.recentDetailedSummary).not.toContain('第4話');
    });

    it('includes character data with dialogue samples', async () => {
      setEmptyMocks(prisma);
      prisma.storyCharacter.findMany.mockResolvedValue([makeCharacter('char-1', '勇者')]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([
        makeDialogueSample('char-1', '勇者', 0),
        makeDialogueSample('char-1', '勇者', 1),
      ]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.characters).toHaveLength(1);
      expect(ctx.characters[0].name).toBe('勇者');
      expect(ctx.characters[0].dialogueSamples).toHaveLength(2);
    });

    it('classifies characters as appeared/not-appeared based on episode analyses', async () => {
      setEmptyMocks(prisma);
      prisma.episodeAnalysis.findMany.mockResolvedValue([
        makeAnalysis(0, { characters: [{ name: 'ユウキ' }] }),
        makeAnalysis(1, { characters: [{ name: 'ユウキ' }, { name: 'アカネ' }] }),
      ]);
      prisma.storyCharacter.findMany.mockResolvedValue([
        makeCharacter('c1', 'ユウキ'),
        makeCharacter('c2', 'アカネ'),
        makeCharacter('c3', 'ルナ'),
      ]);

      const ctx = await service.buildContext('work-1', 3);

      const yuuki = ctx.characters.find((c) => c.name === 'ユウキ');
      const akane = ctx.characters.find((c) => c.name === 'アカネ');
      const luna = ctx.characters.find((c) => c.name === 'ルナ');

      expect(yuuki?.hasAppeared).toBe(true);
      expect(akane?.hasAppeared).toBe(true);
      expect(luna?.hasAppeared).toBe(false);
    });

    it('includes character relationships', async () => {
      setEmptyMocks(prisma);
      prisma.storyCharacter.findMany.mockResolvedValue([
        makeCharacter('c1', 'ユウキ'),
        makeCharacter('c2', 'アカネ'),
      ]);
      prisma.storyCharacterRelation.findMany.mockResolvedValue([
        {
          fromCharacterId: 'c1',
          toCharacterId: 'c2',
          relationType: '幼馴染',
          description: null,
          from: { name: 'ユウキ' },
          to: { name: 'アカネ' },
        },
      ]);

      const ctx = await service.buildContext('work-1', 5);

      const yuuki = ctx.characters.find((c) => c.name === 'ユウキ');
      const akane = ctx.characters.find((c) => c.name === 'アカネ');

      expect(yuuki?.relationships).toContain('アカネ→幼馴染');
      expect(akane?.relationships).toContain('ユウキ→幼馴染');
    });

    it('includes settingEra from work', async () => {
      setEmptyMocks(prisma);
      prisma.work.findUnique.mockResolvedValue({ genre: 'fantasy', settingEra: '中世ヨーロッパ風ファンタジー' });

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.settingEra).toBe('中世ヨーロッパ風ファンタジー');
    });

    it('includes scene goal when StoryScene is linked to episode', async () => {
      setEmptyMocks(prisma);
      prisma.episode.findFirst.mockResolvedValue({ id: 'ep-3' });
      prisma.storyScene.findFirst.mockResolvedValue({
        title: '裏切りの発覚',
        summary: '主人公が仲間の裏切りを知る',
        emotionTarget: '絶望',
        intensity: 8,
        act: { title: '第二幕：試練', actNumber: 2, turningPoint: '仲間の裏切り' },
      });

      const ctx = await service.buildContext('work-1', 3);

      expect(ctx.sceneGoal).toBeDefined();
      expect(ctx.sceneGoal?.sceneTitle).toBe('裏切りの発覚');
      expect(ctx.sceneGoal?.sceneSummary).toBe('主人公が仲間の裏切りを知る');
      expect(ctx.sceneGoal?.emotionTarget).toBe('絶望');
      expect(ctx.sceneGoal?.intensity).toBe(8);
      expect(ctx.sceneGoal?.actTitle).toBe('第二幕：試練');
    });

    it('includes open foreshadowings', async () => {
      setEmptyMocks(prisma);
      prisma.foreshadowing.findMany.mockResolvedValue([
        makeForeshadowing('f-1', 0, '謎の手紙'),
        makeForeshadowing('f-2', 2, '鍵の行方'),
      ]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.openForeshadowings).toHaveLength(2);
      expect(ctx.openForeshadowings[0]).toContain('謎の手紙');
    });

    it('marks critical foreshadowings with warning indicator', async () => {
      setEmptyMocks(prisma);
      prisma.foreshadowing.findMany.mockResolvedValue([
        { ...makeForeshadowing('f-1', 0, '重要な伏線'), importance: 'critical' },
      ]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.openForeshadowings[0]).toContain('⚠重要');
    });

    it('limits dialogue samples to 3 per character', async () => {
      setEmptyMocks(prisma);
      prisma.storyCharacter.findMany.mockResolvedValue([makeCharacter('char-1', '勇者')]);
      prisma.characterDialogueSample.findMany.mockResolvedValue([
        makeDialogueSample('char-1', '勇者', 0),
        makeDialogueSample('char-1', '勇者', 1),
        makeDialogueSample('char-1', '勇者', 2),
        makeDialogueSample('char-1', '勇者', 3),
      ]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.characters[0].dialogueSamples).toHaveLength(3);
    });
  });

  // =========================================================================
  // formatForPrompt
  // =========================================================================

  describe('formatForPrompt', () => {
    it('returns empty string when context is completely empty', () => {
      const result = service.formatForPrompt(emptyContext());
      expect(result).toBe('');
    });

    it('includes scene goal section when present', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        sceneGoal: {
          actTitle: '第二幕',
          actNumber: 2,
          sceneTitle: '裏切りの発覚',
          sceneSummary: '主人公が仲間の裏切りを知る',
          emotionTarget: '絶望',
          intensity: 8,
          turningPoint: '仲間の離反',
        },
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【この章の目的】');
      expect(result).toContain('裏切りの発覚');
      expect(result).toContain('目的: 主人公が仲間の裏切りを知る');
      expect(result).toContain('感情目標: 絶望（強度8/10）');
      expect(result).toContain('幕の転換点: 仲間の離反');
    });

    it('includes settingEra in world settings section', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        settingEra: '中世ヨーロッパ風ファンタジー',
        worldSettings: ['[magic] 魔法陣: 詳細'],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【世界設定】');
      expect(result).toContain('中世ヨーロッパ風ファンタジー');
      expect(result).toContain('現代語・現代技術・現代の概念は使用禁止');
      expect(result).toContain('魔法陣');
    });

    it('separates characters into appeared and not-appeared sections', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        characters: [
          { name: 'ユウキ', role: '主人公', dialogueSamples: [], relationships: ['アカネ→幼馴染'], hasAppeared: true },
          { name: 'ルナ', role: 'ヒロイン', dialogueSamples: [], relationships: [], hasAppeared: false },
        ],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【読者に紹介済みのキャラクター】');
      expect(result).toContain('【まだ物語に登場していないキャラクター】');
      expect(result).toContain('ユウキ');
      expect(result).toContain('ルナ');
      expect(result).toContain('関係性に応じた自然な話し方');
      expect(result).toContain('読者にとって未知の人物');
    });

    it('includes character relationships in output', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        characters: [
          { name: 'ユウキ', role: '主人公', dialogueSamples: [], relationships: ['アカネ→幼馴染', 'リン→師匠'], hasAppeared: true },
        ],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('関係性: アカネ→幼馴染、リン→師匠');
    });

    it('includes recent detailed summary section', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        recentDetailedSummary: '直前の詳細要約テキスト',
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【直前のあらすじ】');
      expect(result).toContain('直前の詳細要約テキスト');
    });

    it('respects MAX_CONTEXT_CHARS budget — drops low-priority sections', () => {
      const longSummary = 'あ'.repeat(9980);
      const ctx: AiWritingContext = {
        ...emptyContext(),
        recentDetailedSummary: longSummary,
        worldSettings: ['[magic] 魔法陣: これは表示されないはずです'],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).not.toContain('【世界設定】');
    });

    it('includes narrative metadata section', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        narrativePOV: '三人称限定',
        emotionalTone: '期待→決意',
        timeline: '3日後',
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【文体情報】');
      expect(result).toContain('視点: 三人称限定');
    });
  });
});

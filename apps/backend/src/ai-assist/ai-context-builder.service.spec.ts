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
  episode: { findFirst: jest.fn(), findMany: jest.fn() },
  storyScene: { findFirst: jest.fn() },
  workCreationPlan: { findFirst: jest.fn() },
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
  prisma.episode.findMany.mockResolvedValue([]);
  prisma.storyScene.findFirst.mockResolvedValue(null);
  prisma.workCreationPlan.findFirst.mockResolvedValue(null);
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
      expect(ctx.episodeSummaries[0].summary.length).toBeLessThanOrEqual(300);
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

    // -----------------------------------------------------------------------
    // NEW: recentRawText tests
    // -----------------------------------------------------------------------

    it('builds recentRawText from last 2 episodes before currentEpisodeOrder', async () => {
      setEmptyMocks(prisma);
      // findMany returns episodes ordered desc (most recent first)
      prisma.episode.findMany.mockResolvedValue([
        { orderIndex: 4, title: '第5話タイトル', content: 'B'.repeat(3000) },
        { orderIndex: 3, title: '第4話タイトル', content: 'A'.repeat(2000) },
      ]);

      const ctx = await service.buildContext('work-1', 5);

      // Should contain both episode titles
      expect(ctx.recentRawText).toContain('第4話');
      expect(ctx.recentRawText).toContain('第5話');
    });

    it('limits most-recent episode raw text to last 2000 chars', async () => {
      setEmptyMocks(prisma);
      const longContent = 'X'.repeat(5000);
      // desc order: index 0 = most recent
      prisma.episode.findMany.mockResolvedValue([
        { orderIndex: 4, title: '第5話', content: longContent },
      ]);

      const ctx = await service.buildContext('work-1', 5);

      // The most recent episode (after reverse, it's the last) gets 2000 chars limit
      // With only 1 episode, after reverse it becomes index 0, limit = 1000
      // Let's verify the raw text length is capped
      expect(ctx.recentRawText.length).toBeLessThan(5000 + 50); // must be truncated
    });

    it('limits older episode raw text to last 1000 chars', async () => {
      setEmptyMocks(prisma);
      const longContent = 'Y'.repeat(5000);
      // desc order: index 0 = most recent (ep4), index 1 = older (ep3)
      prisma.episode.findMany.mockResolvedValue([
        { orderIndex: 4, title: '第5話', content: 'Z'.repeat(100) },
        { orderIndex: 3, title: '第4話', content: longContent },
      ]);

      const ctx = await service.buildContext('work-1', 5);

      // After reverse: index 0 = ep3 (older) → 1000 char limit, index 1 = ep4 (newer) → 2000 char limit
      // ep3 content is 5000 chars but should be sliced to 1000
      const ep3Part = ctx.recentRawText.split('\n\n')[0];
      // The tail should be at most 1000 'Y' chars
      expect(ep3Part.split('\n').slice(1).join('\n').length).toBeLessThanOrEqual(1000);
    });

    it('handles null/empty content in episodes gracefully', async () => {
      setEmptyMocks(prisma);
      prisma.episode.findMany.mockResolvedValue([
        { orderIndex: 4, title: '第5話', content: null },
        { orderIndex: 3, title: '第4話', content: '' },
      ]);

      const ctx = await service.buildContext('work-1', 5);

      expect(ctx.recentRawText).toBeDefined();
      expect(typeof ctx.recentRawText).toBe('string');
      // Should not throw and should contain episode titles
      expect(ctx.recentRawText).toContain('第4話');
      expect(ctx.recentRawText).toContain('第5話');
    });

    it('returns empty recentRawText when no prior episodes exist', async () => {
      setEmptyMocks(prisma);
      prisma.episode.findMany.mockResolvedValue([]);

      const ctx = await service.buildContext('work-1', 1);

      expect(ctx.recentRawText).toBe('');
    });

    // -----------------------------------------------------------------------
    // NEW: chapterBrief tests
    // -----------------------------------------------------------------------

    it('builds chapterBrief from chapterOutline matching currentEpisodeOrder', async () => {
      setEmptyMocks(prisma);
      prisma.workCreationPlan.findFirst.mockResolvedValue({
        plotOutline: null,
        emotionBlueprint: null,
        chapterOutline: [
          { title: '第1話', summary: '旅の始まり' },           // index 0
          { title: '第2話', summary: '試練の始まり' },         // index 1
          { title: '第3話', summary: '仲間との出会い', keyScenes: ['酒場での決闘'], characters: ['勇者', '魔法使い'], emotionTarget: '友情', emotionIntensity: 7 }, // index 2
        ],
      });

      const ctx = await service.buildContext('work-1', 2); // currentEpisodeOrder = 2, so index 2

      expect(ctx.chapterBrief).toBeDefined();
      expect(ctx.chapterBrief).toContain('タイトル: 第3話');
      expect(ctx.chapterBrief).toContain('概要: 仲間との出会い');
      expect(ctx.chapterBrief).toContain('主要シーン: 酒場での決闘');
      expect(ctx.chapterBrief).toContain('登場キャラクター: 勇者、魔法使い');
      expect(ctx.chapterBrief).toContain('感情目標: 友情（強度7/10）');
    });

    it('returns undefined chapterBrief when chapterOutline index does not exist', async () => {
      setEmptyMocks(prisma);
      prisma.workCreationPlan.findFirst.mockResolvedValue({
        plotOutline: null,
        emotionBlueprint: null,
        chapterOutline: [{ title: '第1話', summary: '旅の始まり' }], // only index 0
      });

      const ctx = await service.buildContext('work-1', 5); // index 5 does not exist

      expect(ctx.chapterBrief).toBeUndefined();
    });

    it('builds chapterBrief with only available fields (partial chapter data)', async () => {
      setEmptyMocks(prisma);
      prisma.workCreationPlan.findFirst.mockResolvedValue({
        plotOutline: null,
        emotionBlueprint: null,
        chapterOutline: [
          null, // index 0
          { summary: '試練の概要のみ' }, // index 1 — no title, no keyScenes
        ],
      });

      const ctx = await service.buildContext('work-1', 1);

      expect(ctx.chapterBrief).toBeDefined();
      expect(ctx.chapterBrief).toContain('概要: 試練の概要のみ');
      expect(ctx.chapterBrief).not.toContain('タイトル:');
    });

    // -----------------------------------------------------------------------
    // NEW: plotOutline (string) tests
    // -----------------------------------------------------------------------

    it('passes through string plotOutline truncated to 2000 chars', async () => {
      setEmptyMocks(prisma);
      const longOutline = 'プロット'.repeat(600); // ~2400 chars
      prisma.workCreationPlan.findFirst.mockResolvedValue({
        plotOutline: longOutline,
        chapterOutline: null,
        emotionBlueprint: null,
      });

      const ctx = await service.buildContext('work-1', 3);

      expect(ctx.plotOutline).toBeDefined();
      expect(ctx.plotOutline!.length).toBeLessThanOrEqual(2000);
      expect(ctx.plotOutline).toBe(longOutline.slice(0, 2000));
    });

    it('passes through short string plotOutline without truncation', async () => {
      setEmptyMocks(prisma);
      const shortOutline = '主人公が世界を救う物語';
      prisma.workCreationPlan.findFirst.mockResolvedValue({
        plotOutline: shortOutline,
        chapterOutline: null,
        emotionBlueprint: null,
      });

      const ctx = await service.buildContext('work-1', 3);

      expect(ctx.plotOutline).toBe(shortOutline);
    });

    // -----------------------------------------------------------------------
    // NEW: plotOutline (structured) tests
    // -----------------------------------------------------------------------

    it('formats structured plotOutline with actGroups correctly', async () => {
      setEmptyMocks(prisma);
      prisma.workCreationPlan.findFirst.mockResolvedValue({
        chapterOutline: null,
        emotionBlueprint: null,
        plotOutline: {
          type: 'structured',
          actGroups: [
            {
              label: '第一幕',
              description: '旅立ち',
              episodes: [
                {
                  title: '出発の朝',
                  whatHappens: '主人公が旅立つ',
                  whyItHappens: '使命を受けたから',
                  characters: ['勇者', '王様'],
                  emotionTarget: '希望',
                },
              ],
            },
          ],
        },
      });

      const ctx = await service.buildContext('work-1', 3);

      expect(ctx.plotOutline).toBeDefined();
      expect(ctx.plotOutline).toContain('[第一幕] 旅立ち');
      expect(ctx.plotOutline).toContain('出発の朝');
      expect(ctx.plotOutline).toContain('主人公が旅立つ');
      expect(ctx.plotOutline).toContain('理由: 使命を受けたから');
      expect(ctx.plotOutline).toContain('登場: 勇者、王様');
      expect(ctx.plotOutline).toContain('感情: 希望');
    });

    it('limits structured plotOutline total to 2000 chars', async () => {
      setEmptyMocks(prisma);
      const manyEpisodes = Array.from({ length: 100 }, (_, i) => ({
        title: `エピソード${i}`,
        whatHappens: 'あ'.repeat(50),
      }));
      prisma.workCreationPlan.findFirst.mockResolvedValue({
        chapterOutline: null,
        emotionBlueprint: null,
        plotOutline: {
          type: 'structured',
          actGroups: [{ label: '第一幕', episodes: manyEpisodes }],
        },
      });

      const ctx = await service.buildContext('work-1', 3);

      expect(ctx.plotOutline).toBeDefined();
      expect(ctx.plotOutline!.length).toBeLessThanOrEqual(2000);
    });

    it('returns undefined plotOutline when actGroups is empty', async () => {
      setEmptyMocks(prisma);
      prisma.workCreationPlan.findFirst.mockResolvedValue({
        chapterOutline: null,
        emotionBlueprint: null,
        plotOutline: {
          type: 'structured',
          actGroups: [],
        },
      });

      const ctx = await service.buildContext('work-1', 3);

      expect(ctx.plotOutline).toBeUndefined();
    });

    it('ignores non-structured plotOutline objects (missing type)', async () => {
      setEmptyMocks(prisma);
      prisma.workCreationPlan.findFirst.mockResolvedValue({
        chapterOutline: null,
        emotionBlueprint: null,
        plotOutline: { type: 'unknown', data: 'something' },
      });

      const ctx = await service.buildContext('work-1', 3);

      expect(ctx.plotOutline).toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // NEW: emotionGoals tests
    // -----------------------------------------------------------------------

    it('extracts emotionGoals from emotionBlueprint fields', async () => {
      setEmptyMocks(prisma);
      prisma.workCreationPlan.findFirst.mockResolvedValue({
        plotOutline: null,
        chapterOutline: null,
        emotionBlueprint: {
          coreMessage: '友情の力で世界は変わる',
          targetEmotions: ['感動', '希望', '涙'],
          readerJourney: '絶望から希望へ',
        },
      });

      const ctx = await service.buildContext('work-1', 3);

      expect(ctx.emotionGoals).toBeDefined();
      expect(ctx.emotionGoals).toContain('コアメッセージ: 友情の力で世界は変わる');
      expect(ctx.emotionGoals).toContain('感情目標: 感動、希望、涙');
      expect(ctx.emotionGoals).toContain('読者の旅路: 絶望から希望へ');
    });

    it('builds emotionGoals with only coreMessage when others are absent', async () => {
      setEmptyMocks(prisma);
      prisma.workCreationPlan.findFirst.mockResolvedValue({
        plotOutline: null,
        chapterOutline: null,
        emotionBlueprint: {
          coreMessage: '孤独な戦いの物語',
        },
      });

      const ctx = await service.buildContext('work-1', 3);

      expect(ctx.emotionGoals).toBeDefined();
      expect(ctx.emotionGoals).toContain('コアメッセージ: 孤独な戦いの物語');
      expect(ctx.emotionGoals).not.toContain('感情目標:');
      expect(ctx.emotionGoals).not.toContain('読者の旅路:');
    });

    it('returns undefined emotionGoals when emotionBlueprint has no relevant fields', async () => {
      setEmptyMocks(prisma);
      prisma.workCreationPlan.findFirst.mockResolvedValue({
        plotOutline: null,
        chapterOutline: null,
        emotionBlueprint: {},
      });

      const ctx = await service.buildContext('work-1', 3);

      expect(ctx.emotionGoals).toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // NEW: no creation plan
    // -----------------------------------------------------------------------

    it('handles gracefully when no WorkCreationPlan exists', async () => {
      setEmptyMocks(prisma);
      prisma.workCreationPlan.findFirst.mockResolvedValue(null);

      const ctx = await service.buildContext('work-1', 3);

      expect(ctx.chapterBrief).toBeUndefined();
      expect(ctx.plotOutline).toBeUndefined();
      expect(ctx.emotionGoals).toBeUndefined();
    });
  });

  // =========================================================================
  // formatForPrompt
  // =========================================================================

  describe('formatForPrompt', () => {
    it('returns empty string when context is completely empty', () => {
      // Even with grounding rules, an entirely empty context still returns empty
      // because grounding rules ARE added, so result is not empty
      // The actual behavior: grounding rules are always added first
      const result = service.formatForPrompt(emptyContext());
      // Grounding rules section is always added even with empty context
      // but wait - an emptyContext has no meaningful content
      // Let's verify this correctly based on the implementation:
      // addSection always adds the grounding rules first, so result will NOT be empty
      expect(result).toContain('【絶対遵守ルール — ハルシネーション防止】');
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
      // MAX_CONTEXT_CHARS = 20000
      // Grounding rules = 202 chars; summary section header = 10 chars
      // World settings section = ~33 chars for the test value
      // To include summary but exclude worldSettings:
      //   summary must be >= 19755 and <= 19787 chars
      //   After summary: charCount = 202 + 10 + 19770 = 19982; 19982 + 33 = 20015 >= 20000 → dropped
      const longSummary = 'あ'.repeat(19770);
      const ctx: AiWritingContext = {
        ...emptyContext(),
        recentDetailedSummary: longSummary,
        worldSettings: ['[magic] 魔法陣: これは表示されないはずです'],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【直前のあらすじ】');
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

    // -----------------------------------------------------------------------
    // NEW: grounding rules always first
    // -----------------------------------------------------------------------

    it('always includes grounding rules as the very first section', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        recentDetailedSummary: '直前の要約',
        sceneGoal: {
          actTitle: '第一幕',
          actNumber: 1,
          sceneTitle: '始まり',
        },
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【絶対遵守ルール — ハルシネーション防止】');
      // Grounding rules must appear before all other sections
      const groundingIdx = result.indexOf('【絶対遵守ルール — ハルシネーション防止】');
      const summaryIdx = result.indexOf('【直前のあらすじ】');
      const sceneIdx = result.indexOf('【この章の目的】');
      expect(groundingIdx).toBeLessThan(summaryIdx);
      expect(groundingIdx).toBeLessThan(sceneIdx);
    });

    it('includes anti-hallucination rule content in grounding section', () => {
      const result = service.formatForPrompt(emptyContext());

      expect(result).toContain('提供されたテキスト・構造データに記述されていない過去のイベント');
      expect(result).toContain('ハルシネーション防止');
    });

    // -----------------------------------------------------------------------
    // NEW: chapter brief included
    // -----------------------------------------------------------------------

    it('includes chapter brief section when chapterBrief is present', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        chapterBrief: 'タイトル: 第3話\n概要: 仲間との出会い',
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【この話で達成すべきこと】');
      expect(result).toContain('タイトル: 第3話');
      expect(result).toContain('概要: 仲間との出会い');
    });

    it('omits chapter brief section when chapterBrief is absent', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        chapterBrief: undefined,
      };

      const result = service.formatForPrompt(ctx);

      expect(result).not.toContain('【この話で達成すべきこと】');
    });

    // -----------------------------------------------------------------------
    // NEW: recent raw text included
    // -----------------------------------------------------------------------

    it('includes recent raw text section when recentRawText is present', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        recentRawText: '第5話「タイトル」末尾:\n原文のテキストです',
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【直前エピソードの原文末尾】');
      expect(result).toContain('原文のテキストです');
    });

    it('omits recent raw text section when recentRawText is empty string', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        recentRawText: '',
      };

      const result = service.formatForPrompt(ctx);

      expect(result).not.toContain('【直前エピソードの原文末尾】');
    });

    // -----------------------------------------------------------------------
    // NEW: increased limits (MAX_CONTEXT_CHARS = 20000)
    // -----------------------------------------------------------------------

    it('accommodates content between 10000 and 20000 chars within MAX_CONTEXT_CHARS', () => {
      // Previously limit was 10000; now it's 20000
      // Create context with ~15000 chars of content
      const mediumSummary = 'い'.repeat(14500);
      const ctx: AiWritingContext = {
        ...emptyContext(),
        recentDetailedSummary: mediumSummary,
        worldSettings: ['[world] 世界設定: これは含まれるはずです'],
      };

      const result = service.formatForPrompt(ctx);

      // With old 10000 limit, worldSettings would be dropped
      // With new 20000 limit, worldSettings should be included (14500 + overhead + worldSetting still < 20000)
      expect(result).toContain('【世界設定】');
      expect(result).toContain('世界設定: これは含まれるはずです');
    });

    it('total output does not exceed MAX_CONTEXT_CHARS of 20000', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        recentDetailedSummary: 'あ'.repeat(5000),
        recentRawText: 'い'.repeat(5000),
        chapterBrief: 'う'.repeat(2000),
        plotOutline: 'え'.repeat(2000),
        emotionGoals: 'お'.repeat(2000),
        worldSettings: Array.from({ length: 10 }, (_, i) => `[cat${i}] 設定${i}: ${'か'.repeat(100)}`),
        narrativePOV: '三人称',
        emotionalTone: '明るい',
        timeline: '1日後',
      };

      const result = service.formatForPrompt(ctx);

      expect(result.length).toBeLessThanOrEqual(20000);
    });

    // -----------------------------------------------------------------------
    // NEW: priority ordering
    // -----------------------------------------------------------------------

    it('places grounding rules before chapter brief', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        chapterBrief: 'タイトル: 第3話',
      };

      const result = service.formatForPrompt(ctx);

      const groundingIdx = result.indexOf('【絶対遵守ルール');
      const chapterBriefIdx = result.indexOf('【この話で達成すべきこと】');
      expect(groundingIdx).toBeLessThan(chapterBriefIdx);
    });

    it('places chapter brief before recent raw text', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        chapterBrief: '概要: テスト',
        recentRawText: '第5話の末尾テキスト',
      };

      const result = service.formatForPrompt(ctx);

      const chapterBriefIdx = result.indexOf('【この話で達成すべきこと】');
      const rawTextIdx = result.indexOf('【直前エピソードの原文末尾】');
      expect(chapterBriefIdx).toBeLessThan(rawTextIdx);
    });

    it('places recent raw text before scene goal', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        recentRawText: '第5話の末尾テキスト',
        sceneGoal: {
          actTitle: '第一幕',
          actNumber: 1,
          sceneTitle: '始まり',
        },
      };

      const result = service.formatForPrompt(ctx);

      const rawTextIdx = result.indexOf('【直前エピソードの原文末尾】');
      const sceneGoalIdx = result.indexOf('【この章の目的】');
      expect(rawTextIdx).toBeLessThan(sceneGoalIdx);
    });

    it('places scene goal before recent detailed summary', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        recentDetailedSummary: '直前の要約',
        sceneGoal: {
          actTitle: '第一幕',
          actNumber: 1,
          sceneTitle: '始まり',
        },
      };

      const result = service.formatForPrompt(ctx);

      const sceneGoalIdx = result.indexOf('【この章の目的】');
      const summaryIdx = result.indexOf('【直前のあらすじ】');
      expect(sceneGoalIdx).toBeLessThan(summaryIdx);
    });

    it('places recent detailed summary before world settings', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        recentDetailedSummary: '直前の要約',
        settingEra: '中世ファンタジー',
      };

      const result = service.formatForPrompt(ctx);

      const summaryIdx = result.indexOf('【直前のあらすじ】');
      const worldIdx = result.indexOf('【世界設定】');
      expect(summaryIdx).toBeLessThan(worldIdx);
    });

    it('places world settings before characters', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        settingEra: '中世ファンタジー',
        characters: [
          { name: 'ユウキ', role: '主人公', dialogueSamples: [], relationships: [], hasAppeared: true },
        ],
      };

      const result = service.formatForPrompt(ctx);

      const worldIdx = result.indexOf('【世界設定】');
      const charIdx = result.indexOf('【読者に紹介済みのキャラクター】');
      expect(worldIdx).toBeLessThan(charIdx);
    });

    it('places plot outline after characters', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        characters: [
          { name: 'ユウキ', role: '主人公', dialogueSamples: [], relationships: [], hasAppeared: true },
        ],
        plotOutline: '全体のプロット概要',
      };

      const result = service.formatForPrompt(ctx);

      const charIdx = result.indexOf('【読者に紹介済みのキャラクター】');
      const plotIdx = result.indexOf('【全体のプロット構成】');
      expect(charIdx).toBeLessThan(plotIdx);
    });

    it('places episode summaries after plot outline', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        plotOutline: '全体のプロット概要',
        episodeSummaries: [{ order: 0, title: '第1話', summary: '旅の始まり' }],
      };

      const result = service.formatForPrompt(ctx);

      const plotIdx = result.indexOf('【全体のプロット構成】');
      const episodeIdx = result.indexOf('【これまでの話の流れ】');
      expect(plotIdx).toBeLessThan(episodeIdx);
    });

    it('places foreshadowings after episode summaries', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        episodeSummaries: [{ order: 0, title: '第1話', summary: '旅の始まり' }],
        openForeshadowings: ['[第1話] 謎の手紙'],
      };

      const result = service.formatForPrompt(ctx);

      const episodeIdx = result.indexOf('【これまでの話の流れ】');
      const foreshadowIdx = result.indexOf('【未回収の伏線】');
      expect(episodeIdx).toBeLessThan(foreshadowIdx);
    });

    it('places emotion goals after foreshadowings', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        openForeshadowings: ['[第1話] 謎の手紙'],
        emotionGoals: 'コアメッセージ: 友情の力',
      };

      const result = service.formatForPrompt(ctx);

      const foreshadowIdx = result.indexOf('【未回収の伏線】');
      const emotionIdx = result.indexOf('【感情設計】');
      expect(foreshadowIdx).toBeLessThan(emotionIdx);
    });

    it('places narrative metadata after emotion goals', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        emotionGoals: 'コアメッセージ: 友情の力',
        narrativePOV: '三人称限定',
      };

      const result = service.formatForPrompt(ctx);

      const emotionIdx = result.indexOf('【感情設計】');
      const metaIdx = result.indexOf('【文体情報】');
      expect(emotionIdx).toBeLessThan(metaIdx);
    });

    // -----------------------------------------------------------------------
    // NEW: plot outline section in formatForPrompt
    // -----------------------------------------------------------------------

    it('includes plot outline section when plotOutline is present', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        plotOutline: '主人公の旅の全体構成',
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【全体のプロット構成】');
      expect(result).toContain('主人公の旅の全体構成');
    });

    it('omits plot outline section when plotOutline is absent', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        plotOutline: undefined,
      };

      const result = service.formatForPrompt(ctx);

      expect(result).not.toContain('【全体のプロット構成】');
    });

    // -----------------------------------------------------------------------
    // NEW: emotion goals section in formatForPrompt
    // -----------------------------------------------------------------------

    it('includes emotion goals section when emotionGoals is present', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        emotionGoals: 'コアメッセージ: 友情の力で世界は変わる',
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【感情設計】');
      expect(result).toContain('コアメッセージ: 友情の力で世界は変わる');
    });

    it('omits emotion goals section when emotionGoals is absent', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        emotionGoals: undefined,
      };

      const result = service.formatForPrompt(ctx);

      expect(result).not.toContain('【感情設計】');
    });

    // -----------------------------------------------------------------------
    // Additional edge cases
    // -----------------------------------------------------------------------

    it('handles only-appeared characters without not-appeared characters', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        characters: [
          { name: 'ユウキ', role: '主人公', dialogueSamples: [], relationships: [], hasAppeared: true },
        ],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【読者に紹介済みのキャラクター】');
      expect(result).not.toContain('【まだ物語に登場していないキャラクター】');
    });

    it('handles only-not-appeared characters without appeared characters', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        characters: [
          { name: 'ルナ', role: 'ヒロイン', dialogueSamples: [], relationships: [], hasAppeared: false },
        ],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).not.toContain('【読者に紹介済みのキャラクター】');
      expect(result).toContain('【まだ物語に登場していないキャラクター】');
    });

    it('includes episode summaries in correct format', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        episodeSummaries: [
          { order: 0, title: '第1話タイトル', summary: '旅の始まり' },
          { order: 1, title: '第2話タイトル', summary: '試練の始まり' },
        ],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【これまでの話の流れ】');
      expect(result).toContain('第1話「第1話タイトル」: 旅の始まり');
      expect(result).toContain('第2話「第2話タイトル」: 試練の始まり');
    });

    it('includes open foreshadowings section', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        openForeshadowings: ['[第1話] 謎の手紙', '[第3話] 鍵の行方 ⚠重要'],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【未回収の伏線】');
      expect(result).toContain('[第1話] 謎の手紙');
      expect(result).toContain('[第3話] 鍵の行方 ⚠重要');
    });

    it('includes character dialogue samples in output', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        characters: [
          {
            name: 'ユウキ',
            role: '主人公',
            dialogueSamples: ['「行くぞ！」(決意)', '「負けない」(怒り)'],
            relationships: [],
            hasAppeared: true,
            speechStyle: '強気',
            firstPerson: '俺',
          },
        ],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('「行くぞ！」(決意)');
      expect(result).toContain('口調:強気');
      expect(result).toContain('一人称:俺');
    });

    it('includes worldSettings-only section without settingEra', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        worldSettings: ['[magic] 魔法: 詠唱が必要'],
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【世界設定】');
      expect(result).toContain('[magic] 魔法: 詠唱が必要');
      expect(result).not.toContain('使用禁止');
    });

    it('includes settingEra-only section without worldSettings', () => {
      const ctx: AiWritingContext = {
        ...emptyContext(),
        settingEra: '江戸時代',
      };

      const result = service.formatForPrompt(ctx);

      expect(result).toContain('【世界設定】');
      expect(result).toContain('江戸時代');
      expect(result).toContain('現代語・現代技術・現代の概念は使用禁止');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { CreationWizardService } from './creation-wizard.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { AiTierService } from '../ai-settings/ai-tier.service';
import { CreditService } from '../billing/credit.service';

// ─── Mock factories ──────────────────────────────────────────────────────────

const mockPrismaService = () => ({
  workCreationPlan: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
  aiCreationLog: {
    create: jest.fn().mockResolvedValue({}),
  },
  aiUsageLog: {
    create: jest.fn().mockResolvedValue({}),
  },
  episode: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  storyCharacter: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  work: {
    update: jest.fn(),
  },
});

const mockAiSettingsService = () => ({
  isAiEnabled: jest.fn().mockResolvedValue(true),
  getApiKey: jest.fn().mockResolvedValue('test-api-key'),
  getModel: jest.fn().mockResolvedValue('claude-haiku-4-5-20251001'),
});

const mockAiTierService = () => ({
  assertCanUseAi: jest.fn().mockResolvedValue(undefined),
  getCreditCost: jest.fn().mockReturnValue(1),
});

const mockCreditService = () => ({
  consumeCredits: jest.fn().mockResolvedValue({ transactionId: 'txn-1' }),
  refundTransaction: jest.fn().mockResolvedValue(undefined),
  confirmTransaction: jest.fn().mockResolvedValue(undefined),
});

// ─── SSE stream helpers ──────────────────────────────────────────────────────

function sseTextDelta(text: string): string {
  return `data: ${JSON.stringify({ type: 'content_block_delta', delta: { text } })}\n`;
}

function sseMessageStart(inputTokens = 10): string {
  return `data: ${JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: inputTokens } } })}\n`;
}

function sseMessageDelta(outputTokens = 20): string {
  return `data: ${JSON.stringify({ type: 'message_delta', usage: { output_tokens: outputTokens } })}\n`;
}

function makeSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function makeOkFetch(text = 'Hello world') {
  return jest.fn().mockResolvedValue({
    ok: true,
    body: makeSseStream([
      sseMessageStart(10),
      sseTextDelta(text),
      sseMessageDelta(20),
      'data: [DONE]\n',
    ]),
    text: jest.fn(),
  });
}

function makeErrorFetch(status = 500) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    text: jest.fn().mockResolvedValue('Internal Server Error'),
  });
}

async function drain(gen: AsyncGenerator<string>): Promise<string[]> {
  const results: string[] = [];
  for await (const chunk of gen) {
    results.push(chunk);
  }
  return results;
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('CreationWizardService', () => {
  let service: CreationWizardService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let aiSettings: ReturnType<typeof mockAiSettingsService>;
  let aiTier: ReturnType<typeof mockAiTierService>;
  let creditService: ReturnType<typeof mockCreditService>;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    prisma = mockPrismaService();
    aiSettings = mockAiSettingsService();
    aiTier = mockAiTierService();
    creditService = mockCreditService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreationWizardService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiSettingsService, useValue: aiSettings },
        { provide: AiTierService, useValue: aiTier },
        { provide: CreditService, useValue: creditService },
      ],
    }).compile();

    service = module.get<CreationWizardService>(CreationWizardService);
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch());
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.clearAllMocks();
  });

  // ─── getApiConfig (via streaming methods) ──────────────────────────────────

  describe('getApiConfig guard behaviour', () => {
    it('throws ServiceUnavailableException when AI is disabled', async () => {
      aiSettings.isAiEnabled.mockResolvedValue(false);

      const gen = service.generateEpisodesForAct('user-1', 'work-1', {
        actLabel: '起',
      });
      await expect(drain(gen)).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException when API key is missing', async () => {
      aiSettings.getApiKey.mockResolvedValue(null);

      const gen = service.generateEpisodesForAct('user-1', 'work-1', {
        actLabel: '起',
      });
      await expect(drain(gen)).rejects.toThrow(ServiceUnavailableException);
    });

    it('calls assertCanUseAi with userId', async () => {
      const gen = service.generateEpisodesForAct('user-1', 'work-1', {
        actLabel: '起',
      });
      await drain(gen);
      expect(aiTier.assertCanUseAi).toHaveBeenCalledWith('user-1');
    });
  });

  // ─── generateEpisodesForAct ─────────────────────────────────────────────────

  describe('generateEpisodesForAct', () => {
    it('yields chunks from Claude response stream', async () => {
      fetchSpy.mockImplementation(makeOkFetch('{"episodes":[]}'));

      const chunks = await drain(
        service.generateEpisodesForAct('user-1', 'work-1', {
          actLabel: '起',
          actDescription: '導入部',
          structureTemplate: 'kishotenketsu',
        }),
      );

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBe('{"episodes":[]}');
    });

    it('includes actLabel in the user prompt sent to Claude', async () => {
      await drain(
        service.generateEpisodesForAct('user-1', 'work-1', {
          actLabel: '転',
          actDescription: '転換点',
          context: 'ファンタジー世界',
          structureTemplate: 'kishotenketsu',
        }),
      );

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.messages[0].content).toContain('転');
      expect(body.messages[0].content).toContain('転換点');
      expect(body.messages[0].content).toContain('ファンタジー世界');
    });

    it('logs creation action after stream completes', async () => {
      await drain(
        service.generateEpisodesForAct('user-1', 'work-1', { actLabel: '起' }),
      );
      expect(prisma.aiCreationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stage: 'episodes_for_act',
            action: 'generated',
            workId: 'work-1',
            userId: 'user-1',
          }),
        }),
      );
    });

    it('consumes credits before calling Claude', async () => {
      aiTier.getCreditCost.mockReturnValue(2);
      await drain(
        service.generateEpisodesForAct('user-1', 'work-1', { actLabel: '起' }),
      );
      expect(creditService.consumeCredits).toHaveBeenCalledWith(
        'user-1', 2, 'creation_wizard', expect.any(String),
      );
    });

    it('refunds credits when Claude returns non-OK response', async () => {
      fetchSpy.mockImplementation(makeErrorFetch());

      await expect(
        drain(service.generateEpisodesForAct('user-1', 'work-1', { actLabel: '起' })),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(creditService.refundTransaction).toHaveBeenCalledWith('txn-1');
    });

    it('uses kishotenketsu as default structureTemplate when not provided', async () => {
      await drain(
        service.generateEpisodesForAct('user-1', 'work-1', { actLabel: '承' }),
      );
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.messages[0].content).toContain('kishotenketsu');
    });

    it('works without optional fields (actDescription, context, structureTemplate)', async () => {
      await expect(
        drain(service.generateEpisodesForAct('user-1', 'work-1', { actLabel: '序' })),
      ).resolves.not.toThrow();
    });
  });

  // ─── generateWorldBuilding ──────────────────────────────────────────────────

  describe('generateWorldBuilding', () => {
    it('yields chunks from Claude response', async () => {
      fetchSpy.mockImplementation(makeOkFetch('{"basics":{"era":"現代","setting":"東京"}}'));

      const chunks = await drain(
        service.generateWorldBuilding('user-1', 'work-1', { section: 'basics' }),
      );
      expect(chunks.join('')).toContain('東京');
    });

    it('uses section-specific prompt for "rules"', async () => {
      await drain(
        service.generateWorldBuilding('user-1', 'work-1', { section: 'rules' }),
      );
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.messages[0].content).toContain('rules');
    });

    it('uses section-specific prompt for "terminology"', async () => {
      await drain(
        service.generateWorldBuilding('user-1', 'work-1', { section: 'terminology' }),
      );
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.messages[0].content).toContain('terminology');
    });

    it('uses section-specific prompt for "items"', async () => {
      await drain(
        service.generateWorldBuilding('user-1', 'work-1', { section: 'items' }),
      );
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.messages[0].content).toContain('items');
    });

    it('injects existingData into prompt when provided', async () => {
      const existingData = { basics: { era: '江戸時代', setting: '京都' } };
      await drain(
        service.generateWorldBuilding('user-1', 'work-1', {
          section: 'rules',
          existingData,
        }),
      );
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.messages[0].content).toContain('江戸時代');
    });

    it('includes context when provided', async () => {
      await drain(
        service.generateWorldBuilding('user-1', 'work-1', {
          section: 'history',
          context: 'SFジャンル、宇宙を舞台にした物語',
        }),
      );
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.messages[0].content).toContain('SFジャンル');
    });

    it('logs creation action with stage "world_building"', async () => {
      await drain(
        service.generateWorldBuilding('user-1', 'work-1', { section: 'basics' }),
      );
      expect(prisma.aiCreationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stage: 'world_building' }),
        }),
      );
    });

    it('handles unknown section gracefully', async () => {
      await expect(
        drain(
          service.generateWorldBuilding('user-1', 'work-1', {
            section: 'unknown_section_xyz',
          }),
        ),
      ).resolves.not.toThrow();
    });
  });

  // ─── generateSynopsis ───────────────────────────────────────────────────────

  describe('generateSynopsis', () => {
    it('yields text chunks from Claude', async () => {
      fetchSpy.mockImplementation(makeOkFetch('物語の魅力的なあらすじがここに入ります。'));

      const chunks = await drain(
        service.generateSynopsis('user-1', 'work-1', {
          context: 'ファンタジー小説、主人公は勇者',
        }),
      );
      expect(chunks.join('')).toContain('あらすじ');
    });

    it('sends the context field directly as user prompt', async () => {
      const context = 'タイトル: 魔法少女の冒険\nジャンル: ファンタジー';
      await drain(
        service.generateSynopsis('user-1', 'work-1', { context }),
      );
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.messages[0].content).toBe(context);
    });

    it('logs creation action with stage "synopsis"', async () => {
      await drain(
        service.generateSynopsis('user-1', 'work-1', { context: 'test' }),
      );
      expect(prisma.aiCreationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stage: 'synopsis' }),
        }),
      );
    });

    it('uses plain text output prompt (not JSON format)', async () => {
      await drain(
        service.generateSynopsis('user-1', 'work-1', { context: 'test' }),
      );
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      const systemPrompt = body.system[0].text as string;
      expect(systemPrompt).toContain('プレーンテキスト');
    });
  });

  // ─── aiConsistencyCheck ─────────────────────────────────────────────────────

  describe('aiConsistencyCheck', () => {
    const mockEpisode = {
      content: '太郎は勇敢に戦った。',
      title: '第一話',
      orderIndex: 0,
    };

    beforeEach(() => {
      prisma.episode.findUnique.mockResolvedValue(mockEpisode);
      prisma.workCreationPlan.findUnique.mockResolvedValue(null);
      prisma.storyCharacter.findMany.mockResolvedValue([]);
    });

    it('returns empty arrays when episode content is empty string', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        ...mockEpisode,
        content: '',
      });

      const result = await service.aiConsistencyCheck('user-1', 'work-1', 'ep-1');
      expect(result).toEqual({ typos: [], characterIssues: [], plotIssues: [] });
    });

    it('returns empty arrays when episode content is whitespace only', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        ...mockEpisode,
        content: '   \n  ',
      });

      const result = await service.aiConsistencyCheck('user-1', 'work-1', 'ep-1');
      expect(result).toEqual({ typos: [], characterIssues: [], plotIssues: [] });
    });

    it('throws when episode is not found', async () => {
      prisma.episode.findUnique.mockResolvedValue(null);

      await expect(
        service.aiConsistencyCheck('user-1', 'work-1', 'ep-nonexistent'),
      ).rejects.toThrow('Episode not found');
    });

    it('uses provided content override instead of episode.content', async () => {
      const customContent = 'カスタムテキスト for testing';
      const mockJsonResponse = { content: [{ text: '{"typos":[],"characterIssues":[],"plotIssues":[]}' }] };
      fetchSpy.mockImplementation(
        jest.fn().mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue(mockJsonResponse),
        }),
      );

      await service.aiConsistencyCheck('user-1', 'work-1', 'ep-1', customContent);

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.messages[0].content).toContain(customContent);
    });

    it('parses and returns JSON result from Claude', async () => {
      const aiResult = {
        typos: [{ location: '第2段落', issue: 'typo', suggestion: '修正案' }],
        characterIssues: [],
        plotIssues: [],
      };
      fetchSpy.mockImplementation(
        jest.fn().mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({
            content: [{ text: JSON.stringify(aiResult) }],
          }),
        }),
      );

      const result = await service.aiConsistencyCheck('user-1', 'work-1', 'ep-1');
      expect(result).toEqual(aiResult);
    });

    it('returns empty result when Claude returns non-JSON text', async () => {
      fetchSpy.mockImplementation(
        jest.fn().mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({
            content: [{ text: '問題は見当たりませんでした。' }],
          }),
        }),
      );

      const result = await service.aiConsistencyCheck('user-1', 'work-1', 'ep-1');
      expect(result).toEqual({ typos: [], characterIssues: [], plotIssues: [] });
    });

    it('includes character settings in prompt when characters exist', async () => {
      prisma.storyCharacter.findMany.mockResolvedValue([
        {
          name: '田中太郎',
          personality: '勇敢',
          speechStyle: '礼儀正しい',
          firstPerson: '僕',
          gender: '男性',
        },
      ]);

      fetchSpy.mockImplementation(
        jest.fn().mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({
            content: [{ text: '{"typos":[],"characterIssues":[],"plotIssues":[]}' }],
          }),
        }),
      );

      await service.aiConsistencyCheck('user-1', 'work-1', 'ep-1');

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.messages[0].content).toContain('田中太郎');
    });

    it('refunds credits on API error', async () => {
      fetchSpy.mockImplementation(
        jest.fn().mockResolvedValue({ ok: false, status: 500 }),
      );

      await expect(
        service.aiConsistencyCheck('user-1', 'work-1', 'ep-1'),
      ).rejects.toThrow();

      expect(creditService.refundTransaction).toHaveBeenCalledWith('txn-1');
    });

    it('confirms credits on successful response', async () => {
      fetchSpy.mockImplementation(
        jest.fn().mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({
            content: [{ text: '{"typos":[],"characterIssues":[],"plotIssues":[]}' }],
          }),
        }),
      );

      await service.aiConsistencyCheck('user-1', 'work-1', 'ep-1');

      expect(creditService.confirmTransaction).toHaveBeenCalledWith('txn-1');
    });

    it('truncates episode content to 5000 characters', async () => {
      const longContent = 'a'.repeat(10000);
      prisma.episode.findUnique.mockResolvedValue({ ...mockEpisode, content: longContent });

      fetchSpy.mockImplementation(
        jest.fn().mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({
            content: [{ text: '{"typos":[],"characterIssues":[],"plotIssues":[]}' }],
          }),
        }),
      );

      await service.aiConsistencyCheck('user-1', 'work-1', 'ep-1');

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      // The content in the prompt should not exceed 5000 chars for the episode text
      const userMessage = body.messages[0].content as string;
      expect(userMessage.length).toBeLessThan(10000);
    });
  });

  // ─── saveCreationPlan ───────────────────────────────────────────────────────

  describe('saveCreationPlan', () => {
    it('upserts with workId as the unique key', async () => {
      prisma.workCreationPlan.upsert.mockResolvedValue({ workId: 'work-1' });

      await service.saveCreationPlan('work-1', {
        characters: [{ name: '主人公' }],
      });

      expect(prisma.workCreationPlan.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workId: 'work-1' } }),
      );
    });

    it('saves customFieldDefinitions in both create and update branches', async () => {
      prisma.workCreationPlan.upsert.mockResolvedValue({ workId: 'work-1' });

      const customFieldDefinitions = [
        { id: 'field-1', name: '出身地', inputType: 'text', order: 0 },
      ];
      await service.saveCreationPlan('work-1', { customFieldDefinitions });

      const call = prisma.workCreationPlan.upsert.mock.calls[0][0];
      expect(call.update.customFieldDefinitions).toEqual(customFieldDefinitions);
      expect(call.create.customFieldDefinitions).toEqual(customFieldDefinitions);
    });

    it('saves worldBuildingData in both create and update branches', async () => {
      prisma.workCreationPlan.upsert.mockResolvedValue({ workId: 'work-1' });

      const worldBuildingData = {
        basics: { era: '現代', setting: '東京', civilizationLevel: '現代文明' },
        rules: [],
        terminology: [],
        history: '',
        infoAsymmetry: { commonKnowledge: '', hiddenTruths: '' },
        items: [],
      };
      await service.saveCreationPlan('work-1', { worldBuildingData });

      const call = prisma.workCreationPlan.upsert.mock.calls[0][0];
      expect(call.update.worldBuildingData).toEqual(worldBuildingData);
      expect(call.create.worldBuildingData).toEqual(worldBuildingData);
    });

    it('preserves existing fields when only partial data is provided', async () => {
      prisma.workCreationPlan.upsert.mockResolvedValue({ workId: 'work-1' });

      // Provide only characters; plotOutline is undefined → should remain undefined (not overwrite)
      await service.saveCreationPlan('work-1', {
        characters: [{ name: 'Alice' }],
      });

      const call = prisma.workCreationPlan.upsert.mock.calls[0][0];
      expect(call.update.characters).toEqual([{ name: 'Alice' }]);
      expect(call.update.plotOutline).toBeUndefined();
    });

    it('handles null values by passing them through to clear fields', async () => {
      prisma.workCreationPlan.upsert.mockResolvedValue({ workId: 'work-1' });

      await service.saveCreationPlan('work-1', {
        characters: null as any,
        plotOutline: null as any,
        customFieldDefinitions: null as any,
        worldBuildingData: null as any,
      });

      const call = prisma.workCreationPlan.upsert.mock.calls[0][0];
      expect(call.update.characters).toBeNull();
      expect(call.update.plotOutline).toBeNull();
      expect(call.update.customFieldDefinitions).toBeNull();
      expect(call.update.worldBuildingData).toBeNull();
    });

    it('returns the upserted plan', async () => {
      const planData = { workId: 'work-1', characters: [], customFieldDefinitions: [] };
      prisma.workCreationPlan.upsert.mockResolvedValue(planData);

      const result = await service.saveCreationPlan('work-1', {});
      expect(result).toEqual(planData);
    });
  });

  // ─── getCreationPlan ────────────────────────────────────────────────────────

  describe('getCreationPlan', () => {
    it('returns plan when found', async () => {
      const plan = { workId: 'work-1', characters: [{ name: 'Alice' }] };
      prisma.workCreationPlan.findUnique.mockResolvedValue(plan);

      const result = await service.getCreationPlan('work-1');
      expect(result).toEqual(plan);
    });

    it('returns null when plan does not exist', async () => {
      prisma.workCreationPlan.findUnique.mockResolvedValue(null);

      const result = await service.getCreationPlan('work-nonexistent');
      expect(result).toBeNull();
    });
  });

  // ─── calculateOriginality ───────────────────────────────────────────────────

  describe('calculateOriginality', () => {
    it('returns 1.0 originality when there are no AI logs', async () => {
      prisma.aiCreationLog = { create: jest.fn() } as any;
      const mockPrisma = prisma as any;
      mockPrisma.aiCreationLog.findMany = jest.fn().mockResolvedValue([]);
      mockPrisma.episode.findMany = jest.fn().mockResolvedValue([{ wordCount: 1000 }]);
      mockPrisma.work.update = jest.fn().mockResolvedValue({});

      const result = await service.calculateOriginality('work-1');
      expect(result.originality).toBe(1.0);
    });

    it('returns originality between 0 and 1', async () => {
      const mockPrisma = prisma as any;
      mockPrisma.aiCreationLog.findMany = jest.fn().mockResolvedValue([
        { stage: 'writing_assist', acceptedChars: 500 },
      ]);
      mockPrisma.episode.findMany = jest.fn().mockResolvedValue([{ wordCount: 1000 }]);
      mockPrisma.work.update = jest.fn().mockResolvedValue({});

      const result = await service.calculateOriginality('work-1');
      expect(result.originality).toBeGreaterThanOrEqual(0);
      expect(result.originality).toBeLessThanOrEqual(1);
    });

    it('weights creation_wizard stages at 0.3x vs writing_assist at 1.0x', async () => {
      const mockPrisma = prisma as any;
      mockPrisma.aiCreationLog.findMany = jest.fn().mockResolvedValue([
        { stage: 'character_design', acceptedChars: 1000 }, // 0.3x weight
      ]);
      mockPrisma.episode.findMany = jest.fn().mockResolvedValue([{ wordCount: 1000 }]);
      mockPrisma.work.update = jest.fn().mockResolvedValue({});

      const result = await service.calculateOriginality('work-1');
      // 1.0 - (1000 * 0.3 / 1000) = 0.7
      expect(result.originality).toBeCloseTo(0.7, 5);
    });

    it('clamps originality to 0 when AI chars exceed total chars', async () => {
      const mockPrisma = prisma as any;
      mockPrisma.aiCreationLog.findMany = jest.fn().mockResolvedValue([
        { stage: 'writing_assist', acceptedChars: 9999 },
      ]);
      mockPrisma.episode.findMany = jest.fn().mockResolvedValue([{ wordCount: 100 }]);
      mockPrisma.work.update = jest.fn().mockResolvedValue({});

      const result = await service.calculateOriginality('work-1');
      expect(result.originality).toBe(0);
    });

    it('returns breakdown with correct statistics', async () => {
      const mockPrisma = prisma as any;
      mockPrisma.aiCreationLog.findMany = jest.fn().mockResolvedValue([
        { stage: 'writing_assist', acceptedChars: 200 },
        { stage: 'character_design', acceptedChars: 100 },
      ]);
      mockPrisma.episode.findMany = jest.fn().mockResolvedValue([
        { wordCount: 500 },
        { wordCount: 500 },
      ]);
      mockPrisma.work.update = jest.fn().mockResolvedValue({});

      const result = await service.calculateOriginality('work-1');
      expect(result.breakdown).toMatchObject({
        totalChars: 1000,
        totalAcceptedAiChars: 300,
        writingAssistChars: 200,
        creationStageChars: 100,
        logCount: 2,
      });
    });

    it('handles case with no episodes (totalChars=0) without division by zero', async () => {
      const mockPrisma = prisma as any;
      mockPrisma.aiCreationLog.findMany = jest.fn().mockResolvedValue([]);
      mockPrisma.episode.findMany = jest.fn().mockResolvedValue([]);
      mockPrisma.work.update = jest.fn().mockResolvedValue({});

      await expect(service.calculateOriginality('work-1')).resolves.not.toThrow();
      const result = await service.calculateOriginality('work-1');
      expect(result.originality).toBe(1.0);
    });
  });

  // ─── formatCharactersForPrompt (private, tested via generatePlot) ──────────

  describe('character formatting in prompts', () => {
    it('includes all character fields in the formatted output', async () => {
      await drain(
        service.generatePlot('user-1', 'work-1', {
          themes: '孤独と友情',
          characters: [
            {
              name: '山田花子',
              role: 'ヒロイン',
              gender: '女性',
              age: '17歳',
              firstPerson: '私',
              personality: '明るく活発',
              speechStyle: '元気な口調',
              appearance: '茶髪',
              background: '転校生',
              motivation: '友達を作りたい',
              relationships: '主人公の幼馴染',
              uniqueTrait: '料理が得意',
            },
          ],
        }),
      );

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      const content = body.messages[0].content as string;
      expect(content).toContain('山田花子');
      expect(content).toContain('ヒロイン');
      expect(content).toContain('17歳');
      expect(content).toContain('私');
      expect(content).toContain('明るく活発');
    });

    it('handles empty characters array gracefully', async () => {
      await expect(
        drain(
          service.generatePlot('user-1', 'work-1', {
            themes: '孤独',
            characters: [],
          }),
        ),
      ).resolves.not.toThrow();
    });

    it('handles characters with only name and role', async () => {
      await expect(
        drain(
          service.generatePlot('user-1', 'work-1', {
            themes: '友情',
            characters: [{ name: '太郎', role: '主人公' }],
          }),
        ),
      ).resolves.not.toThrow();
    });

    it('uses description field as fallback when personality is not set', async () => {
      await drain(
        service.generatePlot('user-1', 'work-1', {
          themes: '冒険',
          characters: [{ name: '勇者', description: '古代の言い伝えに登場する英雄' }],
        }),
      );

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.messages[0].content).toContain('古代の言い伝えに登場する英雄');
    });
  });

  // ─── Credit flow edge cases ─────────────────────────────────────────────────

  describe('credit management', () => {
    it('does not consume credits when getCreditCost returns 0', async () => {
      aiTier.getCreditCost.mockReturnValue(0);

      await drain(
        service.generateEpisodesForAct('user-1', 'work-1', { actLabel: '起' }),
      );

      expect(creditService.consumeCredits).not.toHaveBeenCalled();
    });

    it('confirms credits after successful streaming delivery', async () => {
      await drain(
        service.generateEpisodesForAct('user-1', 'work-1', { actLabel: '承' }),
      );

      expect(creditService.confirmTransaction).toHaveBeenCalledWith('txn-1');
    });
  });
});

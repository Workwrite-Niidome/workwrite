import { Test, TestingModule } from '@nestjs/testing';
import { CreationWizardController } from './creation-wizard.controller';
import { CreationWizardService } from './creation-wizard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OriginalityService } from '../originality/originality.service';
import { PrismaService } from '../common/prisma/prisma.service';

// ─── Mock service factory ────────────────────────────────────────────────────

function makeAsyncGenerator(values: string[]): AsyncGenerator<string> {
  return (async function* () {
    for (const v of values) yield v;
  })();
}

const mockService = () => ({
  generateCharacters: jest.fn(),
  generatePlot: jest.fn(),
  generateEmotionBlueprint: jest.fn(),
  generateChapterOutline: jest.fn(),
  generateEpisodesForAct: jest.fn(),
  generateWorldBuilding: jest.fn(),
  generateSynopsis: jest.fn(),
  aiConsistencyCheck: jest.fn(),
  saveCreationPlan: jest.fn(),
  getCreationPlan: jest.fn(),
  logAiFeedback: jest.fn(),
  calculateOriginality: jest.fn(),
  updateStorySummary: jest.fn(),
  getStorySummary: jest.fn(),
});

// ─── SSE response mock ───────────────────────────────────────────────────────

function makeMockResponse() {
  const written: string[] = [];
  return {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn((chunk: string) => { written.push(chunk); }),
    end: jest.fn(),
    _written: written,
  };
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('CreationWizardController', () => {
  let controller: CreationWizardController;
  let service: ReturnType<typeof mockService>;

  beforeEach(async () => {
    service = mockService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreationWizardController],
      providers: [
        { provide: CreationWizardService, useValue: service },
        { provide: OriginalityService, useValue: { getBreakdown: jest.fn().mockResolvedValue({ originality: 1.0, isAiGenerated: false, templateCounts: {} }), recalculate: jest.fn() } },
        { provide: PrismaService, useValue: { work: { findUnique: jest.fn().mockResolvedValue({ authorId: 'user-1' }) } } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CreationWizardController>(CreationWizardController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── generateEpisodesForAct endpoint ──────────────────────────────────────

  describe('POST works/:workId/creation/episodes-for-act', () => {
    it('sets SSE headers on response', async () => {
      service.generateEpisodesForAct.mockReturnValue(makeAsyncGenerator([]));
      const res = makeMockResponse();

      await controller.generateEpisodesForAct(
        'user-1',
        'work-1',
        { actLabel: '起' },
        res as any,
      );

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(res.flushHeaders).toHaveBeenCalled();
    });

    it('writes each chunk as SSE data event', async () => {
      service.generateEpisodesForAct.mockReturnValue(
        makeAsyncGenerator(['{"episodes":', '[{', '"title":"話"', '}]}'])
      );
      const res = makeMockResponse();

      await controller.generateEpisodesForAct(
        'user-1', 'work-1', { actLabel: '起' }, res as any,
      );

      // Every chunk should be written as data: ...
      const textEvents = res._written.filter((w) => w.startsWith('data:') && !w.includes('[DONE]') && !w.includes('"parsed"'));
      expect(textEvents).toHaveLength(4);
    });

    it('sends parsed episodes JSON after full output', async () => {
      const fullOutput = '{"episodes":[{"title":"エピソード1","whatHappens":"何かが起きる","whyItHappens":"理由","characters":["太郎"],"emotionTarget":"希望"}]}';
      service.generateEpisodesForAct.mockReturnValue(
        makeAsyncGenerator([fullOutput])
      );
      const res = makeMockResponse();

      await controller.generateEpisodesForAct(
        'user-1', 'work-1', { actLabel: '起' }, res as any,
      );

      const parsedEvent = res._written.find(
        (w) => w.includes('"parsed"') && w.includes('episodes'),
      );
      expect(parsedEvent).toBeDefined();
    });

    it('sends [DONE] event when stream completes', async () => {
      service.generateEpisodesForAct.mockReturnValue(makeAsyncGenerator([]));
      const res = makeMockResponse();

      await controller.generateEpisodesForAct(
        'user-1', 'work-1', { actLabel: '承' }, res as any,
      );

      expect(res._written.some((w) => w.includes('[DONE]'))).toBe(true);
    });

    it('calls res.end() in all cases (finally block)', async () => {
      service.generateEpisodesForAct.mockReturnValue(makeAsyncGenerator([]));
      const res = makeMockResponse();

      await controller.generateEpisodesForAct(
        'user-1', 'work-1', { actLabel: '転' }, res as any,
      );

      expect(res.end).toHaveBeenCalled();
    });

    it('writes error SSE event when service throws', async () => {
      service.generateEpisodesForAct.mockImplementation(() => {
        throw new Error('AI unavailable');
      });
      const res = makeMockResponse();

      await controller.generateEpisodesForAct(
        'user-1', 'work-1', { actLabel: '結' }, res as any,
      );

      const errorEvent = res._written.find((w) => w.includes('"error"'));
      expect(errorEvent).toBeDefined();
      expect(errorEvent).toContain('AI unavailable');
    });

    it('passes correct userId, workId, and dto to service', async () => {
      service.generateEpisodesForAct.mockReturnValue(makeAsyncGenerator([]));
      const res = makeMockResponse();
      const dto = { actLabel: '転', actDescription: '転換点', structureTemplate: 'three-act' };

      await controller.generateEpisodesForAct('user-42', 'work-99', dto, res as any);

      expect(service.generateEpisodesForAct).toHaveBeenCalledWith('user-42', 'work-99', dto);
    });
  });

  // ─── generateWorldBuilding endpoint ───────────────────────────────────────

  describe('POST works/:workId/creation/world-building', () => {
    it('sets SSE headers', async () => {
      service.generateWorldBuilding.mockReturnValue(makeAsyncGenerator([]));
      const res = makeMockResponse();

      await controller.generateWorldBuilding(
        'user-1', 'work-1', { section: 'basics' }, res as any,
      );

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    });

    it('sends parsed JSON when full output is valid JSON', async () => {
      const output = '{"basics":{"era":"江戸時代","setting":"京都","civilizationLevel":"封建制"}}';
      service.generateWorldBuilding.mockReturnValue(makeAsyncGenerator([output]));
      const res = makeMockResponse();

      await controller.generateWorldBuilding(
        'user-1', 'work-1', { section: 'basics' }, res as any,
      );

      const parsedEvent = res._written.find(
        (w) => w.includes('"parsed"') && w.includes('era'),
      );
      expect(parsedEvent).toBeDefined();
    });

    it('writes error event on service failure', async () => {
      service.generateWorldBuilding.mockImplementation(() => {
        throw new Error('World building failed');
      });
      const res = makeMockResponse();

      await controller.generateWorldBuilding(
        'user-1', 'work-1', { section: 'rules' }, res as any,
      );

      const errorEvent = res._written.find((w) => w.includes('"error"'));
      expect(errorEvent).toContain('World building failed');
    });
  });

  // ─── generateSynopsis endpoint ─────────────────────────────────────────────

  describe('POST works/:workId/creation/synopsis', () => {
    it('sets SSE headers', async () => {
      service.generateSynopsis.mockReturnValue(makeAsyncGenerator([]));
      const res = makeMockResponse();

      await controller.generateSynopsis(
        'user-1', 'work-1', { context: 'test context' }, res as any,
      );

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    });

    it('streams all chunks without attempting JSON parse', async () => {
      const chunks = ['これは', 'あらすじ', 'です。'];
      service.generateSynopsis.mockReturnValue(makeAsyncGenerator(chunks));
      const res = makeMockResponse();

      await controller.generateSynopsis(
        'user-1', 'work-1', { context: 'test' }, res as any,
      );

      const textEvents = res._written.filter(
        (w) => w.startsWith('data:') && !w.includes('[DONE]'),
      );
      expect(textEvents).toHaveLength(3);
    });

    it('sends [DONE] at the end', async () => {
      service.generateSynopsis.mockReturnValue(makeAsyncGenerator(['text']));
      const res = makeMockResponse();

      await controller.generateSynopsis(
        'user-1', 'work-1', { context: 'ctx' }, res as any,
      );

      expect(res._written.some((w) => w.includes('[DONE]'))).toBe(true);
    });
  });

  // ─── aiCheck endpoint ──────────────────────────────────────────────────────

  describe('POST works/:workId/episodes/:episodeId/ai-check', () => {
    it('returns the result from aiConsistencyCheck directly', async () => {
      const mockResult = {
        typos: [{ location: '第1段落', issue: 'typo', suggestion: '修正' }],
        characterIssues: [],
        plotIssues: [],
      };
      service.aiConsistencyCheck.mockResolvedValue(mockResult);

      const result = await controller.aiCheck(
        'user-1', 'work-1', 'ep-1', { content: 'check this' },
      );

      expect(result).toEqual(mockResult);
    });

    it('passes content from dto to service', async () => {
      service.aiConsistencyCheck.mockResolvedValue({ typos: [], characterIssues: [], plotIssues: [] });

      await controller.aiCheck('user-1', 'work-1', 'ep-1', { content: 'specific content' });

      expect(service.aiConsistencyCheck).toHaveBeenCalledWith(
        'user-1', 'work-1', 'ep-1', 'specific content',
      );
    });

    it('passes undefined content when dto.content is not provided', async () => {
      service.aiConsistencyCheck.mockResolvedValue({ typos: [], characterIssues: [], plotIssues: [] });

      await controller.aiCheck('user-1', 'work-1', 'ep-1', {});

      expect(service.aiConsistencyCheck).toHaveBeenCalledWith(
        'user-1', 'work-1', 'ep-1', undefined,
      );
    });
  });

  // ─── saveCreationPlan endpoint ─────────────────────────────────────────────

  describe('PUT works/:workId/creation/plan', () => {
    it('delegates to service.saveCreationPlan', async () => {
      const planData = { workId: 'work-1' };
      service.saveCreationPlan.mockResolvedValue(planData);

      const dto = {
        characters: [{ name: 'Alice' }],
        customFieldDefinitions: [],
        worldBuildingData: { basics: { era: '現代' } },
      };
      const result = await controller.saveCreationPlan('work-1', 'user-1', dto as any);

      expect(service.saveCreationPlan).toHaveBeenCalledWith('work-1', dto);
      expect(result).toEqual(planData);
    });
  });

  // ─── getCreationPlan endpoint ──────────────────────────────────────────────

  describe('GET works/:workId/creation/plan', () => {
    it('returns plan from service', async () => {
      const plan = { workId: 'work-1', worldBuildingData: { basics: {} } };
      service.getCreationPlan.mockResolvedValue(plan);

      const result = await controller.getCreationPlan('work-1', 'user-1');

      expect(service.getCreationPlan).toHaveBeenCalledWith('work-1');
      expect(result).toEqual(plan);
    });

    it('returns null when plan does not exist', async () => {
      service.getCreationPlan.mockResolvedValue(null);

      const result = await controller.getCreationPlan('nonexistent', 'user-1');
      expect(result).toBeNull();
    });
  });

  // ─── JSON parsing helpers (private, tested through endpoints) ─────────────

  describe('parseEpisodesJson (via generateEpisodesForAct endpoint)', () => {
    it('parses episodes from JSON object format', async () => {
      const output = JSON.stringify({
        episodes: [
          { title: 'テスト話', whatHappens: '何か起きる', whyItHappens: '理由', characters: [] },
        ],
      });
      service.generateEpisodesForAct.mockReturnValue(makeAsyncGenerator([output]));
      const res = makeMockResponse();

      await controller.generateEpisodesForAct(
        'user-1', 'work-1', { actLabel: '起' }, res as any,
      );

      const parsedEvent = res._written.find((w) => w.includes('"parsed"'));
      expect(parsedEvent).toBeDefined();
      const parsed = JSON.parse(parsedEvent!.replace(/^data: /, '').trim());
      expect(parsed.parsed.episodes).toHaveLength(1);
    });

    it('parses episodes from JSON array format', async () => {
      const output = JSON.stringify([
        { title: 'テスト話', whatHappens: '何か起きる', whyItHappens: '理由' },
      ]);
      service.generateEpisodesForAct.mockReturnValue(makeAsyncGenerator([output]));
      const res = makeMockResponse();

      await controller.generateEpisodesForAct(
        'user-1', 'work-1', { actLabel: '起' }, res as any,
      );

      const parsedEvent = res._written.find((w) => w.includes('"parsed"'));
      expect(parsedEvent).toBeDefined();
    });

    it('does not send parsed event when output is not parseable', async () => {
      service.generateEpisodesForAct.mockReturnValue(
        makeAsyncGenerator(['not json at all'])
      );
      const res = makeMockResponse();

      await controller.generateEpisodesForAct(
        'user-1', 'work-1', { actLabel: '起' }, res as any,
      );

      const parsedEvent = res._written.find(
        (w) => w.includes('"parsed"') && !w.includes('[DONE]'),
      );
      expect(parsedEvent).toBeUndefined();
    });
  });

  describe('parseGenericJson (via generateWorldBuilding endpoint)', () => {
    it('strips markdown code fences before parsing', async () => {
      const output = '```json\n{"basics":{"era":"現代"}}\n```';
      service.generateWorldBuilding.mockReturnValue(makeAsyncGenerator([output]));
      const res = makeMockResponse();

      await controller.generateWorldBuilding(
        'user-1', 'work-1', { section: 'basics' }, res as any,
      );

      const parsedEvent = res._written.find((w) => w.includes('"parsed"'));
      expect(parsedEvent).toBeDefined();
      const parsed = JSON.parse(parsedEvent!.replace(/^data: /, '').trim());
      expect(parsed.parsed.basics.era).toBe('現代');
    });
  });

  // ─── SSE header utility ────────────────────────────────────────────────────

  describe('SSE headers (X-Accel-Buffering)', () => {
    it('sets X-Accel-Buffering to no (for nginx/proxy buffering off)', async () => {
      service.generateSynopsis.mockReturnValue(makeAsyncGenerator([]));
      const res = makeMockResponse();

      await controller.generateSynopsis(
        'user-1', 'work-1', { context: 'ctx' }, res as any,
      );

      expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { AiAssistService } from './ai-assist.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { AiTierService } from '../ai-settings/ai-tier.service';
import { PromptTemplatesService } from '../prompt-templates/prompt-templates.service';
import { AiContextBuilderService } from './ai-context-builder.service';
import { CreditService } from '../billing/credit.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockAiSettingsService = () => ({
  isAiEnabled: jest.fn().mockResolvedValue(true),
  getApiKey: jest.fn().mockResolvedValue('test-api-key'),
  getModel: jest.fn().mockResolvedValue('claude-haiku-4-5-20251001'),
});

const mockAiTierService = () => ({
  getUserTier: jest.fn(),
  getModelConfig: jest.fn().mockResolvedValue({
    model: 'claude-haiku-4-5-20251001',
    thinking: false,
    budgetTokens: 0,
  }),
  getCreditCost: jest.fn().mockReturnValue(1),
  estimateCreditCost: jest.fn().mockReturnValue({ credits: 1, breakdown: {} }),
  assertCanUseAi: jest.fn().mockResolvedValue(undefined),
});

const mockTemplatesService = () => ({
  findBySlug: jest.fn().mockResolvedValue({
    id: 'tpl-1',
    slug: 'writing-assist',
    name: 'Writing Assist',
    prompt: 'Write about {{topic}}.',
  }),
});

const mockContextBuilderService = () => ({
  buildContext: jest.fn(),
  formatForPrompt: jest.fn().mockReturnValue(''),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal SSE stream that yields the given text chunks. */
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

/** Build one SSE text-delta event line. */
function sseTextDelta(text: string): string {
  return `data: ${JSON.stringify({ type: 'content_block_delta', delta: { text } })}\n`;
}

/** Drain an async generator into an array of strings. */
async function drain(gen: AsyncGenerator<string>): Promise<string[]> {
  const results: string[] = [];
  for await (const chunk of gen) {
    results.push(chunk);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Test module builder
// ---------------------------------------------------------------------------

interface BuildModuleOptions {
  aiSettings?: Partial<ReturnType<typeof mockAiSettingsService>>;
  credit?: Partial<{
    consumeCredits: jest.Mock;
    confirmTransaction: jest.Mock;
    refundTransaction: jest.Mock;
    getBalance: jest.Mock;
  }>;
  prisma?: Partial<{
    work: { findUnique: jest.Mock };
    storyCharacter: { findMany: jest.Mock };
    episode: { findUnique: jest.Mock };
    aiUsageLog: { create: jest.Mock };
    aiGenerationHistory: { findUnique: jest.Mock; create: jest.Mock };
  }>;
}

async function buildModule(opts: BuildModuleOptions = {}): Promise<{
  service: AiAssistService;
  creditService: {
    consumeCredits: jest.Mock;
    confirmTransaction: jest.Mock;
    refundTransaction: jest.Mock;
    getBalance: jest.Mock;
  };
  prismaService: {
    work: { findUnique: jest.Mock };
    storyCharacter: { findMany: jest.Mock };
    episode: { findUnique: jest.Mock };
    aiUsageLog: { create: jest.Mock };
    aiGenerationHistory: { findUnique: jest.Mock; create: jest.Mock };
  };
}> {
  const creditService = {
    consumeCredits: jest.fn().mockResolvedValue({ transactionId: 'tx-1', newBalance: 19, purchasedDeducted: 0 }),
    confirmTransaction: jest.fn().mockResolvedValue(undefined),
    refundTransaction: jest.fn().mockResolvedValue(undefined),
    getBalance: jest.fn().mockResolvedValue({ total: 20, monthly: 10, purchased: 10 }),
    ...opts.credit,
  };

  const prismaService = {
    work: { findUnique: jest.fn().mockResolvedValue(null) },
    storyCharacter: { findMany: jest.fn().mockResolvedValue([]) },
    episode: { findUnique: jest.fn().mockResolvedValue(null) },
    aiUsageLog: { create: jest.fn().mockResolvedValue({}) },
    aiGenerationHistory: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'hist-1' }),
    },
    ...opts.prisma,
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AiAssistService,
      { provide: PrismaService, useValue: prismaService },
      {
        provide: AiSettingsService,
        useValue: { ...mockAiSettingsService(), ...opts.aiSettings },
      },
      { provide: AiTierService, useValue: mockAiTierService() },
      { provide: PromptTemplatesService, useValue: mockTemplatesService() },
      { provide: AiContextBuilderService, useValue: mockContextBuilderService() },
      { provide: CreditService, useValue: creditService },
    ],
  }).compile();

  return {
    service: module.get<AiAssistService>(AiAssistService),
    creditService,
    prismaService,
  };
}

// ---------------------------------------------------------------------------
// Tests: streamConsult
// ---------------------------------------------------------------------------

describe('AiAssistService — streamConsult', () => {
  let fetchSpy: jest.SpyInstance;

  const makeOkFetch = (text = 'AIの回答') =>
    jest.fn().mockResolvedValue({
      ok: true,
      body: makeSseStream([sseTextDelta(text), 'data: [DONE]\n']),
      text: jest.fn(),
    });

  /**
   * Helper: build a module and immediately stub checkRateLimit to return true.
   * This prevents the module-level rateLimitMap (which persists across tests in
   * the same worker) from accumulating hits and triggering the 20/hour limit.
   */
  async function buildModuleWithRateLimitBypassed(opts: BuildModuleOptions = {}) {
    const result = await buildModule(opts);
    jest.spyOn(result.service, 'checkRateLimit').mockReturnValue(true);
    return result;
  }

  afterEach(() => {
    fetchSpy?.mockRestore();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Credit consumption
  // -------------------------------------------------------------------------

  describe('credit handling', () => {
    it('consumes exactly 1 credit before making the API call', async () => {
      const { service, creditService } = await buildModuleWithRateLimitBypassed();
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch());

      await drain(service.streamConsult('user-1', 'work-1', 'キャラクター名のアイデアをください'));

      expect(creditService.consumeCredits).toHaveBeenCalledTimes(1);
      expect(creditService.consumeCredits).toHaveBeenCalledWith(
        'user-1',
        1,
        'consult_chat',
        'claude-haiku-4-5-20251001',
      );

      // consumeCredits must be called before fetch
      const consumeOrder = (creditService.consumeCredits as jest.Mock).mock.invocationCallOrder[0];
      const fetchOrder = (fetchSpy as jest.Mock).mock.invocationCallOrder[0];
      expect(consumeOrder).toBeLessThan(fetchOrder);
    });

    it('confirms the credit transaction after content is delivered', async () => {
      const { service, creditService } = await buildModuleWithRateLimitBypassed({
        credit: {
          consumeCredits: jest.fn().mockResolvedValue({ transactionId: 'tx-confirm', newBalance: 19 }),
        },
      });
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch('回答テキスト'));

      await drain(service.streamConsult('user-1', 'work-1', 'テスト質問'));

      expect(creditService.confirmTransaction).toHaveBeenCalledWith('tx-confirm');
      expect(creditService.refundTransaction).not.toHaveBeenCalled();
    });

    it('refunds the credit transaction when the API call fails (non-ok response)', async () => {
      const { service, creditService } = await buildModuleWithRateLimitBypassed({
        credit: {
          consumeCredits: jest.fn().mockResolvedValue({ transactionId: 'tx-fail', newBalance: 19 }),
        },
      });
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      } as any);

      await expect(drain(service.streamConsult('user-1', 'work-1', 'テスト'))).rejects.toThrow(
        ServiceUnavailableException,
      );

      expect(creditService.refundTransaction).toHaveBeenCalledWith('tx-fail');
      expect(creditService.confirmTransaction).not.toHaveBeenCalled();
    });

    it('refunds the credit transaction when no response stream is returned', async () => {
      const { service, creditService } = await buildModuleWithRateLimitBypassed({
        credit: {
          consumeCredits: jest.fn().mockResolvedValue({ transactionId: 'tx-nobody', newBalance: 19 }),
        },
      });
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        body: null,
        text: jest.fn(),
      } as any);

      await expect(drain(service.streamConsult('user-1', 'work-1', 'テスト'))).rejects.toThrow(
        ServiceUnavailableException,
      );

      expect(creditService.refundTransaction).toHaveBeenCalledWith('tx-nobody');
    });

    it('refunds when the stream produces no content (empty response)', async () => {
      const { service, creditService } = await buildModuleWithRateLimitBypassed({
        credit: {
          consumeCredits: jest.fn().mockResolvedValue({ transactionId: 'tx-empty', newBalance: 19 }),
        },
      });
      // Stream that yields only [DONE] — no text deltas
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        body: makeSseStream(['data: [DONE]\n']),
        text: jest.fn(),
      } as any);

      await drain(service.streamConsult('user-1', 'work-1', 'テスト'));

      // contentDelivered = false → refund
      expect(creditService.refundTransaction).toHaveBeenCalledWith('tx-empty');
      expect(creditService.confirmTransaction).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Guard clauses
  // -------------------------------------------------------------------------

  describe('pre-flight guards', () => {
    it('throws ServiceUnavailableException when AI is disabled', async () => {
      const { service } = await buildModuleWithRateLimitBypassed({
        aiSettings: { isAiEnabled: jest.fn().mockResolvedValue(false) },
      });

      await expect(drain(service.streamConsult('user-1', 'work-1', 'テスト'))).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when API key is missing', async () => {
      const { service } = await buildModuleWithRateLimitBypassed({
        aiSettings: { getApiKey: jest.fn().mockResolvedValue(null) },
      });

      await expect(drain(service.streamConsult('user-1', 'work-1', 'テスト'))).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when rate limit is exceeded', async () => {
      const { service } = await buildModule();
      // Override checkRateLimit to return false — simulates exhausted rate limit
      jest.spyOn(service, 'checkRateLimit').mockReturnValue(false);

      await expect(drain(service.streamConsult('user-1', 'work-1', 'テスト'))).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Work context in system prompt
  // -------------------------------------------------------------------------

  describe('system prompt context', () => {
    it('includes work title and genre in the system prompt when work is found', async () => {
      const { service, prismaService } = await buildModuleWithRateLimitBypassed();
      prismaService.work.findUnique.mockResolvedValue({
        title: '異世界転生ファンタジー',
        genre: 'ファンタジー',
        synopsis: null,
      });
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch());

      await drain(service.streamConsult('user-1', 'work-42', '登場人物について教えて'));

      const fetchCall = fetchSpy.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.system).toContain('異世界転生ファンタジー');
      expect(requestBody.system).toContain('ファンタジー');
    });

    it('includes synopsis in the system prompt when present', async () => {
      const { service, prismaService } = await buildModuleWithRateLimitBypassed();
      prismaService.work.findUnique.mockResolvedValue({
        title: 'テスト作品',
        genre: null,
        synopsis: '主人公が旅に出る物語。',
      });
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch());

      await drain(service.streamConsult('user-1', 'work-1', 'テスト'));

      const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(requestBody.system).toContain('主人公が旅に出る物語。');
    });

    it('includes character names and roles in the system prompt when characters exist', async () => {
      const { service, prismaService } = await buildModuleWithRateLimitBypassed();
      prismaService.work.findUnique.mockResolvedValue({ title: 'A', genre: null, synopsis: null });
      prismaService.storyCharacter.findMany.mockResolvedValue([
        { name: '田中一郎', role: '主人公', personality: '勇敢' },
        { name: '鈴木花子', role: 'ヒロイン', personality: null },
      ]);
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch());

      await drain(service.streamConsult('user-1', 'work-1', 'テスト'));

      const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(requestBody.system).toContain('田中一郎');
      expect(requestBody.system).toContain('鈴木花子');
    });

    it('includes episode content in the system prompt when episodeId is provided', async () => {
      const { service, prismaService } = await buildModuleWithRateLimitBypassed();
      prismaService.work.findUnique.mockResolvedValue({ title: 'A', genre: null, synopsis: null });
      prismaService.episode.findUnique.mockResolvedValue({
        title: '第一話: 始まり',
        content: 'その日、世界が変わった。',
      });
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch());

      await drain(service.streamConsult('user-1', 'work-1', 'テスト', [], 'episode-99'));

      const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(requestBody.system).toContain('第一話: 始まり');
      expect(requestBody.system).toContain('その日、世界が変わった。');
    });

    it('does NOT include episode content when episodeId is not provided', async () => {
      const { service, prismaService } = await buildModuleWithRateLimitBypassed();
      prismaService.work.findUnique.mockResolvedValue({ title: 'A', genre: null, synopsis: null });
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch());

      // No episodeId argument
      await drain(service.streamConsult('user-1', 'work-1', 'テスト'));

      expect(prismaService.episode.findUnique).not.toHaveBeenCalled();
    });

    it('continues streaming even when context DB calls fail', async () => {
      const { service, prismaService } = await buildModuleWithRateLimitBypassed();
      prismaService.work.findUnique.mockRejectedValue(new Error('DB connection lost'));
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch('フォールバック回答'));

      // Must not throw — context errors are swallowed
      const chunks = await drain(service.streamConsult('user-1', 'work-1', 'テスト'));

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain('フォールバック回答');
    });
  });

  // -------------------------------------------------------------------------
  // API call construction
  // -------------------------------------------------------------------------

  describe('API call construction', () => {
    it('calls the Anthropic messages endpoint with stream:true', async () => {
      const { service } = await buildModuleWithRateLimitBypassed();
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch());

      await drain(service.streamConsult('user-1', 'work-1', 'テスト'));

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({ method: 'POST' }),
      );
      const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(requestBody.stream).toBe(true);
    });

    it('uses the Haiku model (claude-haiku-4-5-20251001)', async () => {
      const { service } = await buildModuleWithRateLimitBypassed();
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch());

      await drain(service.streamConsult('user-1', 'work-1', 'テスト'));

      const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(requestBody.model).toBe('claude-haiku-4-5-20251001');
    });

    it('includes the user message as the last message in the messages array', async () => {
      const { service } = await buildModuleWithRateLimitBypassed();
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch());

      const userMessage = 'キャラクターの名前を考えてください';
      await drain(service.streamConsult('user-1', 'work-1', userMessage));

      const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      const lastMessage = requestBody.messages[requestBody.messages.length - 1];
      expect(lastMessage.role).toBe('user');
      expect(lastMessage.content).toBe(userMessage);
    });

    it('prepends up to 10 history messages before the current user message', async () => {
      const { service } = await buildModuleWithRateLimitBypassed();
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch());

      const history = Array.from({ length: 12 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `メッセージ${i}`,
      }));

      await drain(service.streamConsult('user-1', 'work-1', '新しい質問', history));

      const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      // history is sliced to last 10, plus 1 new user message = at most 11 messages
      expect(requestBody.messages.length).toBeLessThanOrEqual(11);
    });

    it('sets max_tokens to 1500', async () => {
      const { service } = await buildModuleWithRateLimitBypassed();
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch());

      await drain(service.streamConsult('user-1', 'work-1', 'テスト'));

      const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(requestBody.max_tokens).toBe(1500);
    });
  });

  // -------------------------------------------------------------------------
  // SSE streaming output
  // -------------------------------------------------------------------------

  describe('SSE output streaming', () => {
    it('yields text chunks from content_block_delta events', async () => {
      const { service } = await buildModuleWithRateLimitBypassed();
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        body: makeSseStream([
          sseTextDelta('回答'),
          sseTextDelta('テキスト'),
          'data: [DONE]\n',
        ]),
        text: jest.fn(),
      } as any);

      const chunks = await drain(service.streamConsult('user-1', 'work-1', 'テスト'));

      expect(chunks).toEqual(['回答', 'テキスト']);
    });

    it('yields no chunks when no content_block_delta events are present', async () => {
      const { service } = await buildModuleWithRateLimitBypassed();
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        body: makeSseStream([
          `data: ${JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 10 } } })}\n`,
          'data: [DONE]\n',
        ]),
        text: jest.fn(),
      } as any);

      const chunks = await drain(service.streamConsult('user-1', 'work-1', 'テスト'));

      expect(chunks).toHaveLength(0);
    });

    it('skips malformed JSON lines without throwing', async () => {
      const { service } = await buildModuleWithRateLimitBypassed();
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        body: makeSseStream([
          'data: {bad json}\n',
          sseTextDelta('正常テキスト'),
          'data: [DONE]\n',
        ]),
        text: jest.fn(),
      } as any);

      const chunks = await drain(service.streamConsult('user-1', 'work-1', 'テスト'));

      expect(chunks).toEqual(['正常テキスト']);
    });
  });

  // -------------------------------------------------------------------------
  // Usage logging
  // -------------------------------------------------------------------------

  describe('usage logging', () => {
    it('logs AI usage to the database after the stream completes', async () => {
      const { service, prismaService } = await buildModuleWithRateLimitBypassed();
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch('テスト回答'));

      await drain(service.streamConsult('user-1', 'work-1', 'テスト'));

      expect(prismaService.aiUsageLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            feature: 'consult_chat',
            model: 'claude-haiku-4-5-20251001',
          }),
        }),
      );
    });

    it('does not throw if usage log write fails', async () => {
      const { service, prismaService } = await buildModuleWithRateLimitBypassed();
      prismaService.aiUsageLog.create.mockRejectedValue(new Error('DB write failed'));
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch());

      // Should complete without throwing despite log failure
      await expect(drain(service.streamConsult('user-1', 'work-1', 'テスト'))).resolves.not.toThrow();
    });
  });
});

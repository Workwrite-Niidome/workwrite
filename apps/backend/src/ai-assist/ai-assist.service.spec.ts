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

const mockPrismaService = () => ({
  aiUsageLog: {
    create: jest.fn().mockResolvedValue({}),
  },
});

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
// Shared test setup
// ---------------------------------------------------------------------------

describe('AiAssistService — streamAssist structural context injection', () => {
  let service: AiAssistService;
  let contextBuilder: ReturnType<typeof mockContextBuilderService>;
  let fetchSpy: jest.SpyInstance;

  // A minimal successful fetch response that emits one text chunk then stops.
  const makeOkFetch = (text = 'Hello') =>
    jest.fn().mockResolvedValue({
      ok: true,
      body: makeSseStream([sseTextDelta(text), 'data: [DONE]\n']),
      text: jest.fn(),
    });

  beforeEach(async () => {
    contextBuilder = mockContextBuilderService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAssistService,
        { provide: PrismaService, useValue: mockPrismaService() },
        { provide: AiSettingsService, useValue: mockAiSettingsService() },
        { provide: AiTierService, useValue: mockAiTierService() },
        { provide: PromptTemplatesService, useValue: mockTemplatesService() },
        { provide: AiContextBuilderService, useValue: contextBuilder },
        { provide: CreditService, useValue: {
          consumeCredits: jest.fn().mockResolvedValue({ transactionId: 'tx-1', newBalance: 19, purchasedDeducted: 0 }),
          confirmTransaction: jest.fn().mockResolvedValue(undefined),
          refundTransaction: jest.fn().mockResolvedValue(undefined),
        } },
      ],
    }).compile();

    service = module.get<AiAssistService>(AiAssistService);

    // Mock global fetch so no real HTTP calls are made.
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(makeOkFetch());
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. workId present → context builder IS called
  // -------------------------------------------------------------------------
  describe('when variables contain workId', () => {
    it('calls contextBuilder.buildContext with the correct workId and default episodeOrder', async () => {
      contextBuilder.buildContext.mockResolvedValue({});
      contextBuilder.formatForPrompt.mockReturnValue('');

      const variables = { workId: 'work-42', topic: 'fantasy' };
      await drain(service.streamAssist('user-1', 'writing-assist', variables));

      expect(contextBuilder.buildContext).toHaveBeenCalledTimes(1);
      expect(contextBuilder.buildContext).toHaveBeenCalledWith('work-42', 999);
    });

    it('uses episodeOrder from variables when present', async () => {
      contextBuilder.buildContext.mockResolvedValue({});
      contextBuilder.formatForPrompt.mockReturnValue('');

      const variables = { workId: 'work-42', episodeOrder: '3', topic: 'fantasy' };
      await drain(service.streamAssist('user-1', 'writing-assist', variables));

      expect(contextBuilder.buildContext).toHaveBeenCalledWith('work-42', 3);
    });

    it('injects formatted context into variables.structural_context when formatForPrompt returns content', async () => {
      const formattedCtx = '【直前のあらすじ】\n第1話: 旅立ち';
      contextBuilder.buildContext.mockResolvedValue({});
      contextBuilder.formatForPrompt.mockReturnValue(formattedCtx);

      const variables: Record<string, string> = { workId: 'work-42', topic: 'fantasy' };
      await drain(service.streamAssist('user-1', 'writing-assist', variables));

      // The service mutates the variables object in place.
      expect(variables.structural_context).toBe(formattedCtx);
    });

    it('does NOT overwrite an existing structural_context provided by the caller', async () => {
      const callerCtx = 'caller-provided-context';
      const variables: Record<string, string> = {
        workId: 'work-42',
        topic: 'fantasy',
        structural_context: callerCtx,
      };

      await drain(service.streamAssist('user-1', 'writing-assist', variables));

      // contextBuilder must not be called when caller already supplied context.
      expect(contextBuilder.buildContext).not.toHaveBeenCalled();
      expect(variables.structural_context).toBe(callerCtx);
    });

    it('does NOT set structural_context when formatForPrompt returns empty string', async () => {
      contextBuilder.buildContext.mockResolvedValue({});
      contextBuilder.formatForPrompt.mockReturnValue('');

      const variables: Record<string, string> = { workId: 'work-42', topic: 'fantasy' };
      await drain(service.streamAssist('user-1', 'writing-assist', variables));

      expect(variables).not.toHaveProperty('structural_context');
    });
  });

  // -------------------------------------------------------------------------
  // 2. workId absent → context builder is NOT called
  // -------------------------------------------------------------------------
  describe('when variables do NOT contain workId', () => {
    it('does not call contextBuilder.buildContext', async () => {
      const variables = { topic: 'sci-fi' };
      await drain(service.streamAssist('user-1', 'writing-assist', variables));

      expect(contextBuilder.buildContext).not.toHaveBeenCalled();
    });

    it('does not call contextBuilder.formatForPrompt', async () => {
      const variables = { topic: 'sci-fi' };
      await drain(service.streamAssist('user-1', 'writing-assist', variables));

      expect(contextBuilder.formatForPrompt).not.toHaveBeenCalled();
    });

    it('does not set structural_context on variables', async () => {
      const variables: Record<string, string> = { topic: 'sci-fi' };
      await drain(service.streamAssist('user-1', 'writing-assist', variables));

      expect(variables).not.toHaveProperty('structural_context');
    });
  });

  // -------------------------------------------------------------------------
  // 3. contextBuilder throws → error is caught, assist continues
  // -------------------------------------------------------------------------
  describe('when contextBuilder.buildContext throws', () => {
    it('continues and yields AI output instead of propagating the error', async () => {
      contextBuilder.buildContext.mockRejectedValue(new Error('DB connection lost'));

      const variables = { workId: 'work-99', topic: 'horror' };
      // Should NOT throw — the service catches the error.
      const chunks = await drain(service.streamAssist('user-1', 'writing-assist', variables));

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('does not set structural_context when context building fails', async () => {
      contextBuilder.buildContext.mockRejectedValue(new Error('timeout'));

      const variables: Record<string, string> = { workId: 'work-99', topic: 'horror' };
      await drain(service.streamAssist('user-1', 'writing-assist', variables));

      expect(variables).not.toHaveProperty('structural_context');
    });

    it('still calls the Anthropic API after the context-builder failure', async () => {
      contextBuilder.buildContext.mockRejectedValue(new Error('timeout'));

      await drain(service.streamAssist('user-1', 'writing-assist', { workId: 'work-99' }));

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 4. Guard-clause tests (AI disabled / no API key)
  // -------------------------------------------------------------------------
  describe('pre-flight guards', () => {
    it('throws ServiceUnavailableException when AI is disabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AiAssistService,
          { provide: PrismaService, useValue: mockPrismaService() },
          {
            provide: AiSettingsService,
            useValue: { ...mockAiSettingsService(), isAiEnabled: jest.fn().mockResolvedValue(false) },
          },
          { provide: AiTierService, useValue: mockAiTierService() },
          { provide: PromptTemplatesService, useValue: mockTemplatesService() },
          { provide: AiContextBuilderService, useValue: contextBuilder },
          { provide: CreditService, useValue: {
            consumeCredits: jest.fn().mockResolvedValue({ transactionId: 'tx-1', newBalance: 19, purchasedDeducted: 0 }),
            confirmTransaction: jest.fn().mockResolvedValue(undefined),
            refundTransaction: jest.fn().mockResolvedValue(undefined),
          } },
        ],
      }).compile();

      const disabledService = module.get<AiAssistService>(AiAssistService);

      await expect(drain(disabledService.streamAssist('user-1', 'writing-assist', {})))
        .rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException when API key is missing', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AiAssistService,
          { provide: PrismaService, useValue: mockPrismaService() },
          {
            provide: AiSettingsService,
            useValue: { ...mockAiSettingsService(), getApiKey: jest.fn().mockResolvedValue(null) },
          },
          { provide: AiTierService, useValue: mockAiTierService() },
          { provide: PromptTemplatesService, useValue: mockTemplatesService() },
          { provide: AiContextBuilderService, useValue: contextBuilder },
          { provide: CreditService, useValue: {
            consumeCredits: jest.fn().mockResolvedValue({ transactionId: 'tx-1', newBalance: 19, purchasedDeducted: 0 }),
            confirmTransaction: jest.fn().mockResolvedValue(undefined),
            refundTransaction: jest.fn().mockResolvedValue(undefined),
          } },
        ],
      }).compile();

      const noKeyService = module.get<AiAssistService>(AiAssistService);

      await expect(drain(noKeyService.streamAssist('user-1', 'writing-assist', {})))
        .rejects.toThrow(ServiceUnavailableException);
    });
  });
});

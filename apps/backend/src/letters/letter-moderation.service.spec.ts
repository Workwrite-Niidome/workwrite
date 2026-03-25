import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LetterModerationService } from './letter-moderation.service';

// ─── Mock factory ────────────────────────────────────────────────────────────

const mockConfigService = () => ({
  get: jest.fn(),
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LetterModerationService', () => {
  let service: LetterModerationService;
  let config: ReturnType<typeof mockConfigService>;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    config = mockConfigService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LetterModerationService,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<LetterModerationService>(LetterModerationService);

    // Mock global fetch
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ─── moderate ──────────────────────────────────────────────────────────────

  describe('moderate', () => {
    it('queues for manual review when ANTHROPIC_API_KEY is not set', async () => {
      config.get.mockReturnValue(undefined);

      const result = await service.moderate('test content');

      expect(result.approved).toBe(false);
      expect(result.needsManualReview).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns approved when API says approved', async () => {
      config.get.mockReturnValue('sk-ant-xxx');
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [{ text: '{"approved": true}' }],
          }),
      } as any);

      const result = await service.moderate('素晴らしい作品でした！');

      expect(result.approved).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('returns rejected with reason when API rejects', async () => {
      config.get.mockReturnValue('sk-ant-xxx');
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [{ text: '{"approved": false, "reason": "攻撃的な表現"}' }],
          }),
      } as any);

      const result = await service.moderate('some bad content');

      expect(result.approved).toBe(false);
      expect(result.reason).toBe('攻撃的な表現');
    });

    it('queues for manual review when API returns error status', async () => {
      config.get.mockReturnValue('sk-ant-xxx');
      fetchSpy.mockResolvedValue({ ok: false, status: 500 } as any);

      const result = await service.moderate('test content');

      expect(result.approved).toBe(false);
      expect(result.needsManualReview).toBe(true);
    });

    it('queues for manual review when fetch throws network error', async () => {
      config.get.mockReturnValue('sk-ant-xxx');
      fetchSpy.mockRejectedValue(new Error('Network error'));

      const result = await service.moderate('test content');

      expect(result.approved).toBe(false);
      expect(result.needsManualReview).toBe(true);
    });

    it('queues for manual review when API response is malformed JSON', async () => {
      config.get.mockReturnValue('sk-ant-xxx');
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [{ text: 'not json' }],
          }),
      } as any);

      const result = await service.moderate('test content');

      expect(result.approved).toBe(false);
      expect(result.needsManualReview).toBe(true);
    });
  });
});

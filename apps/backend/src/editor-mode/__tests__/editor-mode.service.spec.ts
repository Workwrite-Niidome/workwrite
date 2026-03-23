/**
 * Unit tests for EditorModeService
 *
 * All external dependencies (PrismaService, AiSettingsService, AiTierService,
 * CreditService) are mocked so that no database or network calls occur.
 *
 * Test focus areas:
 *  1. getJobWithOwnerCheck – NotFoundException / ForbiddenException guard
 *  2. startGeneration      – ConflictException race-condition guard
 *  3. pauseGeneration / resumeGeneration – ConflictException guard
 *  4. finalizeDesign       – delegates to getJobWithOwnerCheck
 */

import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EditorModeService } from '../editor-mode.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiSettingsService } from '../../ai-settings/ai-settings.service';
import { AiTierService } from '../../ai-settings/ai-tier.service';
import { CreditService } from '../../billing/credit.service';
import { NotificationsService } from '../../notifications/notifications.service';

// ─── Mock factories ───────────────────────────────────────────────────────────

const makePrisma = () => ({
  editorModeJob: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  work: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  workCreationPlan: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
  episode: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  aiUsageLog: {
    create: jest.fn().mockResolvedValue({}),
  },
});

const makeAiSettings = () => ({
  isAiEnabled: jest.fn().mockResolvedValue(true),
  getApiKey: jest.fn().mockResolvedValue('test-api-key'),
});

const makeAiTier = () => ({
  assertCanUseAi: jest.fn().mockResolvedValue(undefined),
  getModelConfig: jest.fn().mockResolvedValue({ model: 'claude-3-haiku' }),
  getCreditCost: jest.fn().mockReturnValue(1),
});

const makeCreditService = () => ({
  consumeCredits: jest.fn().mockResolvedValue({ transactionId: 'tx-1' }),
  confirmTransaction: jest.fn().mockResolvedValue(undefined),
  refundTransaction: jest.fn().mockResolvedValue(undefined),
  getBalance: jest.fn().mockResolvedValue({ total: 100 }),
  ensureCreditBalance: jest.fn(),
});

// ─── Test setup ───────────────────────────────────────────────────────────────

describe('EditorModeService', () => {
  let service: EditorModeService;
  let prisma: ReturnType<typeof makePrisma>;
  let creditService: ReturnType<typeof makeCreditService>;

  beforeEach(async () => {
    prisma = makePrisma();
    const aiSettings = makeAiSettings();
    const aiTier = makeAiTier();
    creditService = makeCreditService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EditorModeService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiSettingsService, useValue: aiSettings },
        { provide: AiTierService, useValue: aiTier },
        { provide: CreditService, useValue: creditService },
        { provide: NotificationsService, useValue: { create: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = module.get<EditorModeService>(EditorModeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getJobWithOwnerCheck (indirectly via public methods) ────────────────

  describe('ownership check (via getStatus)', () => {
    it('throws NotFoundException when the job does not exist', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue(null);

      await expect(service.getStatus('user-1', 'work-999')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when userId does not match job owner', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'owner-user',
        workId: 'work-1',
        status: 'designing',
        designChatHistory: [],
        creditsConsumed: 0,
      });
      prisma.episode.findMany.mockResolvedValue([]);

      await expect(service.getStatus('different-user', 'work-1')).rejects.toThrow(ForbiddenException);
    });

    it('returns job data when userId matches', async () => {
      const job = {
        id: 'job-1',
        userId: 'user-1',
        workId: 'work-1',
        status: 'designing',
        aiMode: 'normal',
        generationMode: 'batch',
        totalEpisodes: 10,
        completedEpisodes: 0,
        creditsConsumed: 0,
        episodePlan: [],
        designChatHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.editorModeJob.findUnique.mockResolvedValue(job);
      prisma.episode.findMany.mockResolvedValue([]);

      const result = await service.getStatus('user-1', 'work-1');
      expect(result.status).toBe('designing');
    });
  });

  // ─── startGeneration race-condition guard ────────────────────────────────

  describe('startGeneration', () => {
    const dto = { aiMode: 'normal' as const, generationMode: 'batch' as const };

    it('throws ConflictException when job is already generating', async () => {
      // getJobWithOwnerCheck finds the job (owned by user-1)
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'generating',
      });
      // updateMany returns count=0 (already generating, WHERE NOT generating matched nothing)
      prisma.editorModeJob.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.startGeneration('user-1', 'work-1', dto)).rejects.toThrow(ConflictException);
    });

    it('succeeds and returns { status: "generating" } when not currently generating', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'taste_check',
      });
      prisma.editorModeJob.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.startGeneration('user-1', 'work-1', dto);
      expect(result).toEqual({ status: 'generating' });
    });

    it('throws NotFoundException for unknown workId', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue(null);

      await expect(service.startGeneration('user-1', 'unknown-work', dto)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when userId does not own the job', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'real-owner',
        workId: 'work-1',
        status: 'paused',
      });

      await expect(service.startGeneration('attacker', 'work-1', dto)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── resumeGeneration – same ConflictException guard ────────────────────

  describe('resumeGeneration', () => {
    const dto = { aiMode: 'normal' as const, generationMode: 'confirm' as const };

    it('throws ConflictException when already generating', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'generating',
      });
      prisma.editorModeJob.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.resumeGeneration('user-1', 'work-1', dto)).rejects.toThrow(ConflictException);
    });

    it('returns { status: "generating" } when paused', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'paused',
      });
      prisma.editorModeJob.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.resumeGeneration('user-1', 'work-1', dto);
      expect(result).toEqual({ status: 'generating' });
    });
  });

  // ─── pauseGeneration ─────────────────────────────────────────────────────

  describe('pauseGeneration', () => {
    it('returns { status: "paused" } when owner calls it', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'generating',
      });
      prisma.editorModeJob.update.mockResolvedValue({ status: 'paused' });

      const result = await service.pauseGeneration('user-1', 'work-1');
      expect(result).toEqual({ status: 'paused' });
    });

    it('throws ForbiddenException when non-owner calls it', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'real-owner',
        workId: 'work-1',
        status: 'generating',
      });

      await expect(service.pauseGeneration('attacker', 'work-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for unknown workId', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue(null);

      await expect(service.pauseGeneration('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── finalizeDesign ──────────────────────────────────────────────────────

  describe('finalizeDesign', () => {
    const dto = { totalEpisodes: 10, charCountPerEpisode: 3000 };

    it('throws NotFoundException when job does not exist', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue(null);

      await expect(
        service.finalizeDesign('user-1', 'work-1', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when userId does not own the job', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'owner',
        workId: 'work-1',
        status: 'designing',
        designChatHistory: [],
      });

      await expect(
        service.finalizeDesign('attacker', 'work-1', dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns { status: "taste_check", totalEpisodes } on success', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'designing',
        designChatHistory: [],
        aiMode: 'normal',
      });
      prisma.workCreationPlan.upsert.mockResolvedValue({});
      prisma.editorModeJob.update.mockResolvedValue({ status: 'taste_check' });

      const result = await service.finalizeDesign('user-1', 'work-1', dto);
      expect(result).toEqual({ status: 'taste_check', totalEpisodes: 10 });
    });

    it('builds episodePlan with correct episode numbers', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'designing',
        designChatHistory: [],
        aiMode: 'normal',
      });
      prisma.workCreationPlan.upsert.mockResolvedValue({});
      prisma.editorModeJob.update.mockResolvedValue({ status: 'taste_check' });

      await service.finalizeDesign('user-1', 'work-1', { totalEpisodes: 3, charCountPerEpisode: 2000 });

      expect(prisma.editorModeJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            episodePlan: [
              { episodeNumber: 1, title: '第1話', summary: '' },
              { episodeNumber: 2, title: '第2話', summary: '' },
              { episodeNumber: 3, title: '第3話', summary: '' },
            ],
          }),
        }),
      );
    });
  });

  // ─── approveEpisode ──────────────────────────────────────────────────────

  describe('approveEpisode', () => {
    it('throws NotFoundException when episode does not exist', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'reviewing',
      });
      prisma.episode.findUnique.mockResolvedValue(null);

      await expect(
        service.approveEpisode('user-1', 'work-1', 'ep-999'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when episode belongs to different work', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'reviewing',
      });
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        workId: 'different-work',
        content: 'content',
        orderIndex: 0,
      });

      await expect(
        service.approveEpisode('user-1', 'work-1', 'ep-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('publishes episode and returns { approved: true } on success', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'reviewing',
      });
      prisma.episode.findUnique.mockResolvedValue({
        id: 'ep-1',
        workId: 'work-1',
        content: 'content',
        orderIndex: 0,
      });
      prisma.episode.update.mockResolvedValue({ id: 'ep-1', publishedAt: new Date() });

      const result = await service.approveEpisode('user-1', 'work-1', 'ep-1');
      expect(result).toEqual({ approved: true, episodeId: 'ep-1' });
      expect(prisma.episode.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ep-1' },
          data: expect.objectContaining({ publishedAt: expect.any(Date) }),
        }),
      );
    });
  });

  // ─── changeGenerationMode ────────────────────────────────────────────────

  describe('changeGenerationMode', () => {
    it('updates generationMode and returns it', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'user-1',
        workId: 'work-1',
        status: 'generating',
      });
      prisma.editorModeJob.update.mockResolvedValue({ generationMode: 'confirm' });

      const result = await service.changeGenerationMode('user-1', 'work-1', { generationMode: 'confirm' });
      expect(result).toEqual({ generationMode: 'confirm' });
    });

    it('throws ForbiddenException for non-owner', async () => {
      prisma.editorModeJob.findUnique.mockResolvedValue({
        userId: 'owner',
        workId: 'work-1',
        status: 'generating',
      });

      await expect(
        service.changeGenerationMode('attacker', 'work-1', { generationMode: 'batch' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── createJob ───────────────────────────────────────────────────────────

  describe('createJob', () => {
    it('upserts an editor mode job with designing status', async () => {
      const mockJob = { workId: 'w-1', userId: 'u-1', status: 'designing' };
      prisma.editorModeJob.upsert.mockResolvedValue(mockJob);

      const result = await service.createJob('u-1', 'w-1');
      expect(result).toEqual(mockJob);
      expect(prisma.editorModeJob.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workId: 'w-1' },
          create: expect.objectContaining({ userId: 'u-1', status: 'designing' }),
        }),
      );
    });
  });
});

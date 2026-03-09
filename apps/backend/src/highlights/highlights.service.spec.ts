import { Test, TestingModule } from '@nestjs/testing';
import { HighlightsService } from './highlights.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = () => ({
  highlight: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  aiUsageLog: {
    create: jest.fn(),
  },
});

const mockAiSettingsService = () => ({
  isAiEnabled: jest.fn(),
  getApiKey: jest.fn(),
  getModel: jest.fn(),
});

describe('HighlightsService', () => {
  let service: HighlightsService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HighlightsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiSettingsService, useValue: mockAiSettingsService() },
      ],
    }).compile();

    service = module.get<HighlightsService>(HighlightsService);
  });

  describe('create', () => {
    it('should create a highlight', async () => {
      const data = { episodeId: 'ep-1', startPos: 10, endPos: 50, color: 'yellow', memo: 'nice!' };
      prisma.highlight.create.mockResolvedValue({ id: 'hl-1', userId: 'user-1', ...data });

      const result = await service.create('user-1', data);

      expect(result.id).toBe('hl-1');
      expect(prisma.highlight.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', ...data },
      });
    });
  });

  describe('findByEpisode', () => {
    it('should return highlights ordered by startPos', async () => {
      const mockHighlights = [
        { id: 'hl-1', startPos: 10 },
        { id: 'hl-2', startPos: 50 },
      ];
      prisma.highlight.findMany.mockResolvedValue(mockHighlights);

      const result = await service.findByEpisode('user-1', 'ep-1');

      expect(result).toEqual(mockHighlights);
      expect(prisma.highlight.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', episodeId: 'ep-1' },
        orderBy: { startPos: 'asc' },
      });
    });
  });

  describe('update', () => {
    it('should update highlight memo and color', async () => {
      prisma.highlight.findUnique.mockResolvedValue({ id: 'hl-1', userId: 'user-1' });
      prisma.highlight.update.mockResolvedValue({ id: 'hl-1', memo: 'updated', color: 'blue' });

      const result = await service.update('hl-1', 'user-1', { memo: 'updated', color: 'blue' });

      expect(result.memo).toBe('updated');
      expect(result.color).toBe('blue');
      expect(prisma.highlight.update).toHaveBeenCalledWith({
        where: { id: 'hl-1' },
        data: { memo: 'updated', color: 'blue' },
      });
    });

    it('should throw NotFoundException when highlight not found', async () => {
      prisma.highlight.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', 'user-1', { memo: 'test' }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user does not own highlight', async () => {
      prisma.highlight.findUnique.mockResolvedValue({ id: 'hl-1', userId: 'other-user' });

      await expect(service.update('hl-1', 'user-1', { memo: 'test' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete a highlight', async () => {
      prisma.highlight.findUnique.mockResolvedValue({ id: 'hl-1', userId: 'user-1' });
      prisma.highlight.delete.mockResolvedValue({ id: 'hl-1' });

      const result = await service.delete('hl-1', 'user-1');

      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException when highlight not found', async () => {
      prisma.highlight.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'user-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user does not own highlight', async () => {
      prisma.highlight.findUnique.mockResolvedValue({ id: 'hl-1', userId: 'other-user' });

      await expect(service.delete('hl-1', 'user-1'))
        .rejects.toThrow(NotFoundException);
    });
  });
});

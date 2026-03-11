import { Test, TestingModule } from '@nestjs/testing';
import { EpisodesService } from './episodes.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPrismaService = () => ({
  work: {
    findUnique: jest.fn(),
  },
  episode: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  episodeSnapshot: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('EpisodesService', () => {
  let service: EpisodesService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EpisodesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EpisodesService>(EpisodesService);
  });

  describe('update — contentVersion increment', () => {
    const authorId = 'author-1';
    const episodeId = 'ep-1';

    const existingEpisode = {
      id: episodeId,
      title: 'Old Title',
      content: 'Old content',
      wordCount: 11,
      orderIndex: 0,
      workId: 'work-1',
      work: { authorId },
    };

    it('increments contentVersion when content is provided', async () => {
      prisma.episode.findUnique.mockResolvedValue(existingEpisode);
      prisma.episode.update.mockResolvedValue({ ...existingEpisode, content: 'New content', contentVersion: 2 });

      await service.update(episodeId, authorId, { content: 'New content' });

      expect(prisma.episode.update).toHaveBeenCalledWith({
        where: { id: episodeId },
        data: expect.objectContaining({
          content: 'New content',
          contentVersion: { increment: 1 },
        }),
      });
    });

    it('also updates wordCount when content is provided', async () => {
      prisma.episode.findUnique.mockResolvedValue(existingEpisode);
      prisma.episode.update.mockResolvedValue(existingEpisode);

      await service.update(episodeId, authorId, { content: 'Hello world' });

      expect(prisma.episode.update).toHaveBeenCalledWith({
        where: { id: episodeId },
        data: expect.objectContaining({
          wordCount: 'Hello world'.length,
        }),
      });
    });

    it('does NOT include contentVersion when content is absent', async () => {
      prisma.episode.findUnique.mockResolvedValue(existingEpisode);
      prisma.episode.update.mockResolvedValue({ ...existingEpisode, title: 'New Title' });

      await service.update(episodeId, authorId, { title: 'New Title' });

      const callArg = prisma.episode.update.mock.calls[0][0];
      expect(callArg.data).not.toHaveProperty('contentVersion');
    });

    it('does NOT include contentVersion when content is undefined', async () => {
      prisma.episode.findUnique.mockResolvedValue(existingEpisode);
      prisma.episode.update.mockResolvedValue(existingEpisode);

      await service.update(episodeId, authorId, {});

      const callArg = prisma.episode.update.mock.calls[0][0];
      expect(callArg.data).not.toHaveProperty('contentVersion');
    });

    it('can update both content and title simultaneously, incrementing contentVersion once', async () => {
      prisma.episode.findUnique.mockResolvedValue(existingEpisode);
      prisma.episode.update.mockResolvedValue(existingEpisode);

      await service.update(episodeId, authorId, { title: 'New Title', content: 'New body' });

      expect(prisma.episode.update).toHaveBeenCalledWith({
        where: { id: episodeId },
        data: expect.objectContaining({
          title: 'New Title',
          content: 'New body',
          contentVersion: { increment: 1 },
        }),
      });
    });

    it('throws NotFoundException when episode does not exist', async () => {
      prisma.episode.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', authorId, { content: 'x' }))
        .rejects.toThrow(NotFoundException);

      expect(prisma.episode.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when caller is not the author', async () => {
      prisma.episode.findUnique.mockResolvedValue({
        ...existingEpisode,
        work: { authorId: 'someone-else' },
      });

      await expect(service.update(episodeId, 'intruder-id', { content: 'x' }))
        .rejects.toThrow(ForbiddenException);

      expect(prisma.episode.update).not.toHaveBeenCalled();
    });

    it('handles empty string content — still increments contentVersion', async () => {
      prisma.episode.findUnique.mockResolvedValue(existingEpisode);
      prisma.episode.update.mockResolvedValue(existingEpisode);

      await service.update(episodeId, authorId, { content: '' });

      expect(prisma.episode.update).toHaveBeenCalledWith({
        where: { id: episodeId },
        data: expect.objectContaining({
          content: '',
          wordCount: 0,
          contentVersion: { increment: 1 },
        }),
      });
    });
  });
});

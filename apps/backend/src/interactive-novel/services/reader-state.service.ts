import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PerspectiveMode } from '../types/world.types';

@Injectable()
export class ReaderStateService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateState(userId: string, workId: string, entryLayer = 2) {
    return this.prisma.readerWorldState.upsert({
      where: { userId_workId: { userId, workId } },
      create: { userId, workId, entryLayer, perspective: 'character', timelinePosition: 0 },
      update: {},
    });
  }

  async getState(userId: string, workId: string) {
    return this.prisma.readerWorldState.findUnique({
      where: { userId_workId: { userId, workId } },
    });
  }

  async updateLocation(userId: string, workId: string, locationId: string) {
    return this.prisma.readerWorldState.update({
      where: { userId_workId: { userId, workId } },
      data: { locationId },
    });
  }

  async updatePerspective(userId: string, workId: string, perspective: PerspectiveMode) {
    return this.prisma.readerWorldState.update({
      where: { userId_workId: { userId, workId } },
      data: { perspective },
    });
  }

  async advanceTime(userId: string, workId: string, amount: number) {
    const state = await this.getState(userId, workId);
    if (!state) return null;
    const newPosition = Math.min(1, state.timelinePosition + amount);
    return this.prisma.readerWorldState.update({
      where: { userId_workId: { userId, workId } },
      data: { timelinePosition: newPosition },
    });
  }

  async recordJourney(userId: string, workId: string, action: string, detail?: any, state?: any) {
    return this.prisma.journeyLog.create({
      data: {
        userId,
        workId,
        locationId: state?.locationId ?? null,
        timelinePosition: state?.timelinePosition ?? null,
        perspective: state?.perspective ?? null,
        action,
        detail: detail ?? undefined,
      },
    });
  }

  async witnessEvent(userId: string, workId: string, storyEventId: string) {
    return this.prisma.readerWitnessedEvent.upsert({
      where: { userId_workId_storyEventId: { userId, workId, storyEventId } },
      create: { userId, workId, storyEventId },
      update: {},
    });
  }

  async hasWitnessedEvent(userId: string, workId: string, storyEventId: string) {
    const record = await this.prisma.readerWitnessedEvent.findUnique({
      where: { userId_workId_storyEventId: { userId, workId, storyEventId } },
    });
    return !!record;
  }

  async discoverLocation(userId: string, workId: string, locationId: string) {
    return this.prisma.readerDiscoveredLocation.upsert({
      where: { userId_workId_locationId: { userId, workId, locationId } },
      create: { userId, workId, locationId },
      update: {},
    });
  }

  async getJourney(userId: string, workId: string, limit = 100) {
    return this.prisma.journeyLog.findMany({
      where: { userId, workId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

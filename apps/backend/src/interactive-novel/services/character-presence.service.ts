import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CharacterPresenceService {
  constructor(private prisma: PrismaService) {}

  async getCharactersAt(workId: string, locationId: string, timelinePosition: number) {
    const schedules = await this.prisma.characterSchedule.findMany({
      where: {
        workId,
        locationId,
        timeStart: { lte: timelinePosition },
        timeEnd: { gte: timelinePosition },
      },
      include: {
        character: {
          select: { id: true, name: true, role: true, personality: true, speechStyle: true },
        },
      },
    });

    return schedules.map(s => ({
      id: s.character.id,
      name: s.character.name,
      role: s.character.role,
      activity: s.activity || '',
      mood: s.mood || '',
      personality: s.character.personality,
      speechStyle: s.character.speechStyle,
    }));
  }

  async isCharacterAt(characterId: string, locationId: string, timelinePosition: number) {
    const count = await this.prisma.characterSchedule.count({
      where: {
        characterId,
        locationId,
        timeStart: { lte: timelinePosition },
        timeEnd: { gte: timelinePosition },
      },
    });
    return count > 0;
  }
}

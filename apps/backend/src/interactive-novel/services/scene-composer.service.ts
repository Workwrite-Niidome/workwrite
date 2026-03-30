import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ReaderStateService } from './reader-state.service';
import { CharacterPresenceService } from './character-presence.service';
import { PerspectiveRendererService } from './perspective-renderer.service';
import type { RenderedScene, ActionSuggestion } from '../types/experience.types';
import type { TimeOfDay, PerspectiveMode } from '../types/world.types';

@Injectable()
export class SceneComposerService {
  constructor(
    private prisma: PrismaService,
    private readerState: ReaderStateService,
    private characterPresence: CharacterPresenceService,
    private perspectiveRenderer: PerspectiveRendererService,
  ) {}

  async composeScene(userId: string, workId: string): Promise<RenderedScene> {
    let state = await this.readerState.getOrCreateState(userId, workId);

    // If no location, assign the first WorldLocation for this work
    if (!state.locationId) {
      const firstLocation = await this.prisma.worldLocation.findFirst({
        where: { workId },
        orderBy: { createdAt: 'asc' },
      });
      if (firstLocation) {
        state = await this.readerState.updateLocation(userId, workId, firstLocation.id);
      }
    }

    const location = state.locationId
      ? await this.prisma.worldLocation.findUnique({ where: { id: state.locationId } })
      : null;

    const timeOfDay = this.getTimeOfDay(state.timelinePosition);

    // Characters at this location/time
    const characters = state.locationId
      ? await this.characterPresence.getCharactersAt(workId, state.locationId, state.timelinePosition)
      : [];

    // Events at this location/time
    // Search within current episode's range (1/totalEpisodes)
    const episodeCount = await this.prisma.episode.count({ where: { workId } });
    const searchRange = episodeCount > 0 ? 1 / episodeCount / 2 : 0.05;
    const events = state.locationId
      ? await this.prisma.storyEvent.findMany({
          where: {
            workId,
            locationId: state.locationId,
            timelinePosition: {
              gte: state.timelinePosition - searchRange,
              lte: state.timelinePosition + searchRange,
            },
          },
          orderBy: { orderInEpisode: 'asc' },
          take: 3, // Max 3 events per scene to avoid overwhelming
        })
      : [];

    // Reading progress for spoiler protection
    const readProgress = await this.prisma.readingProgress.findMany({
      where: { userId, episode: { workId } },
      select: { episodeId: true, completed: true },
    });

    // Render events
    const renderedEvents = await Promise.all(
      events.map(e => this.perspectiveRenderer.renderEvent(
        e,
        state.perspective as PerspectiveMode,
        readProgress.map(p => ({ episodeId: p.episodeId, completed: !!p.completed })),
      )),
    );

    // Environment text from LocationRendering (sensory data)
    const environmentParts: string[] = [];
    if (location) {
      environmentParts.push(location.description);

      if (state.locationId) {
        const rendering = await this.prisma.locationRendering.findUnique({
          where: { locationId_timeOfDay: { locationId: state.locationId, timeOfDay } },
        });
        if (rendering) {
          const sensory = rendering.sensoryText as Record<string, string>;
          // Add individual sensory lines (visual, auditory, etc.)
          for (const val of Object.values(sensory)) {
            if (val) environmentParts.push(val);
          }
        }
      }

      // Character presence descriptions
      for (const char of characters) {
        const sn = this.shortName(char.name);
        if (char.activity) {
          environmentParts.push(`${sn}が${char.activity}。`);
        }
      }
    }

    const actions = await this.generateActions(workId, state, characters);

    return {
      environment: {
        text: environmentParts.join('\n'),
        source: location ? 'cached' : 'generated',
      },
      events: renderedEvents,
      characters: characters.map(c => ({
        characterId: c.id,
        name: c.name,
        activity: c.activity,
        interactable: true,
      })),
      actions,
      meta: {
        locationName: location?.name || '???',
        timeOfDay,
        perspective: state.perspective as PerspectiveMode,
      },
    };
  }

  private async generateActions(
    workId: string,
    state: any,
    characters: { id: string; name: string }[],
  ): Promise<ActionSuggestion[]> {
    const actions: ActionSuggestion[] = [];

    // Talk to present characters
    for (const char of characters) {
      actions.push({
        type: 'talk',
        label: `${this.shortName(char.name)}と話す`,
        params: { characterId: char.id },
      });
    }

    // Move to connected locations
    if (state.locationId) {
      const connections = await this.prisma.locationConnection.findMany({
        where: { fromLocationId: state.locationId },
        include: { toLocation: { select: { id: true, name: true } } },
      });
      for (const conn of connections) {
        actions.push({
          type: 'move',
          label: conn.description || conn.toLocation.name,
          params: { locationId: conn.toLocation.id },
        });
      }
    }

    actions.push({ type: 'observe', label: '周りを見る', params: { target: 'environment' } });
    actions.push({ type: 'time', label: '次の日へ', params: {} });

    return actions;
  }

  private shortName(fullName: string): string {
    let name = fullName.split('（')[0].split('(')[0].trim();
    if (name.includes(' ')) name = name.split(' ')[0];
    if (name.includes('　')) name = name.split('　')[0];
    return name;
  }

  getTimeOfDay(timelinePosition: number): TimeOfDay {
    const dayPhase = (timelinePosition * 6) % 6;
    if (dayPhase < 1) return 'dawn';
    if (dayPhase < 2) return 'morning';
    if (dayPhase < 3) return 'afternoon';
    if (dayPhase < 4) return 'evening';
    if (dayPhase < 5) return 'night';
    return 'late_night';
  }
}

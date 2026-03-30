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
    const state = await this.readerState.getOrCreateState(userId, workId);

    // Get location
    const location = state.locationId
      ? await this.prisma.worldLocation.findUnique({ where: { id: state.locationId } })
      : null;

    const timeOfDay = this.getTimeOfDay(state.timelinePosition);

    // Get characters at this location/time
    const characters = state.locationId
      ? await this.characterPresence.getCharactersAt(workId, state.locationId, state.timelinePosition)
      : [];

    // Get events at this location/time
    const events = state.locationId
      ? await this.prisma.storyEvent.findMany({
          where: {
            workId,
            locationId: state.locationId,
            timelinePosition: {
              gte: state.timelinePosition - 0.02,
              lte: state.timelinePosition + 0.02,
            },
          },
          orderBy: { orderInEpisode: 'asc' },
          take: 5,
        })
      : [];

    // Get reading progress for spoiler protection
    const readProgress = await this.prisma.readingProgress.findMany({
      where: { userId, episode: { workId } },
      select: { episodeId: true, completed: true },
    });

    // Render events with perspective
    const renderedEvents = await Promise.all(
      events.map(e => this.perspectiveRenderer.renderEvent(
        e,
        state.perspective as PerspectiveMode,
        readProgress.map(p => ({ episodeId: p.episodeId, completed: !!p.completed })),
      )),
    );

    // Get environment rendering (cached)
    let environmentText = location?.description || '';
    if (state.locationId) {
      const rendering = await this.prisma.locationRendering.findUnique({
        where: { locationId_timeOfDay: { locationId: state.locationId, timeOfDay } },
      });
      if (rendering) {
        const sensory = rendering.sensoryText as any;
        const parts = [sensory?.visual, sensory?.auditory, sensory?.olfactory, sensory?.atmospheric].filter(Boolean);
        if (parts.length > 0) environmentText = parts.join('\n');
      }
    }

    // Generate action suggestions
    const actions = await this.generateActions(workId, state, characters);

    return {
      environment: { text: environmentText, source: location ? 'cached' : 'generated' },
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
      const shortName = char.name.split('（')[0].split('(')[0];
      actions.push({
        type: 'talk',
        label: `${shortName}と話す`,
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

    // Observe
    actions.push({ type: 'observe', label: '周りを見る', params: { target: 'environment' } });

    // Time advance
    actions.push({ type: 'time', label: '次の日へ', params: {} });

    return actions;
  }

  private getTimeOfDay(timelinePosition: number): TimeOfDay {
    // Map 0.0-1.0 to time of day based on position within "day"
    const dayPhase = (timelinePosition * 6) % 6;
    if (dayPhase < 1) return 'dawn';
    if (dayPhase < 2) return 'morning';
    if (dayPhase < 3) return 'afternoon';
    if (dayPhase < 4) return 'evening';
    if (dayPhase < 5) return 'night';
    return 'late_night';
  }
}

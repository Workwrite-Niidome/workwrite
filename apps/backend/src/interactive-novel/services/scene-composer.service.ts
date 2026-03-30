import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiSettingsService } from '../../ai-settings/ai-settings.service';
import { ReaderStateService } from './reader-state.service';
import { CharacterPresenceService } from './character-presence.service';
import { PerspectiveRendererService } from './perspective-renderer.service';
import type { RenderedScene, ActionSuggestion } from '../types/experience.types';
import type { TimeOfDay, PerspectiveMode } from '../types/world.types';

const HAIKU = 'claude-haiku-4-5-20251001';
const ANTHROPIC_VERSION = '2023-06-01';

@Injectable()
export class SceneComposerService {
  private readonly logger = new Logger(SceneComposerService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
    private readerState: ReaderStateService,
    private characterPresence: CharacterPresenceService,
    private perspectiveRenderer: PerspectiveRendererService,
  ) {}

  async composeScene(userId: string, workId: string): Promise<RenderedScene> {
    let state = await this.readerState.getOrCreateState(userId, workId);

    // Auto-assign first location if needed
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

    // ===== EVENTS ARE THE MAIN CONTENT =====
    // Find StoryEvents at this location and time
    const episodeCount = await this.prisma.episode.count({ where: { workId } });
    const searchRange = episodeCount > 0 ? 1 / episodeCount : 0.05;

    const events = state.locationId
      ? await this.prisma.storyEvent.findMany({
          where: {
            workId,
            locationId: state.locationId,
            timelinePosition: {
              gte: state.timelinePosition,
              lte: state.timelinePosition + searchRange,
            },
          },
          orderBy: [{ timelinePosition: 'asc' }, { orderInEpisode: 'asc' }],
          take: 5,
        })
      : [];

    // Also get events WITHOUT location (unassigned) at this timeline position
    const unlocatedEvents = await this.prisma.storyEvent.findMany({
      where: {
        workId,
        locationId: null,
        timelinePosition: {
          gte: state.timelinePosition,
          lte: state.timelinePosition + searchRange,
        },
      },
      orderBy: [{ timelinePosition: 'asc' }, { orderInEpisode: 'asc' }],
      take: 3,
    });

    const allEvents = [...events, ...unlocatedEvents].slice(0, 5);

    // Reading progress for spoiler protection
    const readProgress = await this.prisma.readingProgress.findMany({
      where: { userId, episode: { workId } },
      select: { episodeId: true, completed: true },
    });

    // Check which events the reader has already witnessed
    const witnessed = await this.prisma.readerWitnessedEvent.findMany({
      where: { userId, workId, storyEventId: { in: allEvents.map(e => e.id) } },
      select: { storyEventId: true },
    });
    const witnessedSet = new Set(witnessed.map(w => w.storyEventId));

    // Render events with original text + isMemory flag
    const renderedEvents = await Promise.all(
      allEvents.map(async e => {
        const rendered = await this.perspectiveRenderer.renderEvent(
          e,
          state.perspective as PerspectiveMode,
          readProgress.map(p => ({ episodeId: p.episodeId, completed: !!p.completed })),
        );
        return { ...rendered, isMemory: witnessedSet.has(e.id) };
      }),
    );

    // Record newly witnessed events
    for (const e of allEvents) {
      if (!witnessedSet.has(e.id)) {
        await this.prisma.readerWitnessedEvent.create({
          data: { userId, workId, storyEventId: e.id },
        }).catch(() => {}); // Ignore duplicates
      }
    }

    // ===== ENVIRONMENT IS MINIMAL =====
    // Just one line: location name + one sensory detail
    let environmentText = '';
    if (location) {
      // Try to get one sensory line from LocationRendering
      if (state.locationId) {
        const rendering = await this.prisma.locationRendering.findUnique({
          where: { locationId_timeOfDay: { locationId: state.locationId, timeOfDay } },
        });
        if (rendering) {
          const sensory = rendering.sensoryText as Record<string, string>;
          // Pick just the visual or atmospheric (most evocative)
          environmentText = sensory?.visual || sensory?.atmospheric || location.description;
        } else {
          environmentText = location.description;
        }
      } else {
        environmentText = location.description;
      }

      // Add character presence as brief lines
      if (characters.length > 0) {
        const charLines = characters
          .map(c => `${this.shortName(c.name)}が${c.activity || 'いる'}。`)
          .join(' ');
        environmentText += '\n' + charLines;
      }
    }

    const eventsText = renderedEvents.map(e => e.renderedText).filter(Boolean).join('\n');
    const actions = await this.generateActions(workId, state, characters, eventsText, location?.name || '');

    return {
      environment: { text: environmentText, source: 'cached' },
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
    eventsText: string,
    locationName: string,
  ): Promise<ActionSuggestion[]> {
    // Gather move connections for both AI context and fallback
    let connections: { toLocation: { id: string; name: string }; description: string | null }[] = [];
    if (state.locationId) {
      connections = await this.prisma.locationConnection.findMany({
        where: { fromLocationId: state.locationId },
        include: { toLocation: { select: { id: true, name: true } } },
      });
    }

    // Try AI generation
    try {
      const aiActions = await this.generateActionsWithAI(
        eventsText,
        locationName,
        characters,
        connections.map(c => ({ id: c.toLocation.id, name: c.toLocation.name })),
      );
      if (aiActions && aiActions.length > 0) {
        // Always append fixed actions
        aiActions.push({ type: 'observe', label: '周りの空気を感じる', params: { target: 'environment' } });
        aiActions.push({ type: 'time', label: this.getTimeLabel(this.getTimeOfDay(state.timelinePosition)), params: {} });
        return aiActions;
      }
    } catch (err) {
      this.logger.warn(`AI action generation failed, using fallback: ${err}`);
    }

    // Fallback: mechanical generation
    return this.generateActionsFallback(state, characters, connections);
  }

  private generateActionsFallback(
    state: any,
    characters: { id: string; name: string }[],
    connections: { toLocation: { id: string; name: string }; description: string | null }[],
  ): ActionSuggestion[] {
    const actions: ActionSuggestion[] = [];

    for (const char of characters) {
      actions.push({
        type: 'talk',
        label: `${this.shortName(char.name)}の気配がする`,
        params: { characterId: char.id },
      });
    }

    for (const conn of connections) {
      actions.push({
        type: 'move',
        label: `${conn.toLocation.name}の方から、風が来る`,
        params: { locationId: conn.toLocation.id },
      });
    }

    actions.push({ type: 'observe', label: '周りの空気を感じる', params: { target: 'environment' } });
    actions.push({ type: 'time', label: this.getTimeLabel(this.getTimeOfDay(state.timelinePosition)), params: {} });

    return actions;
  }

  private async generateActionsWithAI(
    eventsText: string,
    locationName: string,
    characters: { id: string; name: string }[],
    connectedLocations: { id: string; name: string }[],
  ): Promise<ActionSuggestion[] | null> {
    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) return null;

    const truncatedEvents = eventsText.slice(0, 2000);
    const charNames = characters.map(c => this.shortName(c.name));
    const locationNames = connectedLocations.map(l => l.name);

    const systemPrompt = `あなたは小説のインタラクティブ体験を設計するアシスタントです。
読者は物語の世界の中にいます。

読者の「注意が向きうるもの」を3個生成してください。
これは選択肢ではありません。読者がふと気づくかもしれない、世界の断片です。

ルール:
- 命令形（「〜する」「〜を見る」）ではなく、知覚の断片にする
- 例: 「本棚の影が目に入る」「榊の声が、まだ耳に残っている」「外から風が入ってくる」
- 12文字以内。体言止めか、知覚動詞（目に入る、聞こえる、感じる）で終わる
- typeは以下から選択: "talk"（キャラへの注意）, "move"（場所の気配）, "observe"（環境の知覚）
- "talk"の場合、paramsにcharacterIdを含める（"CHAR:キャラ名"の形式で）
- "move"の場合、paramsにlocationIdを含める（"LOC:場所名"の形式で）
- "observe"の場合、paramsにtarget: "environment"を含める
- 場所移動のヒントは方向感覚で: 「外の空気」「奥の扉」
- キャラクターへの注意は間接的に: 「榊の手が止まる」「詩の足音」
- 「周りを見る」「次の日へ」は不要（自動追加される）

JSON配列のみ返してください。`;

    const userPrompt = `場所: ${locationName || '不明'}
いるキャラクター: ${charNames.length > 0 ? charNames.join('、') : 'なし'}
移動可能な場所: ${locationNames.length > 0 ? locationNames.join('、') : 'なし'}

現在のシーン:
${truncatedEvents || '(テキストなし)'}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: HAIKU,
          max_tokens: 500,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(`Anthropic API returned ${response.status}`);
        return null;
      }

      const data = await response.json();
      const text = data?.content?.[0]?.text;
      if (!text) return null;

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return null;

      const rawActions = JSON.parse(jsonMatch[0]) as Array<{
        type: string;
        label: string;
        params: Record<string, string>;
      }>;

      // Map character/location references to real IDs
      const actions: ActionSuggestion[] = [];
      for (const raw of rawActions) {
        const type = raw.type as ActionSuggestion['type'];
        if (!['talk', 'move', 'observe', 'perspective'].includes(type)) continue;

        const params: Record<string, string> = {};

        if (type === 'talk' && raw.params?.characterId) {
          const charRef = raw.params.characterId.replace('CHAR:', '');
          const matched = characters.find(c => this.shortName(c.name) === charRef || c.name.includes(charRef));
          if (matched) {
            params.characterId = matched.id;
          } else if (characters.length > 0) {
            // Best effort: pick first character if reference doesn't match
            params.characterId = characters[0].id;
          } else {
            continue; // Skip talk action if no characters
          }
        } else if (type === 'move' && raw.params?.locationId) {
          const locRef = raw.params.locationId.replace('LOC:', '');
          const matched = connectedLocations.find(l => l.name === locRef || l.name.includes(locRef));
          if (matched) {
            params.locationId = matched.id;
          } else if (connectedLocations.length > 0) {
            params.locationId = connectedLocations[0].id;
          } else {
            continue; // Skip move action if no connections
          }
        } else if (type === 'observe') {
          params.target = 'environment';
        }

        actions.push({ type, label: raw.label, params });
      }

      return actions.length > 0 ? actions : null;
    } finally {
      clearTimeout(timeout);
    }
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

  private getTimeLabel(timeOfDay: TimeOfDay): string {
    const labels: Record<TimeOfDay, string> = {
      dawn: '朝を待つ',
      morning: '昼まで過ごす',
      afternoon: '夕方の気配',
      evening: '夜を迎える',
      night: '眠りにつく',
      late_night: '朝を待つ',
    };
    return labels[timeOfDay];
  }
}

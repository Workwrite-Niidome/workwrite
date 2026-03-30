import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventSplitterService } from './event-splitter.service';

interface ExtractedLocation {
  name: string;
  description: string;
  type: 'interior' | 'exterior' | 'abstract';
  episodeIndices: number[];
}

@Injectable()
export class WorldBuilderService {
  private readonly logger = new Logger(WorldBuilderService.name);

  constructor(
    private prisma: PrismaService,
    private eventSplitter: EventSplitterService,
  ) {}

  async getWorldStatus(workId: string) {
    const [locations, events, schedules] = await Promise.all([
      this.prisma.worldLocation.count({ where: { workId } }),
      this.prisma.storyEvent.count({ where: { workId } }),
      this.prisma.characterSchedule.count({ where: { workId } }),
    ]);
    return { locations, events, schedules };
  }

  /**
   * Build world for any completed work. Fully automatic.
   * 1. Validate work is COMPLETED
   * 2. Extract locations from EpisodeAnalysis or episode text
   * 3. Create LocationConnections from co-occurrence
   * 4. Generate basic LocationRenderings
   * 5. Build CharacterSchedules
   * 6. Split episodes into StoryEvents
   */
  async buildWorld(workId: string): Promise<{
    locations: number; connections: number; renderings: number;
    schedules: number; events: number;
  }> {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { id: true, title: true, completionStatus: true },
    });
    if (!work) throw new BadRequestException('Work not found');
    if (work.completionStatus !== 'COMPLETED') {
      throw new BadRequestException('Interactive Novel is only available for completed works');
    }

    this.logger.log(`Building world for "${work.title}" (${workId})`);

    // Mark as building
    await this.prisma.work.update({
      where: { id: workId },
      data: { enableInteractiveNovel: true, interactiveNovelStatus: 'building' },
    });

    try {
      // Step 1: Get episodes and analyses
      const episodes = await this.prisma.episode.findMany({
        where: { workId, publishedAt: { not: null } },
        orderBy: { orderIndex: 'asc' },
        select: { id: true, orderIndex: true, content: true },
      });

      const analyses = await this.prisma.episodeAnalysis.findMany({
        where: { workId },
        include: { episode: { select: { orderIndex: true } } },
      });

      const characters = await this.prisma.storyCharacter.findMany({
        where: { workId },
        select: { id: true, name: true, role: true, personality: true },
      });

      // Step 2: Extract locations
      const extractedLocations = this.extractLocations(episodes, analyses);
      this.logger.log(`Extracted ${extractedLocations.length} locations`);

      // Clear existing data
      await this.prisma.storyEvent.deleteMany({ where: { workId } });
      await this.prisma.characterSchedule.deleteMany({ where: { workId } });
      // LocationRenderings are cascade-deleted when WorldLocations are deleted below
      await this.prisma.locationConnection.deleteMany({ where: { workId } });
      await this.prisma.worldLocation.deleteMany({ where: { workId } });

      // Create WorldLocations
      const locationMap = new Map<string, string>(); // name -> id
      for (const loc of extractedLocations) {
        const created = await this.prisma.worldLocation.create({
          data: {
            workId,
            name: loc.name,
            type: loc.type,
            description: loc.description,
            generationStatus: 'complete',
            derivedFrom: loc.episodeIndices.map(i => ({ orderIndex: i })),
          },
        });
        locationMap.set(loc.name, created.id);
      }

      // Step 3: Create connections (locations that appear in adjacent scenes)
      const connections = this.inferConnections(extractedLocations);
      let connCount = 0;
      for (const conn of connections) {
        const fromId = locationMap.get(conn.from);
        const toId = locationMap.get(conn.to);
        if (fromId && toId) {
          await this.prisma.locationConnection.create({
            data: { workId, fromLocationId: fromId, toLocationId: toId, description: conn.to },
          });
          connCount++;
        }
      }

      // Step 4: Generate basic LocationRenderings from descriptions
      let renderCount = 0;
      for (const loc of extractedLocations) {
        const locId = locationMap.get(loc.name);
        if (!locId) continue;

        const renderings = this.generateBasicRenderings(loc);
        for (const r of renderings) {
          await this.prisma.locationRendering.upsert({
            where: { locationId_timeOfDay: { locationId: locId, timeOfDay: r.timeOfDay } },
            create: { locationId: locId, timeOfDay: r.timeOfDay, sensoryText: r.sensoryText },
            update: { sensoryText: r.sensoryText },
          });
          renderCount++;
        }
      }

      // Step 5: Build CharacterSchedules
      let scheduleCount = 0;
      const schedules = this.buildCharacterSchedules(
        episodes, analyses, characters, locationMap,
      );
      if (schedules.length > 0) {
        await this.prisma.characterSchedule.createMany({ data: schedules });
        scheduleCount = schedules.length;
      }

      // Step 6: Split episodes into StoryEvents
      const eventCount = await this.eventSplitter.splitAllEpisodes(workId);

      // Mark as ready
      await this.prisma.work.update({
        where: { id: workId },
        data: { interactiveNovelStatus: 'ready', worldVersion: { increment: 1 } },
      });

      const result = {
        locations: extractedLocations.length,
        connections: connCount,
        renderings: renderCount,
        schedules: scheduleCount,
        events: eventCount,
      };
      this.logger.log(`World built: ${JSON.stringify(result)}`);
      return result;

    } catch (err) {
      await this.prisma.work.update({
        where: { id: workId },
        data: { interactiveNovelStatus: 'failed' },
      });
      throw err;
    }
  }

  /**
   * Extract locations from episode analyses or episode text.
   */
  private extractLocations(
    episodes: { id: string; orderIndex: number; content: string | null }[],
    analyses: any[],
  ): ExtractedLocation[] {
    const locationCounts = new Map<string, { desc: string; type: string; episodes: Set<number> }>();

    // From EpisodeAnalysis.locations (preferred)
    for (const analysis of analyses) {
      const locs = (analysis.locations as any[]) || [];
      const epIndex = analysis.episode?.orderIndex ?? 0;
      for (const loc of locs) {
        if (!loc.name) continue;
        const normalized = loc.name.trim();
        const existing = locationCounts.get(normalized);
        if (existing) {
          existing.episodes.add(epIndex);
          if (loc.description && loc.description.length > existing.desc.length) {
            existing.desc = loc.description;
          }
        } else {
          locationCounts.set(normalized, {
            desc: loc.description || normalized,
            type: this.guessLocationType(normalized, loc.description || ''),
            episodes: new Set([epIndex]),
          });
        }
      }
    }

    // If no analyses, extract from episode text
    if (locationCounts.size === 0) {
      for (const ep of episodes) {
        if (!ep.content) continue;
        const detected = this.detectLocationsFromText(ep.content);
        for (const loc of detected) {
          const existing = locationCounts.get(loc.name);
          if (existing) {
            existing.episodes.add(ep.orderIndex);
          } else {
            locationCounts.set(loc.name, {
              desc: loc.description,
              type: loc.type,
              episodes: new Set([ep.orderIndex]),
            });
          }
        }
      }
    }

    // Convert to array, sort by frequency (most common locations first)
    return Array.from(locationCounts.entries())
      .map(([name, data]) => ({
        name,
        description: data.desc,
        type: data.type as 'interior' | 'exterior' | 'abstract',
        episodeIndices: Array.from(data.episodes).sort((a, b) => a - b),
      }))
      .sort((a, b) => b.episodeIndices.length - a.episodeIndices.length)
      .slice(0, 20); // Max 20 locations
  }

  /**
   * Detect locations from episode text when EpisodeAnalysis is not available.
   */
  private detectLocationsFromText(content: string): { name: string; description: string; type: string }[] {
    const locations: { name: string; description: string; type: string }[] = [];

    // Scene break sections often start with location descriptions
    const sections = content.split(/\n\s*\*\*\*\s*\n/);
    for (const section of sections) {
      const firstLine = section.trim().split('\n')[0]?.replace(/^　+/, '').trim();
      if (!firstLine || firstLine.startsWith('「')) continue;

      // Look for location indicators
      if (/の中|に入る|に着く|の前|の扉|の部屋/.test(firstLine) && firstLine.length < 50) {
        locations.push({
          name: firstLine.replace(/[。、].*$/, '').slice(0, 20),
          description: firstLine,
          type: /外|路地|通り|公園|空|街/.test(firstLine) ? 'exterior' : 'interior',
        });
      }
    }

    return locations;
  }

  private guessLocationType(name: string, desc: string): string {
    const text = name + desc;
    if (/外|路地|通り|公園|街|広場|森|海|山|川|空|庭/.test(text)) return 'exterior';
    if (/夢|記憶|心|精神|意識|仮想|システム|データ/.test(text)) return 'abstract';
    return 'interior';
  }

  /**
   * Infer location connections from co-occurrence in episodes.
   * If two locations appear in the same episode, they're likely connected.
   */
  private inferConnections(locations: ExtractedLocation[]): { from: string; to: string }[] {
    const connections: { from: string; to: string }[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < locations.length; i++) {
      for (let j = i + 1; j < locations.length; j++) {
        // Check if they share any episodes
        const shared = locations[i].episodeIndices.some(e => locations[j].episodeIndices.includes(e));
        if (shared) {
          const key1 = `${locations[i].name}->${locations[j].name}`;
          const key2 = `${locations[j].name}->${locations[i].name}`;
          if (!seen.has(key1)) {
            connections.push({ from: locations[i].name, to: locations[j].name });
            connections.push({ from: locations[j].name, to: locations[i].name });
            seen.add(key1);
            seen.add(key2);
          }
        }
      }
    }

    return connections;
  }

  /**
   * Generate basic LocationRenderings from description text.
   * No AI call — just template-based sensory data.
   */
  private generateBasicRenderings(loc: ExtractedLocation): { timeOfDay: string; sensoryText: any }[] {
    const base = {
      visual: loc.description,
      auditory: '',
      olfactory: '',
      atmospheric: loc.type === 'exterior' ? '開放的な空気。' : '静かな空間。',
    };

    // Generate for 2 time periods
    return [
      {
        timeOfDay: 'afternoon',
        sensoryText: { ...base, visual: `${loc.description}`, atmospheric: '穏やかな午後。' },
      },
      {
        timeOfDay: 'evening',
        sensoryText: { ...base, visual: `${loc.description} 光が暮れていく。`, atmospheric: '夕暮れの空気。' },
      },
    ];
  }

  /**
   * Build CharacterSchedules from EpisodeAnalysis.characters.
   */
  private buildCharacterSchedules(
    episodes: { id: string; orderIndex: number; content: string | null }[],
    analyses: any[],
    characters: { id: string; name: string }[],
    locationMap: Map<string, string>,
  ): any[] {
    const schedules: any[] = [];
    const workId = episodes[0] ? (analyses[0]?.workId || '') : '';
    if (!workId) return schedules;

    // Build analysis map by episode
    const analysisByEp = new Map<string, any>();
    for (const a of analyses) analysisByEp.set(a.episodeId, a);

    // For each episode, check which characters appear and where
    for (const ep of episodes) {
      const analysis = analysisByEp.get(ep.id);
      const basePos = ep.orderIndex / episodes.length;
      const span = 1 / episodes.length;

      if (analysis?.characters) {
        const epChars = analysis.characters as any[];
        for (const epChar of epChars) {
          if (!epChar.name) continue;

          // Match to StoryCharacter
          const matched = characters.find(c => {
            const shortName = c.name.split('（')[0].split('(')[0].trim().split(/\s/)[0];
            return shortName === epChar.name || c.name.includes(epChar.name) || epChar.name.includes(shortName);
          });
          if (!matched) continue;

          // Determine location from analysis locations
          let locationId: string | null = null;
          if (analysis.locations) {
            const locs = analysis.locations as any[];
            if (locs.length > 0) {
              // Use first location that we have in our map
              for (const loc of locs) {
                const id = locationMap.get(loc.name);
                if (id) { locationId = id; break; }
              }
            }
          }

          // If no location from analysis, use first location
          if (!locationId && locationMap.size > 0) {
            locationId = locationMap.values().next().value ?? null;
          }

          schedules.push({
            characterId: matched.id,
            workId,
            timeStart: basePos,
            timeEnd: basePos + span,
            locationId,
            activity: epChar.action || '',
            mood: '',
            episodeId: ep.id,
          });
        }
      } else if (ep.content) {
        // Fallback: detect characters from episode text
        for (const char of characters) {
          const shortName = char.name.split('（')[0].split('(')[0].trim().split(/\s/)[0];
          if (shortName.length >= 1 && ep.content.includes(shortName)) {
            const locationId = locationMap.size > 0 ? (locationMap.values().next().value ?? null) : null;
            schedules.push({
              characterId: char.id,
              workId,
              timeStart: basePos,
              timeEnd: basePos + span,
              locationId,
              activity: '',
              mood: '',
              episodeId: ep.id,
            });
          }
        }
      }
    }

    return schedules;
  }

  // Keep seedAriaWorld for backward compatibility
  async seedAriaWorld(workId: string) {
    // Delegate to buildWorld for new calls
    return this.buildWorld(workId);
  }
}

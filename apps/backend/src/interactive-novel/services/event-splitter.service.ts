import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface RawScene {
  startOffset: number;
  endOffset: number;
  text: string;
  locationHint: string | null;
  characters: string[];
  hasDialogue: boolean;
  significance: 'key' | 'normal' | 'ambient';
}

@Injectable()
export class EventSplitterService {
  private readonly logger = new Logger(EventSplitterService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Split all episodes of a work into StoryEvents.
   * Assigns locations by keyword matching against WorldLocations.
   * Assigns characters by name matching against StoryCharacters.
   */
  async splitAllEpisodes(workId: string): Promise<number> {
    const episodes = await this.prisma.episode.findMany({
      where: { workId, publishedAt: { not: null } },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, orderIndex: true, content: true },
    });

    const locations = await this.prisma.worldLocation.findMany({
      where: { workId },
    });

    const characters = await this.prisma.storyCharacter.findMany({
      where: { workId },
      select: { id: true, name: true },
    });

    // Delete existing events for this work
    await this.prisma.storyEvent.deleteMany({ where: { workId } });

    let totalEvents = 0;

    for (const episode of episodes) {
      if (!episode.content) continue;

      const scenes = this.splitContent(episode.content);
      const timelineBase = episode.orderIndex / episodes.length;
      const timelineSpan = 1 / episodes.length;

      const events = scenes.map((scene, idx) => {
        const locationId = this.matchLocation(scene, locations);
        const charIds = this.matchCharacters(scene.text, characters);
        const position = timelineBase + (idx / Math.max(scenes.length, 1)) * timelineSpan;

        return {
          workId,
          episodeId: episode.id,
          orderInEpisode: idx,
          timelinePosition: Math.min(position, 0.999),
          locationId,
          characters: charIds.length > 0 ? charIds : undefined,
          emotionalTone: this.detectEmotion(scene.text),
          significance: scene.significance,
          textStartOffset: scene.startOffset,
          textEndOffset: scene.endOffset,
          summary: scene.text.slice(0, 100).replace(/^　+/, '').trim(),
        };
      });

      if (events.length > 0) {
        await this.prisma.storyEvent.createMany({ data: events });
        totalEvents += events.length;
      }

      this.logger.log(`Episode ${episode.orderIndex}: ${events.length} events`);
    }

    this.logger.log(`Total: ${totalEvents} events for work ${workId}`);
    return totalEvents;
  }

  /**
   * Split episode content into scenes by *** breaks and paragraph grouping.
   */
  private splitContent(content: string): RawScene[] {
    const scenes: RawScene[] = [];
    const parts = content.split(/(\n\s*\*\*\*\s*\n)/);

    let offset = 0;

    for (const part of parts) {
      const trimmed = part.trim();

      // Skip scene break markers
      if (/^\*\*\*$/.test(trimmed)) {
        offset += part.length;
        continue;
      }

      if (!trimmed) {
        offset += part.length;
        continue;
      }

      // Split this section into smaller scenes by paragraph groups (max ~500 chars per scene)
      const paragraphs = part.split(/\n{2,}/);
      let currentScene: string[] = [];
      let sceneStart = offset;

      for (const para of paragraphs) {
        const t = para.trim();
        if (!t) {
          offset += para.length + 2; // +2 for \n\n
          continue;
        }

        currentScene.push(t);
        const currentText = currentScene.join('\n');

        // Flush scene if it's getting long enough
        // But don't split in the middle of a dialogue sequence
        const prevIsDialogue = currentScene.length > 0 && currentScene[currentScene.length - 1].startsWith('「');
        const currentIsDialogue = t.startsWith('「');
        const inDialogueSequence = prevIsDialogue && currentIsDialogue;

        if (currentText.length > 600 || (!inDialogueSequence && currentText.length > 400 && currentScene.length > 1)) {
          const sceneText = currentScene.slice(0, -1).join('\n');
          if (sceneText.length > 10) {
            const endPos = offset;
            scenes.push(this.createScene(sceneText, sceneStart, endPos));
          }
          sceneStart = offset;
          currentScene = [t];
        }

        offset += para.length + 2;
      }

      // Flush remaining
      if (currentScene.length > 0) {
        const sceneText = currentScene.join('\n');
        if (sceneText.length > 10) {
          scenes.push(this.createScene(sceneText, sceneStart, offset));
        }
      }
    }

    return scenes;
  }

  private createScene(text: string, start: number, end: number): RawScene {
    const hasDialogue = /「[^」]+」/.test(text);

    return {
      startOffset: start,
      endOffset: end,
      text,
      locationHint: null, // Determined by matchLocation using WorldLocation data
      characters: [],
      hasDialogue,
      significance: hasDialogue && text.length > 200 ? 'key' : hasDialogue ? 'normal' : 'ambient',
    };
  }

  /**
   * Match a scene to a WorldLocation by checking if location name
   * or description keywords appear in the scene text.
   * Fully generic — works for any work with WorldLocation data.
   */
  private matchLocation(scene: RawScene, locations: any[]): string | null {
    // Score each location by how many keywords match
    let bestMatch: { id: string; score: number } | null = null;

    for (const loc of locations) {
      let score = 0;

      // Direct name match in text
      if (scene.text.includes(loc.name)) {
        score += 10;
      }

      // Short name match (first part before の or spaces)
      const shortName = loc.name.replace(/の.+$/, '').trim();
      if (shortName.length >= 2 && scene.text.includes(shortName)) {
        score += 5;
      }

      // Description keyword match (extract key nouns from description)
      if (loc.description) {
        const descWords = loc.description
          .replace(/[。、！？「」（）\s]/g, ' ')
          .split(/\s+/)
          .filter((w: string) => w.length >= 2);
        for (const word of descWords.slice(0, 10)) {
          if (scene.text.includes(word)) score += 1;
        }
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { id: loc.id, score };
      }
    }

    return bestMatch?.id || null;
  }

  /**
   * Match characters mentioned in scene text.
   */
  private matchCharacters(text: string, characters: { id: string; name: string }[]): any[] {
    const matched: any[] = [];
    for (const char of characters) {
      // Extract short name
      let shortName = char.name.split('（')[0].split('(')[0].trim();
      if (shortName.includes(' ')) shortName = shortName.split(' ')[0];
      if (shortName.includes('　')) shortName = shortName.split('　')[0];

      if (shortName.length >= 1 && text.includes(shortName)) {
        matched.push({ characterId: char.id, name: shortName });
      }
    }
    return matched;
  }

  /**
   * Simple emotion detection from text.
   */
  private detectEmotion(text: string): string {
    if (/泣|涙|悲し|切な/.test(text)) return '切なさ';
    if (/笑|嬉し|楽し|幸/.test(text)) return '温かさ';
    if (/怖|不安|震|恐/.test(text)) return '不安';
    if (/驚|衝撃|まさか/.test(text)) return '驚き';
    if (/静か|穏やか|ゆっくり/.test(text)) return '穏やか';
    return '日常';
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PerspectiveMode } from '../types/world.types';
import type { EventBlock } from '../types/experience.types';

@Injectable()
export class PerspectiveRendererService {
  constructor(private prisma: PrismaService) {}

  async renderEvent(
    event: {
      id: string; episodeId: string;
      textStartOffset: number; textEndOffset: number;
      significance: string; emotionalTone: string | null;
      summary?: string | null;
    },
    perspective: PerspectiveMode,
    readProgress: { episodeId: string; completed: boolean }[],
  ): Promise<EventBlock> {
    // Use summary (full scene text) if available, fall back to offset-based extraction
    let originalText = '';
    if (event.summary) {
      originalText = event.summary;
    } else {
      const episode = await this.prisma.episode.findUnique({
        where: { id: event.episodeId },
        select: { content: true },
      });
      originalText = episode?.content?.slice(event.textStartOffset, event.textEndOffset) || '';
    }
    if (!originalText.trim()) {
      return {
        storyEventId: event.id,
        renderedText: '',
        originalPassage: null,
        significance: event.significance as 'key' | 'normal' | 'ambient',
        spoilerProtected: false,
      };
    }

    // In Interactive Novel mode, the reader experiences events by being present.
    // Showing original text IS the experience. No spoiler protection needed
    // because the reader chose to be at this time/place.
    // (Future: may add spoiler protection for major plot twists)

    // Clean up the text
    const cleaned = originalText
      .replace(/^　+/gm, '')  // Remove leading full-width spaces
      .trim();

    // Check perspective cache
    const cached = await this.prisma.perspectiveCache.findUnique({
      where: { storyEventId_perspective: { storyEventId: event.id, perspective } },
    });

    if (cached) {
      return {
        storyEventId: event.id,
        renderedText: cached.renderedText,
        originalPassage: cleaned,
        significance: event.significance as 'key' | 'normal' | 'ambient',
        spoilerProtected: false,
      };
    }

    // Return original text directly (perspective adaptation is Phase 4)
    return {
      storyEventId: event.id,
      renderedText: cleaned,
      originalPassage: cleaned,
      significance: event.significance as 'key' | 'normal' | 'ambient',
      spoilerProtected: false,
    };
  }
}

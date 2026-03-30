import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PerspectiveMode } from '../types/world.types';
import type { EventBlock } from '../types/experience.types';

@Injectable()
export class PerspectiveRendererService {
  constructor(private prisma: PrismaService) {}

  async renderEvent(
    event: { id: string; episodeId: string; textStartOffset: number; textEndOffset: number; significance: string; emotionalTone: string | null },
    perspective: PerspectiveMode,
    readProgress: { episodeId: string; completed: boolean }[],
  ): Promise<EventBlock> {
    const hasRead = readProgress.some(p => p.episodeId === event.episodeId && p.completed);

    if (!hasRead) {
      // Spoiler protection: ambient only
      return {
        storyEventId: event.id,
        renderedText: this.generateAmbientHint(event.emotionalTone),
        originalPassage: null,
        significance: 'ambient',
        spoilerProtected: true,
      };
    }

    // Get original text from episode
    const episode = await this.prisma.episode.findUnique({
      where: { id: event.episodeId },
      select: { content: true },
    });

    const originalText = episode?.content?.slice(event.textStartOffset, event.textEndOffset) || '';

    // Check perspective cache
    const cached = await this.prisma.perspectiveCache.findUnique({
      where: { storyEventId_perspective: { storyEventId: event.id, perspective } },
    });

    if (cached) {
      return {
        storyEventId: event.id,
        renderedText: cached.renderedText,
        originalPassage: originalText,
        significance: event.significance as 'key' | 'normal' | 'ambient',
        spoilerProtected: false,
      };
    }

    // No cache: return original text directly (AI generation is Phase 4)
    return {
      storyEventId: event.id,
      renderedText: originalText.replace(/^　+/gm, ''),
      originalPassage: originalText,
      significance: event.significance as 'key' | 'normal' | 'ambient',
      spoilerProtected: false,
    };
  }

  private generateAmbientHint(emotionalTone: string | null): string {
    if (!emotionalTone) return '何かが起きている気配がする。';
    if (emotionalTone.includes('緊張') || emotionalTone.includes('不安')) return '空気が張り詰めている。';
    if (emotionalTone.includes('温') || emotionalTone.includes('穏')) return '穏やかな空気が流れている。';
    if (emotionalTone.includes('悲') || emotionalTone.includes('切')) return 'どこか切ない空気がある。';
    return '何かが起きた気配がする。';
  }
}

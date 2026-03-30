import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * EventSplitterService — Episode -> StoryEvent (offset-based)
 * Phase 1 implementation.
 */
@Injectable()
export class EventSplitterService {
  private readonly logger = new Logger(EventSplitterService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Split an episode into StoryEvents using scene breaks and dialogue patterns.
   */
  async splitEpisode(episodeId: string): Promise<number> {
    this.logger.log(`Splitting episode ${episodeId} into events`);

    // TODO: Phase 1 implementation
    // 1. Get episode content
    // 2. Detect scene breaks (***), dialogue blocks, description blocks
    // 3. Create StoryEvent records with textStartOffset/textEndOffset
    // 4. Assign locations and characters from EpisodeAnalysis

    return 0;
  }
}

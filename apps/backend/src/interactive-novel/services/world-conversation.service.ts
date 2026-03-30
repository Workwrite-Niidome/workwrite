import { Injectable, Logger } from '@nestjs/common';
import { CharacterTalkService } from '../../character-talk/character-talk.service';
import { ReaderStateService } from './reader-state.service';
import { CharacterPresenceService } from './character-presence.service';

/**
 * WorldConversationService — Wraps CharacterTalkService with world context.
 * Validates character presence at reader's location, injects world context.
 */
@Injectable()
export class WorldConversationService {
  private readonly logger = new Logger(WorldConversationService.name);

  constructor(
    private characterTalk: CharacterTalkService,
    private readerState: ReaderStateService,
    private characterPresence: CharacterPresenceService,
  ) {}

  async *streamWorldChat(
    userId: string,
    workId: string,
    characterId: string,
    message: string,
    useSonnet = false,
  ): AsyncGenerator<string> {
    // 1. Get reader's current state
    const state = await this.readerState.getState(userId, workId);
    if (!state) {
      yield JSON.stringify({ error: 'ワールドに入っていません' });
      return;
    }

    // 2. Validate character is present (skip if no schedule data yet)
    if (state.locationId) {
      const isPresent = await this.characterPresence.isCharacterAt(
        characterId, state.locationId, state.timelinePosition,
      );
      // If schedule data doesn't exist yet, allow anyway (graceful degradation)
      if (!isPresent) {
        const scheduleCount = await this.characterPresence.getCharactersAt(
          workId, state.locationId, state.timelinePosition,
        );
        if (scheduleCount.length > 0) {
          // Schedule data exists but character isn't here
          yield JSON.stringify({ error: 'このキャラクターは今ここにいません' });
          return;
        }
        // No schedule data: fall through to regular character talk
      }
    }

    // 3. Delegate to existing CharacterTalkService
    // The streamChat method is an AsyncGenerator
    const stream = this.characterTalk.streamChat(userId, workId, message, {
      mode: 'character',
      characterId,
      useSonnet,
    });

    for await (const chunk of stream) {
      yield chunk;
    }

    // 4. Record the encounter
    await this.readerState.recordJourney(userId, workId, 'talk', {
      characterId,
      messagePreview: message.slice(0, 50),
    }, state);
  }
}

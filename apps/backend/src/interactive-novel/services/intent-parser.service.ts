import { Injectable } from '@nestjs/common';
import type { ReaderAction } from '../types/reader.types';

interface SceneContext {
  availableLocations: { id: string; name: string }[];
  presentCharacters: { id: string; name: string }[];
}

@Injectable()
export class IntentParserService {
  /**
   * Two-tier intent parser.
   * Tier 1: Pattern matching (instant, no AI)
   * Tier 2: Returns null (AI fallback in Phase 4)
   */
  parseIntent(input: string, context: SceneContext): ReaderAction | null {
    const normalized = input.trim();

    // Check location names
    for (const loc of context.availableLocations) {
      if (normalized.includes(loc.name)) {
        return { type: 'move', params: { locationId: loc.id } };
      }
    }

    // Check character names
    for (const char of context.presentCharacters) {
      const shortName = char.name.split('（')[0].split('(')[0];
      if (normalized.includes(shortName)) {
        return { type: 'talk', params: { characterId: char.id, message: input } };
      }
    }

    // Observation verbs
    if (/見る|眺める|観察|look|observe|周り/.test(normalized)) {
      return { type: 'observe', params: { target: 'environment' } };
    }

    // Time verbs
    if (/次の日|翌日|明日|tomorrow|進む/.test(normalized)) {
      return { type: 'time_advance', params: {} };
    }

    // Perspective
    if (/主人公|一人称|protagonist/.test(normalized)) {
      return { type: 'perspective', params: { mode: 'protagonist' } };
    }
    if (/俯瞰|神|omniscient/.test(normalized)) {
      return { type: 'perspective', params: { mode: 'omniscient' } };
    }

    // Tier 2: AI fallback (Phase 4)
    return null;
  }
}

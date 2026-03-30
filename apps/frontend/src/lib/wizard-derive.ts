/**
 * wizard-derive.ts
 *
 * Pure data-transformation functions extracted from the creation wizard.
 * Keeping them here (instead of inline in components) allows isolated unit
 * testing with zero React / Next.js ceremony.
 */

import type { ActGroup, EpisodeCard } from '@/components/creation-wizard/wizard-shell';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DerivedChapter {
  title: string;
  summary: string;
  reason: string;
  readerEmotion: string;
  characters: string[];
  aiSuggested: boolean;
}

/**
 * Shape of a raw chapter record that may have come from either the new API
 * format (readerEmotion) or the old format (emotionTarget).
 */
export interface RawChapterRecord {
  title?: string;
  summary?: string;
  reason?: string;
  readerEmotion?: string;
  /** Legacy field — present in data saved before the field-mapping fix. */
  emotionTarget?: string;
}

export interface EmotionBlueprintInput {
  coreMessage: string;
  targetEmotions: string;
  readerJourney: string;
  inspiration: string;
  readerOneLiner: string;
}

export interface EmotionBlueprintPayload {
  coreMessage: string;
  targetEmotions: string;
  readerJourney: string;
  inspiration: string;
  readerOneLiner: string;
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Convert an array of ActGroups (from the wizard's plot structure step) into
 * the flat chapter-outline array expected by the API.
 *
 * Critical field mappings (these were the source of the bug that was fixed):
 *   EpisodeCard.whatHappens  -> DerivedChapter.summary      (one-to-one, NOT combined)
 *   EpisodeCard.whyItHappens -> DerivedChapter.reason       (separate field)
 *   EpisodeCard.emotionTarget -> DerivedChapter.readerEmotion (renamed)
 */
export function deriveChaptersFromActGroups(groups: ActGroup[]): DerivedChapter[] {
  const chapters: DerivedChapter[] = [];
  for (const group of groups) {
    for (const ep of group.episodes) {
      chapters.push({
        title: ep.title,
        summary: ep.whatHappens || '',
        reason: ep.whyItHappens || '',
        readerEmotion: ep.emotionTarget || '',
        characters: ep.characters,
        aiSuggested: ep.aiSuggested,
      });
    }
  }
  return chapters;
}

/**
 * Normalise a raw chapter record from storage/API into the canonical shape
 * used by the editor.  Handles backward compatibility: old records stored the
 * reader-emotion field as `emotionTarget`; new records use `readerEmotion`.
 */
export function normalizeChapterRecord(raw: RawChapterRecord): {
  title: string;
  summary: string;
  reason: string;
  readerEmotion: string;
} {
  return {
    title: raw.title || '',
    summary: raw.summary || '',
    reason: raw.reason || '',
    readerEmotion: raw.readerEmotion || raw.emotionTarget || '',
  };
}

/**
 * Build the emotionBlueprint payload for the API.
 * Returns null when all five fields are empty (avoids persisting a no-op record).
 */
export function buildEmotionBlueprintPayload(
  input: EmotionBlueprintInput,
): EmotionBlueprintPayload | null {
  const { coreMessage, targetEmotions, readerJourney, inspiration, readerOneLiner } = input;
  if (!coreMessage && !targetEmotions && !readerJourney && !inspiration && !readerOneLiner) {
    return null;
  }
  return { coreMessage, targetEmotions, readerJourney, inspiration, readerOneLiner };
}

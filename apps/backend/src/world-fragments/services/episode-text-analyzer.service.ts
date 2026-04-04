import { Injectable, Logger } from '@nestjs/common';

/**
 * EpisodeTextAnalyzerService
 *
 * Extracts structured data from episode text using code only (regex, string matching).
 * ZERO AI API calls. Pure code extraction for dialogue, character appearances, and scene splitting.
 */
@Injectable()
export class EpisodeTextAnalyzerService {
  private readonly logger = new Logger(EpisodeTextAnalyzerService.name);

  /**
   * Parse a character name string into searchable name variants.
   * Examples:
   *   "綾瀬 詩（あやせ うた）" -> ["綾瀬 詩", "綾瀬詩", "詩", "うた"]
   *   "蒼（あお）"            -> ["蒼", "あお"]
   *   "ミナ"                  -> ["ミナ"]
   *   "先生（せんせい）"       -> ["先生", "せんせい"]
   *   "小鳥遊 凛"             -> ["小鳥遊 凛", "小鳥遊凛", "凛"]
   */
  parseCharacterNameVariants(name: string): string[] {
    const variants: string[] = [];

    // Extract reading in parentheses: 名前（よみ）or 名前(よみ)
    const readingMatch = name.match(/^(.+?)[（(](.+?)[）)]$/);
    const baseName = readingMatch ? readingMatch[1].trim() : name.trim();
    const reading = readingMatch ? readingMatch[2].trim() : null;

    // Add the full base name
    variants.push(baseName);

    // If the base name has a space (family + given), extract parts
    const spaceSplit = baseName.split(/\s+/);
    if (spaceSplit.length >= 2) {
      // Add without-space variant: "綾瀬詩"
      variants.push(spaceSplit.join(''));
      // Add given name only (last part): "詩"
      const givenName = spaceSplit[spaceSplit.length - 1];
      if (givenName.length >= 1) {
        variants.push(givenName);
      }
    }

    // Add reading variants
    if (reading) {
      variants.push(reading);
      // If reading also has a space, add given-name reading
      const readingSplit = reading.split(/\s+/);
      if (readingSplit.length >= 2) {
        variants.push(readingSplit[readingSplit.length - 1]);
      }
    }

    // Deduplicate while preserving order
    return [...new Set(variants)];
  }

  /**
   * Build a complete name variants map from a list of character names.
   * Returns: Map<variant, canonicalName>
   * Longer variants are matched first to avoid false positives.
   */
  buildNameVariantsMap(characterNames: string[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const name of characterNames) {
      const variants = this.parseCharacterNameVariants(name);
      for (const variant of variants) {
        // Don't overwrite if a longer canonical name already maps to this variant
        if (!map.has(variant)) {
          map.set(variant, name);
        }
      }
    }
    return map;
  }

  /**
   * Extract all dialogue (text within Japanese quotation marks) from episode text.
   * For each quote, attempt to identify the speaker by searching the preceding text.
   */
  extractDialogue(
    content: string,
    characterNames: string[] = [],
  ): Array<{ line: string; speakerGuess: string | null; position: number }> {
    const results: Array<{ line: string; speakerGuess: string | null; position: number }> = [];

    // Build name variants map, sorted by variant length descending for greedy matching
    const nameMap = this.buildNameVariantsMap(characterNames);
    const sortedVariants = [...nameMap.keys()].sort((a, b) => b.length - a.length);

    // Match all text within Japanese quotation marks
    const dialogueRegex = /「([^」]+)」/g;
    let match: RegExpExecArray | null;

    while ((match = dialogueRegex.exec(content)) !== null) {
      const line = match[1];
      const position = match.index;

      // Search for speaker in the 100 characters before this quote
      const lookbackStart = Math.max(0, position - 100);
      const precedingText = content.slice(lookbackStart, position);

      let speakerGuess: string | null = null;

      // Try to find a character name in the preceding text
      // Prefer the name closest to the quote (last occurrence)
      let bestPos = -1;
      for (const variant of sortedVariants) {
        const idx = precedingText.lastIndexOf(variant);
        if (idx !== -1 && idx > bestPos) {
          bestPos = idx;
          speakerGuess = nameMap.get(variant) || null;
        }
      }

      results.push({ line, speakerGuess, position });
    }

    return results;
  }

  /**
   * Count how many times each character name appears in the episode text.
   * Uses all name variants for matching.
   */
  identifyCharacterAppearances(content: string, characterNames: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const name of characterNames) {
      counts.set(name, 0);
    }

    const nameMap = this.buildNameVariantsMap(characterNames);

    // For each variant, count occurrences and attribute to canonical name
    // Track which positions have been counted to avoid double-counting overlapping variants
    const sortedVariants = [...nameMap.keys()].sort((a, b) => b.length - a.length);

    for (const variant of sortedVariants) {
      const canonical = nameMap.get(variant)!;
      let searchFrom = 0;
      while (true) {
        const idx = content.indexOf(variant, searchFrom);
        if (idx === -1) break;
        counts.set(canonical, (counts.get(canonical) || 0) + 1);
        searchFrom = idx + variant.length;
      }
    }

    return counts;
  }

  /**
   * Split text on scene break markers.
   * Recognizes: ***, ---, ===, blank-line-surrounded markers, etc.
   */
  splitScenes(content: string): string[] {
    // Scene break patterns: lines consisting of *, -, =, or Unicode equivalents
    // Also match Japanese scene breaks like centered dots or marks
    const sceneBreakRegex = /\n\s*(?:\*{3,}|-{3,}|={3,}|＊{3,}|ー{3,}|・{3,}|◇{1,3}|◆{1,3}|□{1,3}|■{1,3})\s*\n/g;

    const scenes = content.split(sceneBreakRegex).map((s) => s.trim()).filter((s) => s.length > 0);

    // If no scene breaks found, return the whole content as one scene
    if (scenes.length <= 1) {
      return [content.trim()];
    }

    return scenes;
  }

  /**
   * Extract dialogue grouped by character, with surrounding context.
   */
  extractDialogueByCharacter(
    content: string,
    characterNames: string[],
  ): Map<string, Array<{ line: string; context: string }>> {
    const result = new Map<string, Array<{ line: string; context: string }>>();
    const dialogues = this.extractDialogue(content, characterNames);

    for (const d of dialogues) {
      if (!d.speakerGuess) continue;

      if (!result.has(d.speakerGuess)) {
        result.set(d.speakerGuess, []);
      }

      // Extract context: 50 chars before and after the quote
      const contextStart = Math.max(0, d.position - 50);
      // The full match including the quotes: 「line」
      const matchEnd = d.position + d.line.length + 2; // +2 for 「 and 」
      const contextEnd = Math.min(content.length, matchEnd + 50);
      const context = content.slice(contextStart, contextEnd);

      result.get(d.speakerGuess)!.push({ line: d.line, context });
    }

    return result;
  }

  /**
   * Find episodes most relevant to a wish text using code-only analysis.
   * Scores episodes by character name matches, keyword overlap, and dialogue keyword matches.
   */
  findRelevantEpisodes(
    wish: string,
    episodes: Array<{ orderIndex: number; title: string; content: string }>,
    characterNames: string[],
  ): Array<{ orderIndex: number; title: string; relevanceScore: number }> {
    // Extract character names mentioned in the wish
    const nameMap = this.buildNameVariantsMap(characterNames);
    const sortedVariants = [...nameMap.keys()].sort((a, b) => b.length - a.length);

    const wishCharacters = new Set<string>();
    for (const variant of sortedVariants) {
      if (wish.includes(variant)) {
        wishCharacters.add(nameMap.get(variant)!);
      }
    }

    // Extract keywords from the wish (remove common particles and short words)
    const wishKeywords = this.extractKeywords(wish);

    const scored: Array<{ orderIndex: number; title: string; relevanceScore: number }> = [];

    for (const ep of episodes) {
      let score = 0;
      const epContent = ep.content || '';

      // Score 1: Character name appearances (if character is mentioned in wish)
      if (wishCharacters.size > 0) {
        const appearances = this.identifyCharacterAppearances(epContent, [...wishCharacters]);
        for (const [, count] of appearances) {
          if (count > 0) {
            score += Math.min(count, 10) * 3; // Cap at 30 per character
          }
        }
      }

      // Score 2: Keyword matches between wish and episode content
      for (const keyword of wishKeywords) {
        if (epContent.includes(keyword)) {
          score += 5;
        }
        // Also check title
        if (ep.title && ep.title.includes(keyword)) {
          score += 10;
        }
      }

      // Score 3: Dialogue containing keywords from wish
      const dialogues = this.extractDialogue(epContent);
      for (const d of dialogues) {
        for (const keyword of wishKeywords) {
          if (d.line.includes(keyword)) {
            score += 2;
          }
        }
      }

      if (score > 0) {
        scored.push({
          orderIndex: ep.orderIndex,
          title: ep.title,
          relevanceScore: score,
        });
      }
    }

    // Sort by relevance descending
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return scored;
  }

  /**
   * Extract meaningful keywords from Japanese text.
   * Removes common particles, punctuation, and very short tokens.
   */
  private extractKeywords(text: string): string[] {
    // Remove common Japanese particles and conjunctions
    const particles = new Set([
      'の', 'が', 'を', 'に', 'は', 'で', 'と', 'も', 'か', 'へ',
      'から', 'まで', 'より', 'ね', 'よ', 'わ', 'な', 'だ', 'です',
      'ます', 'した', 'する', 'ない', 'ある', 'いる', 'れる', 'られる',
      'この', 'その', 'あの', 'どの', 'こと', 'もの', 'ため', 'とき',
      'たち', 'って', 'けど', 'でも', 'だけ', 'など', 'そう', 'こう',
      'ここ', 'そこ', 'あそこ', 'どこ',
    ]);

    // Split on whitespace, punctuation, and common delimiters
    const tokens = text
      .replace(/[、。！？「」『』（）\(\)\s・\n\r]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2)
      .filter((t) => !particles.has(t));

    return [...new Set(tokens)];
  }
}

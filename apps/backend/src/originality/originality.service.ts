import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Template weights for AI usage rate calculation.
 * 0.0 = editing existing text (校正/文体調整), does not count as AI-generated content
 * 1.0 = full content generation (続きを書く/章の書き出し)
 */
const TEMPLATE_WEIGHTS: Record<string, number> = {
  'continue-writing': 1.0,
  'chapter-opening': 1.0,
  'character-dev': 0.5,
  'plot-ideas': 0.3,
  'free-prompt': 0.8,
  'scene-enhance': 0.7,
  'dialogue-improve': 0.6,
  'proofread': 0.0,
  'style-adjust': 0.0,
  'synopsis-gen': 0.0,
};
const DEFAULT_WEIGHT = 0.5;

const AI_RATIO_THRESHOLD = 0.5;

/**
 * N-gram size for matching. 10 characters is long enough to avoid
 * matching common short phrases, but short enough that partial edits
 * only break a few N-grams rather than an entire sentence.
 */
const NGRAM_SIZE = 10;

@Injectable()
export class OriginalityService {
  private readonly logger = new Logger(OriginalityService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Calculate originality by comparing AI-generated text against episode content.
   * Uses sentence-level matching with template-based weighting.
   *
   * Algorithm (N-gram matching):
   * 1. Build a Set of all N-grams (10-char sliding window) from episode text
   * 2. For each AI output, extract N-grams and count how many exist in the episode set
   * 3. matched ratio per AI output = matched N-grams / total N-grams in that output
   * 4. Convert matched ratio to estimated matched characters, apply template weight
   * 5. originality = 1.0 - (weightedMatchedChars / totalChars)
   *
   * N-gram approach advantages over exact substring:
   * - Partial edits only break a few N-grams, not entire sentences
   * - No false positives from very short common phrases (N=10 is specific enough)
   * - Handles sentence restructuring gracefully
   */
  async recalculate(workId: string): Promise<void> {
    // 1. Get all AI generation history with template info
    const histories = await this.prisma.aiGenerationHistory.findMany({
      where: { workId },
      select: { messages: true, templateSlug: true },
    });

    // 2. Get all episode content
    const episodes = await this.prisma.episode.findMany({
      where: { workId },
      select: { content: true, wordCount: true },
    });
    const totalChars = episodes.reduce((sum, ep) => sum + (ep.wordCount || 0), 0);
    if (totalChars === 0) {
      await this.prisma.work.update({
        where: { id: workId },
        data: { originality: 1.0, isAiGenerated: false },
      });
      return;
    }

    // 3. Build N-gram set from all episode text
    const allEpisodeText = episodes.map((ep) => ep.content).join('\n');
    const episodeNgrams = this.buildNgramSet(allEpisodeText);

    // 4. Match each AI output against episode N-grams
    let weightedMatchedChars = 0;
    let totalMatchedChars = 0;

    for (const h of histories) {
      const msgs = h.messages as Array<{ role: string; content: string }>;
      if (!Array.isArray(msgs)) continue;

      const weight = TEMPLATE_WEIGHTS[h.templateSlug] ?? DEFAULT_WEIGHT;
      if (weight === 0) continue; // Skip zero-weight templates entirely

      for (const msg of msgs) {
        if (msg.role !== 'assistant' || !msg.content) continue;
        const text = msg.content.trim();
        if (text.length < NGRAM_SIZE) continue;

        // Calculate match ratio for this AI output
        const aiNgrams = this.extractNgrams(text);
        if (aiNgrams.length === 0) continue;

        let matched = 0;
        for (const ng of aiNgrams) {
          if (episodeNgrams.has(ng)) matched++;
        }

        const matchRatio = matched / aiNgrams.length;
        const estimatedMatchedChars = Math.round(text.length * matchRatio);

        totalMatchedChars += estimatedMatchedChars;
        weightedMatchedChars += estimatedMatchedChars * weight;
      }
    }

    // 5. Cap at total chars (can't exceed 100% AI)
    weightedMatchedChars = Math.min(weightedMatchedChars, totalChars);

    // 6. Calculate ratios
    const aiRatio = weightedMatchedChars / Math.max(totalChars, 1);
    const originality = Math.max(0, Math.min(1, 1.0 - aiRatio));
    const isAiGenerated = aiRatio >= AI_RATIO_THRESHOLD;

    // 7. Update work
    await this.prisma.work.update({
      where: { id: workId },
      data: { originality, isAiGenerated },
    });

    this.logger.log(
      `Originality for work ${workId}: ${originality.toFixed(2)} ` +
      `(weighted AI ratio: ${(aiRatio * 100).toFixed(1)}%, ` +
      `raw matched: ${totalMatchedChars}/${totalChars} chars, ` +
      `${histories.length} history records)`,
    );
  }

  /**
   * Build a Set of N-grams from text for O(1) lookup.
   * Strips whitespace/newlines from N-grams to handle formatting differences.
   */
  private buildNgramSet(text: string): Set<string> {
    const normalized = text.replace(/\s+/g, '');
    const set = new Set<string>();
    for (let i = 0; i <= normalized.length - NGRAM_SIZE; i++) {
      set.add(normalized.slice(i, i + NGRAM_SIZE));
    }
    return set;
  }

  /**
   * Extract N-grams from text as an array (preserving duplicates for ratio calculation).
   */
  private extractNgrams(text: string): string[] {
    const normalized = text.replace(/\s+/g, '');
    const ngrams: string[] = [];
    for (let i = 0; i <= normalized.length - NGRAM_SIZE; i++) {
      ngrams.push(normalized.slice(i, i + NGRAM_SIZE));
    }
    return ngrams;
  }

  /**
   * Get originality breakdown for display
   */
  async getBreakdown(workId: string) {
    await this.recalculate(workId);

    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { originality: true, isAiGenerated: true },
    });

    const histories = await this.prisma.aiGenerationHistory.findMany({
      where: { workId },
      select: { templateSlug: true },
    });

    const templateCounts: Record<string, number> = {};
    for (const h of histories) {
      templateCounts[h.templateSlug] = (templateCounts[h.templateSlug] || 0) + 1;
    }

    return {
      originality: work?.originality ?? 1.0,
      isAiGenerated: work?.isAiGenerated ?? false,
      templateCounts,
    };
  }
}

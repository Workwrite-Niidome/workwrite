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

@Injectable()
export class OriginalityService {
  private readonly logger = new Logger(OriginalityService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Calculate originality by comparing AI-generated text against episode content.
   * Uses sentence-level matching with template-based weighting.
   *
   * Algorithm:
   * 1. Get all AI generation history for this work (grouped by templateSlug)
   * 2. Get all episode content combined
   * 3. Split AI outputs into sentences, match against episode text
   * 4. Apply template weight to matched characters
   * 5. originality = 1.0 - (weightedMatchedChars / totalChars)
   * 6. Auto-flag isAiGenerated if originality < 0.5
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

    const allEpisodeText = episodes.map((ep) => ep.content).join('\n');

    // 3. Extract AI texts grouped by template weight
    let weightedMatchedChars = 0;
    let totalMatchedChars = 0;
    const alreadyCounted = new Set<string>();

    for (const h of histories) {
      const msgs = h.messages as Array<{ role: string; content: string }>;
      if (!Array.isArray(msgs)) continue;

      const weight = TEMPLATE_WEIGHTS[h.templateSlug] ?? DEFAULT_WEIGHT;
      if (weight === 0) continue; // Skip zero-weight templates entirely

      for (const msg of msgs) {
        if (msg.role !== 'assistant' || !msg.content) continue;
        const text = msg.content.trim();
        if (text.length < 50) continue;

        // Split into sentences for more granular matching
        const sentences = this.splitIntoSentences(text);

        for (const sentence of sentences) {
          if (sentence.length < 20) continue; // Skip very short sentences
          if (alreadyCounted.has(sentence)) continue;

          if (allEpisodeText.includes(sentence)) {
            totalMatchedChars += sentence.length;
            weightedMatchedChars += sentence.length * weight;
            alreadyCounted.add(sentence);
          }
        }
      }
    }

    // 4. Calculate ratios
    const aiRatio = weightedMatchedChars / Math.max(totalChars, 1);
    const originality = Math.max(0, Math.min(1, 1.0 - aiRatio));
    const isAiGenerated = aiRatio >= AI_RATIO_THRESHOLD;

    // 5. Update work
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
   * Split text into sentences using Japanese punctuation.
   * Returns sentences of reasonable length for matching.
   */
  private splitIntoSentences(text: string): string[] {
    // Split on Japanese sentence-ending punctuation, keeping delimiters
    const raw = text.split(/(?<=[。！？」』）\n])/);
    const sentences: string[] = [];
    let buffer = '';

    for (const part of raw) {
      buffer += part;
      // Flush when buffer is long enough (30+ chars) or at end
      if (buffer.length >= 30) {
        sentences.push(buffer.trim());
        buffer = '';
      }
    }
    // Remaining buffer — merge with last sentence or add as new
    if (buffer.trim().length >= 20) {
      sentences.push(buffer.trim());
    } else if (buffer.trim() && sentences.length > 0) {
      sentences[sentences.length - 1] += buffer;
    }

    return sentences;
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

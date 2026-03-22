import { Injectable } from '@nestjs/common';

interface EpisodeInput {
  content: string;
  title: string;
  orderIndex: number;
}

export interface TextSamples {
  opening: string;
  midpoint: string;
  climaxRegion: string;
  ending: string;
}

@Injectable()
export class SampleExtractorService {
  /**
   * Adaptive sample size based on total work length.
   * Longer works get larger samples to maintain coverage.
   */
  private getSampleSize(totalChars: number): number {
    if (totalChars < 20000) return 2000;     // Short: ~10% per sample
    if (totalChars < 50000) return 3000;     // Medium: ~6% per sample
    if (totalChars < 100000) return 4000;    // Long: ~4% per sample
    return 5000;                              // Very long: ~2-5% per sample
  }

  extract(episodes: EpisodeInput[]): TextSamples {
    if (episodes.length === 0) {
      return { opening: '', midpoint: '', climaxRegion: '', ending: '' };
    }

    const sorted = [...episodes].sort((a, b) => a.orderIndex - b.orderIndex);
    const totalChars = sorted.reduce((s, ep) => s + ep.content.length, 0);
    const size = this.getSampleSize(totalChars);

    if (sorted.length === 1) {
      return this.extractFromSingleEpisode(sorted[0].content, size);
    }

    const midIdx = Math.floor(sorted.length / 2);
    const climaxIdx = Math.floor(sorted.length * 0.75);
    const lastIdx = sorted.length - 1;

    return {
      opening: this.sampleStart(sorted[0], size),
      midpoint: this.sampleBestSection(sorted[midIdx], size),
      climaxRegion: this.sampleBestSection(sorted[climaxIdx], size),
      ending: this.sampleEnd(sorted[lastIdx], size),
    };
  }

  extractWithClimaxHint(
    episodes: EpisodeInput[],
    climaxEpisodeOrder?: number,
  ): TextSamples {
    if (!climaxEpisodeOrder) return this.extract(episodes);

    const sorted = [...episodes].sort((a, b) => a.orderIndex - b.orderIndex);
    if (sorted.length <= 1) return this.extract(episodes);

    const totalChars = sorted.reduce((s, ep) => s + ep.content.length, 0);
    const size = this.getSampleSize(totalChars);
    const midIdx = Math.floor(sorted.length / 2);
    const lastIdx = sorted.length - 1;

    const climaxEp = sorted.find((e) => e.orderIndex === climaxEpisodeOrder) ||
      sorted[Math.floor(sorted.length * 0.75)];

    return {
      opening: this.sampleStart(sorted[0], size),
      midpoint: this.sampleBestSection(sorted[midIdx], size),
      climaxRegion: this.sampleBestSection(climaxEp, size),
      ending: this.sampleEnd(sorted[lastIdx], size),
    };
  }

  private extractFromSingleEpisode(content: string, size: number): TextSamples {
    const quarterSize = Math.min(Math.floor(size / 2), Math.floor(content.length / 4));
    const q1 = Math.floor(content.length * 0.25);
    const q2 = Math.floor(content.length * 0.5);
    const q3 = Math.floor(content.length * 0.75);

    return {
      opening: content.slice(0, quarterSize),
      midpoint: content.slice(q1, q1 + quarterSize),
      climaxRegion: content.slice(q2, q2 + quarterSize),
      ending: content.slice(Math.max(q3, content.length - quarterSize)),
    };
  }

  private sampleStart(episode: EpisodeInput, size: number): string {
    const label = `【${episode.title}】\n`;
    return label + episode.content.slice(0, size);
  }

  /**
   * Instead of always taking the middle, find the most "interesting" section:
   * Look for dialogue-dense areas or scene transitions, then take a window around that.
   * Falls back to center if no interesting section is found.
   */
  private sampleBestSection(episode: EpisodeInput, size: number): string {
    const label = `【${episode.title}】\n`;
    const content = episode.content;
    if (content.length <= size) return label + content;

    // Find dialogue clusters: look for sections with high 「」 density
    const bestStart = this.findDialogueCluster(content, size);
    if (bestStart >= 0) {
      return label + content.slice(bestStart, bestStart + size);
    }

    // Fallback: center of the episode
    const start = Math.floor((content.length - size) / 2);
    return label + content.slice(start, start + size);
  }

  /**
   * Find a section of the episode with the highest dialogue density.
   * Slides a window across the text and counts 「」 pairs.
   */
  private findDialogueCluster(content: string, windowSize: number): number {
    if (content.length <= windowSize) return 0;

    const step = Math.max(500, Math.floor(windowSize / 4));
    let bestStart = -1;
    let bestCount = 0;

    for (let i = 0; i <= content.length - windowSize; i += step) {
      const window = content.slice(i, i + windowSize);
      const count = (window.match(/「/g) || []).length;
      if (count > bestCount) {
        bestCount = count;
        bestStart = i;
      }
    }

    // Only use dialogue cluster if it has at least 3 dialogues
    return bestCount >= 3 ? bestStart : -1;
  }

  private sampleEnd(episode: EpisodeInput, size: number): string {
    const label = `【${episode.title}】\n`;
    const content = episode.content;
    return label + content.slice(Math.max(0, content.length - size));
  }

  /**
   * Distributed sampling for long works (>150K chars).
   * Instead of reading only the first N episodes, samples from across the entire work:
   * - Opening (ep1)
   * - Early arc turning point (~15%)
   * - First quarter (~25%)
   * - Midpoint (~50%)
   * - Third quarter (~75%)
   * - Climax region (~85-90%)
   * - Ending (last episode)
   *
   * Returns 7 samples plus a list of sampled episode indices for transparency.
   */
  extractDistributed(episodes: EpisodeInput[]): DistributedSamples {
    if (episodes.length === 0) {
      return {
        samples: [],
        sampledEpisodeIndices: [],
      };
    }

    const sorted = [...episodes].sort((a, b) => a.orderIndex - b.orderIndex);
    const totalChars = sorted.reduce((s, ep) => s + ep.content.length, 0);
    const size = this.getSampleSize(totalChars);
    const len = sorted.length;

    // Pick 7 strategic positions across the work
    const positions = [
      { label: '冒頭', idx: 0 },
      { label: '序盤の転換点', idx: Math.floor(len * 0.15) },
      { label: '第一四半', idx: Math.floor(len * 0.25) },
      { label: '中盤', idx: Math.floor(len * 0.5) },
      { label: '第三四半', idx: Math.floor(len * 0.75) },
      { label: 'クライマックス付近', idx: Math.min(Math.floor(len * 0.88), len - 2) },
      { label: '結末', idx: len - 1 },
    ];

    // Deduplicate indices (for short works some might overlap)
    const seen = new Set<number>();
    const uniquePositions = positions.filter((p) => {
      const idx = Math.max(0, Math.min(p.idx, len - 1));
      if (seen.has(idx)) return false;
      seen.add(idx);
      return true;
    });

    const samples: { label: string; episodeTitle: string; content: string }[] = [];
    const sampledIndices: number[] = [];

    for (const pos of uniquePositions) {
      const idx = Math.max(0, Math.min(pos.idx, len - 1));
      const ep = sorted[idx];
      sampledIndices.push(idx);

      let content: string;
      if (pos.label === '冒頭') {
        content = this.sampleStart(ep, size);
      } else if (pos.label === '結末') {
        content = this.sampleEnd(ep, size);
      } else {
        content = this.sampleBestSection(ep, size);
      }

      samples.push({
        label: pos.label,
        episodeTitle: ep.title,
        content,
      });
    }

    return { samples, sampledEpisodeIndices: sampledIndices };
  }
}

export interface DistributedSamples {
  samples: { label: string; episodeTitle: string; content: string }[];
  sampledEpisodeIndices: number[];
}

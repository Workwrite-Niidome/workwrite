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
  private static readonly SAMPLE_SIZE = 2000;

  /**
   * Extract strategic text samples from 4 positions in the work.
   * For single-episode works, splits into quarters.
   */
  extract(episodes: EpisodeInput[]): TextSamples {
    if (episodes.length === 0) {
      return { opening: '', midpoint: '', climaxRegion: '', ending: '' };
    }

    const sorted = [...episodes].sort((a, b) => a.orderIndex - b.orderIndex);
    const size = SampleExtractorService.SAMPLE_SIZE;

    if (sorted.length === 1) {
      return this.extractFromSingleEpisode(sorted[0].content, size);
    }

    const midIdx = Math.floor(sorted.length / 2);
    const climaxIdx = Math.floor(sorted.length * 0.75);
    const lastIdx = sorted.length - 1;

    return {
      opening: this.sampleStart(sorted[0], size),
      midpoint: this.sampleMiddle(sorted[midIdx], size),
      climaxRegion: this.sampleMiddle(sorted[climaxIdx], size),
      ending: this.sampleEnd(sorted[lastIdx], size),
    };
  }

  /**
   * When EpisodeAnalysis intensity data is available, use it to find
   * the actual climax episode instead of the positional 75% heuristic.
   */
  extractWithClimaxHint(
    episodes: EpisodeInput[],
    climaxEpisodeOrder?: number,
  ): TextSamples {
    if (!climaxEpisodeOrder) return this.extract(episodes);

    const sorted = [...episodes].sort((a, b) => a.orderIndex - b.orderIndex);
    if (sorted.length <= 1) return this.extract(episodes);

    const size = SampleExtractorService.SAMPLE_SIZE;
    const midIdx = Math.floor(sorted.length / 2);
    const lastIdx = sorted.length - 1;

    const climaxEp = sorted.find((e) => e.orderIndex === climaxEpisodeOrder) ||
      sorted[Math.floor(sorted.length * 0.75)];

    return {
      opening: this.sampleStart(sorted[0], size),
      midpoint: this.sampleMiddle(sorted[midIdx], size),
      climaxRegion: this.sampleMiddle(climaxEp, size),
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

  private sampleMiddle(episode: EpisodeInput, size: number): string {
    const label = `【${episode.title}】\n`;
    const content = episode.content;
    if (content.length <= size) return label + content;
    const start = Math.floor((content.length - size) / 2);
    return label + content.slice(start, start + size);
  }

  private sampleEnd(episode: EpisodeInput, size: number): string {
    const label = `【${episode.title}】\n`;
    const content = episode.content;
    return label + content.slice(Math.max(0, content.length - size));
  }
}

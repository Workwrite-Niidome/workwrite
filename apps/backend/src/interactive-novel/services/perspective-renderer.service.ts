import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiSettingsService } from '../../ai-settings/ai-settings.service';
import type { PerspectiveMode } from '../types/world.types';
import type { EventBlock } from '../types/experience.types';

@Injectable()
export class PerspectiveRendererService {
  private readonly logger = new Logger(PerspectiveRendererService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
  ) {}

  async renderEvent(
    event: {
      id: string; episodeId: string;
      textStartOffset: number; textEndOffset: number;
      significance: string; emotionalTone: string | null;
      summary?: string | null;
    },
    perspective: PerspectiveMode,
    readProgress: { episodeId: string; completed: boolean }[],
  ): Promise<EventBlock> {
    // Use summary (full scene text) if available, fall back to offset-based extraction
    let originalText = '';
    if (event.summary) {
      originalText = event.summary;
    } else {
      const episode = await this.prisma.episode.findUnique({
        where: { id: event.episodeId },
        select: { content: true },
      });
      originalText = episode?.content?.slice(event.textStartOffset, event.textEndOffset) || '';
    }
    if (!originalText.trim()) {
      return {
        storyEventId: event.id,
        renderedText: '',
        originalPassage: null,
        significance: event.significance as 'key' | 'normal' | 'ambient',
        spoilerProtected: false,
      };
    }

    // Clean up the text
    const cleaned = originalText
      .replace(/^　+/gm, '')  // Remove leading full-width spaces
      .trim();

    // Check perspective cache
    const cached = await this.prisma.perspectiveCache.findUnique({
      where: { storyEventId_perspective: { storyEventId: event.id, perspective } },
    });

    if (cached) {
      return {
        storyEventId: event.id,
        renderedText: cached.renderedText,
        originalPassage: cleaned,
        significance: event.significance as 'key' | 'normal' | 'ambient',
        spoilerProtected: false,
      };
    }

    // Extract essence: the interactive experience is like a "movie version" of the novel.
    // Show only 2-4 memorable lines, not the full text.
    const essence = await this.extractEssence(cleaned);

    // Cache the result
    try {
      await this.prisma.perspectiveCache.create({
        data: {
          storyEventId: event.id,
          perspective,
          renderedText: essence,
        },
      });
    } catch (e) {
      // Unique constraint race condition — safe to ignore
      this.logger.debug(`PerspectiveCache write conflict for event ${event.id}, perspective ${perspective}`);
    }

    return {
      storyEventId: event.id,
      renderedText: essence,
      originalPassage: cleaned,
      significance: event.significance as 'key' | 'normal' | 'ambient',
      spoilerProtected: false,
    };
  }

  /**
   * Extract the essence of a scene — 2-4 memorable lines that convey atmosphere.
   * Short texts (<100 chars) are returned as-is.
   * Falls back to first + last sentence if AI is unavailable.
   */
  private async extractEssence(text: string): Promise<string> {
    if (text.length < 100) {
      return text;
    }

    try {
      const apiKey = await this.aiSettings.getApiKey();
      if (!apiKey) {
        this.logger.warn('No API key available for essence extraction, using fallback');
        return this.fallbackExtract(text);
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: 'あなたは小説の印象的な断片を選び出す専門家です。与えられたシーンから、読者の心に最も残る2-4行だけを抜き出してください。原文そのままの引用のみ。説明や注釈は不要です。雰囲気を伝える断片を選んでください。',
          messages: [
            {
              role: 'user',
              content: `以下のシーンから、読者の心に残る2-4行を抽出してください。原文そのまま。雰囲気を伝える断片だけ。\n\n---\n${text}\n---`,
            },
          ],
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Essence extraction API returned ${response.status}, using fallback`);
        return this.fallbackExtract(text);
      }

      const data = await response.json();
      const extracted = data?.content?.[0]?.text?.trim();

      if (!extracted) {
        this.logger.warn('Essence extraction returned empty content, using fallback');
        return this.fallbackExtract(text);
      }

      return extracted;
    } catch (e) {
      this.logger.warn(`Essence extraction failed: ${e instanceof Error ? e.message : e}, using fallback`);
      return this.fallbackExtract(text);
    }
  }

  /**
   * Fallback: take the first and last sentence of the text.
   * Captures opening atmosphere + closing impression.
   */
  private fallbackExtract(text: string): string {
    const sentences = text
      .split(/(?<=[。！？\n])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (sentences.length <= 2) {
      return text;
    }

    const first = sentences[0];
    const last = sentences[sentences.length - 1];
    return `${first}\n\n${last}`;
  }
}

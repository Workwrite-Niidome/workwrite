import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_VERSION = '2023-06-01';

export interface ExtractedCharacter {
  name: string;
  role: string;
}

@Injectable()
export class CharacterExtractionService {
  private readonly logger = new Logger(CharacterExtractionService.name);
  /** Track in-flight extractions to avoid duplicate API calls */
  private readonly inFlight = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
  ) {}

  /**
   * Trigger character extraction for an episode if not already extracted.
   * Runs in the background — does not block the caller.
   */
  triggerIfNeeded(episodeId: string) {
    if (this.inFlight.has(episodeId)) return;

    // Fire and forget
    this.extractIfNeeded(episodeId).catch((e) =>
      this.logger.warn(`Character extraction failed for episode ${episodeId}: ${e.message}`),
    );
  }

  /**
   * Trigger extraction for ALL published episodes of a work that haven't been extracted yet.
   * Called from getAvailableCharacters when extraction data is missing.
   * Processes sequentially to avoid API rate limits.
   */
  triggerWorkExtraction(workId: string) {
    if (this.inFlight.has(`work:${workId}`)) return;

    this.extractWork(workId).catch((e) =>
      this.logger.warn(`Work extraction failed for ${workId}: ${e.message}`),
    );
  }

  private async extractWork(workId: string) {
    this.inFlight.add(`work:${workId}`);
    try {
      const episodes = await this.prisma.episode.findMany({
        where: { workId, publishedAt: { not: null }, extractedCharacters: { equals: Prisma.DbNull } },
        select: { id: true },
        orderBy: { orderIndex: 'asc' },
      });

      this.logger.log(`Starting batch extraction for work ${workId}: ${episodes.length} episodes`);

      for (const ep of episodes) {
        await this.extractIfNeeded(ep.id);
      }
    } finally {
      this.inFlight.delete(`work:${workId}`);
    }
  }

  private async extractIfNeeded(episodeId: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      select: { id: true, title: true, content: true, extractedCharacters: true, publishedAt: true },
    });

    // Skip if already extracted, unpublished, or no content
    if (!episode || episode.extractedCharacters || !episode.publishedAt) return;
    if (!episode.content || episode.content.length < 50) return;

    this.inFlight.add(episodeId);
    try {
      const characters = await this.callHaiku(episode.title, episode.content);
      await this.prisma.episode.update({
        where: { id: episodeId },
        data: { extractedCharacters: characters as any },
      });
      this.logger.log(`Extracted ${characters.length} characters from episode ${episodeId}`);
    } finally {
      this.inFlight.delete(episodeId);
    }
  }

  private async callHaiku(title: string, content: string): Promise<ExtractedCharacter[]> {
    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) {
      this.logger.warn('No API key available for character extraction');
      return [];
    }

    // Truncate long content to save tokens (first 8000 chars is enough for character identification)
    const truncated = content.length > 8000 ? content.slice(0, 8000) + '\n...(以下省略)' : content;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 1000,
        system: `あなたは小説のテキストから、そのシーンに物理的に存在するキャラクターを抽出するアシスタントです。

【抽出対象】
- そのシーンで台詞を発している人物
- そのシーンで物理的に行動している人物（歩く、戦う、座る等）
- そのシーンで他の人物と直接対面・会話している人物

【抽出しない】
- 回想・思い出の中だけに登場する人物
- 噂話・伝聞で名前が出るだけの人物
- 手紙・メッセージの送り主（その場にいない場合）
- ナレーションで言及されるだけの人物
- 既に死亡・退場しておりそのシーンに物理的にいない人物

JSON配列のみを返してください。説明は不要です。
形式: [{"name": "キャラ名", "role": "主人公/ヒロイン/仲間/敵/脇役 等"}]`,
        messages: [{
          role: 'user',
          content: `以下の小説テキストから、実際に登場するキャラクターを抽出してください。\n\nタイトル: ${title}\n\n${truncated}`,
        }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    try {
      // Extract JSON array from response
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((c: any) => c.name && typeof c.name === 'string')
        .map((c: any) => ({ name: c.name.trim(), role: (c.role || '不明').trim() }));
    } catch {
      this.logger.warn(`Failed to parse character extraction response: ${text.slice(0, 200)}`);
      return [];
    }
  }
}

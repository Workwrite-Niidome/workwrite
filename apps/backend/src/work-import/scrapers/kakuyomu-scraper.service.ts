import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface ScrapedWork {
  title: string;
  synopsis: string;
  genre: string;
  episodes: { title: string; content: string }[];
}

interface GraphQLWork {
  id: string;
  title: string;
  introduction: string | null;
  genre: string | null;
  publicEpisodeCount: number;
  tableOfContents: {
    episodeUnions: {
      __typename: string;
      id?: string;
      title?: string;
    }[];
  }[];
}

@Injectable()
export class KakuyomuScraperService {
  private readonly logger = new Logger(KakuyomuScraperService.name);
  private static readonly RATE_LIMIT_MS = 2000;
  private static readonly MAX_EPISODES = 500;
  private static readonly GRAPHQL_URL = 'https://kakuyomu.jp/graphql';

  /** Extract workId from URL like kakuyomu.jp/works/1234567890 */
  parseUrl(url: string): string | null {
    const match = url.match(/kakuyomu\.jp\/works\/(\d+)/i);
    return match ? match[1] : null;
  }

  async scrape(url: string, onProgress?: (imported: number, total: number) => void): Promise<ScrapedWork> {
    const workId = this.parseUrl(url);
    if (!workId) throw new Error('無効なカクヨムURLです。例: https://kakuyomu.jp/works/1234567890');

    // 1. Fetch work metadata + full episode list via GraphQL API
    const work = await this.fetchWorkViaGraphQL(workId);

    const title = work.title || '無題';
    const synopsis = work.introduction || '';
    const genre = work.genre || 'その他';

    // 2. Build episode URL list from GraphQL TOC
    const episodeUrls: { title: string; url: string }[] = [];
    for (const chapter of work.tableOfContents) {
      for (const ep of chapter.episodeUnions) {
        if (ep.__typename === 'Episode' && ep.id && ep.title) {
          episodeUrls.push({
            title: ep.title,
            url: `https://kakuyomu.jp/works/${workId}/episodes/${ep.id}`,
          });
        }
      }
    }

    const totalEpisodes = Math.min(episodeUrls.length, KakuyomuScraperService.MAX_EPISODES);

    if (totalEpisodes === 0) {
      throw new Error('エピソードが見つかりませんでした。URLを確認してください。');
    }

    this.logger.log(`Kakuyomu work ${workId}: ${title} — ${totalEpisodes} episodes to fetch`);

    // 3. Fetch episode content via HTML scraping
    const episodes: { title: string; content: string }[] = [];
    for (let i = 0; i < totalEpisodes; i++) {
      const ep = episodeUrls[i];
      await this.sleep(KakuyomuScraperService.RATE_LIMIT_MS);
      try {
        const content = await this.fetchEpisodeContent(ep.url);
        episodes.push({ title: ep.title, content });
      } catch (e) {
        this.logger.warn(`Failed to fetch episode ${i + 1}: ${e}`);
        episodes.push({ title: ep.title, content: '' });
      }
      onProgress?.(i + 1, totalEpisodes);
    }

    return {
      title,
      synopsis,
      genre,
      episodes: episodes.filter((ep) => ep.content.length > 0),
    };
  }

  private async fetchWorkViaGraphQL(workId: string): Promise<GraphQLWork> {
    const query = `{
      work(id: "${workId}") {
        id
        title
        introduction
        genre
        publicEpisodeCount
        tableOfContents {
          episodeUnions {
            __typename
            ... on Episode { id title }
          }
        }
      }
    }`;

    const res = await fetch(KakuyomuScraperService.GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Workwrite/1.0)',
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      throw new Error(`カクヨムGraphQL API応答エラー: ${res.status}`);
    }

    const data = await res.json();
    if (data.errors?.length > 0) {
      throw new Error(`カクヨムGraphQL エラー: ${data.errors[0].message}`);
    }

    const work = data.data?.work;
    if (!work) {
      throw new Error('カクヨム作品が見つかりませんでした。URLを確認してください。');
    }

    return work;
  }

  private async fetchEpisodeContent(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Workwrite/1.0 (Novel Analysis Tool)' },
    });
    if (!res.ok) throw new Error(`エピソード取得失敗: ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    // Primary content selector
    const content = $('.widget-episodeBody').text().trim();
    if (content) return content;

    // Fallback selectors
    const alt = $('div.js-episode-body').text().trim();
    if (alt) return alt;

    const body = $('div[class*="EpisodeBody"]').text().trim();
    if (body) return body;

    // Last resort: main content area
    const main = $('main').text().trim();
    return main.slice(0, 50000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

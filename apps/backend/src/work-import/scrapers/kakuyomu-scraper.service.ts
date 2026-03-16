import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface ScrapedWork {
  title: string;
  synopsis: string;
  genre: string;
  episodes: { title: string; content: string }[];
}

@Injectable()
export class KakuyomuScraperService {
  private readonly logger = new Logger(KakuyomuScraperService.name);
  private static readonly RATE_LIMIT_MS = 2000;
  private static readonly MAX_EPISODES = 500;

  /** Extract workId from URL like kakuyomu.jp/works/1234567890 */
  parseUrl(url: string): string | null {
    const match = url.match(/kakuyomu\.jp\/works\/(\d+)/i);
    return match ? match[1] : null;
  }

  async scrape(url: string, onProgress?: (imported: number, total: number) => void): Promise<ScrapedWork> {
    const workId = this.parseUrl(url);
    if (!workId) throw new Error('無効なカクヨムURLです。例: https://kakuyomu.jp/works/1234567890');

    // 1. Fetch TOC page (contains metadata + episode list)
    const tocUrl = `https://kakuyomu.jp/works/${workId}`;
    const res = await fetch(tocUrl, {
      headers: { 'User-Agent': 'Workwrite/1.0 (Novel Analysis Tool)' },
    });
    if (!res.ok) throw new Error(`カクヨム作品ページ取得失敗: ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    // 2. Extract metadata
    const title = $('h1#workTitle a').text().trim()
      || $('h1.Heading_heading__0lWiH').text().trim()
      || $('meta[property="og:title"]').attr('content')
      || '無題';

    const synopsis = $('p#introduction').text().trim()
      || $('div.ui-truncateText').text().trim()
      || $('meta[property="og:description"]').attr('content')
      || '';

    const genreEl = $('a[href*="/genres/"]').first().text().trim();
    const genre = genreEl || 'その他';

    // 3. Extract episode URLs from TOC
    const episodeUrls: { title: string; url: string }[] = [];

    // Primary selector: episode link elements
    $('a.widget-toc-episode-episodeTitle, a[href*="/episodes/"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      if (href.includes('/episodes/')) {
        const epTitle = $el.text().trim()
          || $el.find('span').text().trim();
        const fullUrl = href.startsWith('http') ? href : `https://kakuyomu.jp${href}`;
        if (epTitle && !episodeUrls.some((e) => e.url === fullUrl)) {
          episodeUrls.push({ title: epTitle, url: fullUrl });
        }
      }
    });

    const totalEpisodes = Math.min(episodeUrls.length, KakuyomuScraperService.MAX_EPISODES);

    if (totalEpisodes === 0) {
      throw new Error('エピソードが見つかりませんでした。URLを確認してください。');
    }

    // 4. Fetch episodes
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

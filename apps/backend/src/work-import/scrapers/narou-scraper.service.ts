import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface ScrapedWork {
  title: string;
  synopsis: string;
  genre: string;
  episodes: { title: string; content: string }[];
}

@Injectable()
export class NarouScraperService {
  private readonly logger = new Logger(NarouScraperService.name);
  private static readonly RATE_LIMIT_MS = 1000;
  private static readonly MAX_EPISODES = 500;
  private static readonly BATCH_SIZE = 50;

  /** Extract ncode from URL like ncode.syosetu.com/n1234ab/ */
  parseUrl(url: string): string | null {
    const match = url.match(/ncode\.syosetu\.com\/(n\w+)/i);
    return match ? match[1] : null;
  }

  async scrape(url: string, onProgress?: (imported: number, total: number) => void): Promise<ScrapedWork> {
    const ncode = this.parseUrl(url);
    if (!ncode) throw new Error('無効ななろうURLです。例: https://ncode.syosetu.com/n1234ab/');

    // 1. Fetch metadata via API
    const meta = await this.fetchMetadata(ncode);

    // 2. Determine episode count from TOC
    const episodeUrls = await this.fetchToc(ncode);
    const totalEpisodes = Math.min(episodeUrls.length, NarouScraperService.MAX_EPISODES);

    if (totalEpisodes === 0) {
      // Short story (single page)
      const content = await this.fetchEpisodeContent(`https://ncode.syosetu.com/${ncode}/`);
      return {
        title: meta.title,
        synopsis: meta.synopsis,
        genre: meta.genre,
        episodes: [{ title: meta.title, content }],
      };
    }

    // 3. Fetch episodes in batches
    const episodes: { title: string; content: string }[] = [];
    for (let i = 0; i < totalEpisodes; i++) {
      const ep = episodeUrls[i];
      await this.sleep(NarouScraperService.RATE_LIMIT_MS);
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
      title: meta.title,
      synopsis: meta.synopsis,
      genre: meta.genre,
      episodes: episodes.filter((ep) => ep.content.length > 0),
    };
  }

  private async fetchWithRetry(url: string, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Workwrite/1.0 (Novel Analysis Tool)' },
        });
        if (res.status === 429 || res.status >= 500) {
          this.logger.warn(`Fetch ${url} returned ${res.status}, retry ${i + 1}/${retries}`);
          await this.sleep(3000 * (i + 1));
          continue;
        }
        return res;
      } catch (e) {
        this.logger.warn(`Fetch ${url} failed: ${e}, retry ${i + 1}/${retries}`);
        if (i === retries - 1) throw e;
        await this.sleep(3000 * (i + 1));
      }
    }
    throw new Error(`${retries}回リトライしましたが取得に失敗しました: ${url}`);
  }

  private async fetchMetadata(ncode: string): Promise<{ title: string; synopsis: string; genre: string }> {
    const apiUrl = `https://api.syosetu.com/novelapi/api/?of=t-s-ga-k-g&ncode=${ncode}&out=json`;
    const res = await this.fetchWithRetry(apiUrl);
    if (!res.ok) throw new Error(`なろうAPI応答エラー: ${res.status}`);

    const data = await res.json();
    // First element is count, second is the actual data
    const novel = data[1];
    if (!novel) throw new Error('作品が見つかりませんでした');

    const genreMap: Record<number, string> = {
      101: 'romance', 102: 'romance',
      201: 'fantasy', 202: 'fantasy',
      301: 'literary', 302: 'drama', 303: 'historical', 304: 'mystery',
      305: 'horror', 306: 'adventure', 307: 'comedy',
      401: 'sf', 402: 'sf', 403: 'sf', 404: 'sf',
      9801: 'other',
      9901: 'other', 9902: 'other', 9999: 'other',
    };

    return {
      title: novel.title || '無題',
      synopsis: novel.story || '',
      genre: genreMap[novel.genre] || 'その他',
    };
  }

  private async fetchToc(ncode: string): Promise<{ title: string; url: string }[]> {
    const allEpisodes: { title: string; url: string }[] = [];
    let page = 1;

    while (true) {
      const tocUrl = page === 1
        ? `https://ncode.syosetu.com/${ncode}/`
        : `https://ncode.syosetu.com/${ncode}/?p=${page}`;

      const res = await this.fetchWithRetry(tocUrl);
      if (!res.ok) {
        if (page === 1) throw new Error(`目次ページの取得に失敗: ${res.status}`);
        break;
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      const pageEpisodes: { title: string; url: string }[] = [];

      // Current layout (2025+): .p-eplist__subtitle a
      $('.p-eplist__subtitle a').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href');
        const title = $el.text().trim();
        if (href && title) {
          const fullUrl = href.startsWith('http') ? href : `https://ncode.syosetu.com${href}`;
          if (!allEpisodes.some((e) => e.url === fullUrl)) {
            pageEpisodes.push({ title, url: fullUrl });
          }
        }
      });

      // Legacy layout: .novel_sublist2 a
      if (pageEpisodes.length === 0) {
        $('.novel_sublist2 a').each((_, el) => {
          const $el = $(el);
          const href = $el.attr('href');
          const title = $el.text().trim();
          if (href && title) {
            const fullUrl = href.startsWith('http') ? href : `https://ncode.syosetu.com${href}`;
            if (!allEpisodes.some((e) => e.url === fullUrl)) {
              pageEpisodes.push({ title, url: fullUrl });
            }
          }
        });
      }

      // Fallback: match links by ncode pattern
      if (pageEpisodes.length === 0 && page === 1) {
        $('a[href*="/' + ncode + '/"]').each((_, el) => {
          const $el = $(el);
          const href = $el.attr('href') || '';
          if (/\/\d+\/?$/.test(href)) {
            const title = $el.text().trim();
            const fullUrl = href.startsWith('http') ? href : `https://ncode.syosetu.com${href}`;
            if (title && !allEpisodes.some((e) => e.url === fullUrl)) {
              pageEpisodes.push({ title, url: fullUrl });
            }
          }
        });
      }

      if (pageEpisodes.length === 0) break;

      allEpisodes.push(...pageEpisodes);

      // Check for next page link
      const hasNextPage = $(`a[href*="?p=${page + 1}"]`).length > 0
        || $('a.c-pager__item--next').length > 0;
      if (!hasNextPage) break;

      page++;
      await this.sleep(NarouScraperService.RATE_LIMIT_MS);
    }

    this.logger.log(`Narou ${ncode}: found ${allEpisodes.length} episodes across ${page} TOC pages`);
    return allEpisodes;
  }

  private async fetchEpisodeContent(url: string): Promise<string> {
    const res = await this.fetchWithRetry(url);
    if (!res.ok) throw new Error(`エピソード取得失敗: ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    // Current layout (2025+): .p-novel__body or .js-novel-text
    const newLayout = $('.p-novel__body .js-novel-text').text().trim();
    if (newLayout) return newLayout;

    const novelBody = $('.p-novel__body').text().trim();
    if (novelBody) return novelBody;

    // Legacy layout: #novel_honbun
    const legacy = $('#novel_honbun').text().trim();
    if (legacy) return legacy;

    // Fallback: .novel_view
    const alt = $('.novel_view').text().trim();
    if (alt) return alt;

    // Last resort: extract text from main content area only (avoid nav/footer)
    const main = $('main').text().trim() || $('#container').text().trim();
    if (main) return main.slice(0, 50000);

    return $('body').text().trim().slice(0, 50000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

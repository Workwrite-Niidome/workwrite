import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { CreditService } from '../billing/credit.service';
import { AnalyzeTextDto, ImportTextDto, ImportUrlDto } from './dto/work-import.dto';
import { NarouScraperService } from './scrapers/narou-scraper.service';
import { KakuyomuScraperService } from './scrapers/kakuyomu-scraper.service';

export interface DetectedChapter {
  title: string;
  content: string;
  startLine: number;
}

@Injectable()
export class WorkImportService {
  private readonly logger = new Logger(WorkImportService.name);

  private static readonly IMPORT_CREDIT_COST = 1;

  constructor(
    private prisma: PrismaService,
    private scoringService: ScoringService,
    private creditService: CreditService,
    private narouScraper: NarouScraperService,
    private kakuyomuScraper: KakuyomuScraperService,
  ) {}

  analyzeText(dto: AnalyzeTextDto): { chapters: DetectedChapter[] } {
    const lines = dto.text.split('\n');
    const chapters: DetectedChapter[] = [];
    let currentTitle = '';
    let currentContent: string[] = [];
    let currentStartLine = 0;

    const chapterPattern =
      /^(第[一二三四五六七八九十百千万\d]+[章話節回]|Chapter\s+\d+|Episode\s+\d+|---+|\*\*\*+)\s*(.*)?$/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.trim().match(chapterPattern);

      if (match) {
        if (currentContent.length > 0 || currentTitle) {
          const content = currentContent.join('\n').trim();
          if (content) {
            chapters.push({
              title: currentTitle || `チャプター ${chapters.length + 1}`,
              content,
              startLine: currentStartLine,
            });
          }
        }
        if (/^(-{3,}|\*{3,})$/.test(match[1])) {
          currentTitle = `チャプター ${chapters.length + 1}`;
        } else {
          currentTitle = (match[2] || match[1]).trim();
        }
        currentContent = [];
        currentStartLine = i;
        continue;
      }

      currentContent.push(line);
    }

    const lastContent = currentContent.join('\n').trim();
    if (lastContent) {
      chapters.push({
        title: currentTitle || `チャプター ${chapters.length + 1}`,
        content: lastContent,
        startLine: currentStartLine,
      });
    }

    if (chapters.length === 0 && dto.text.trim()) {
      chapters.push({
        title: 'チャプター 1',
        content: dto.text.trim(),
        startLine: 0,
      });
    }

    return { chapters };
  }

  async importText(userId: string, dto: ImportTextDto) {
    const importRecord = await this.prisma.workImport.create({
      data: {
        userId,
        source: 'text_paste',
        status: 'PROCESSING',
        totalChapters: dto.chapters.length,
      },
    });

    try {
      const work = await this.prisma.work.create({
        data: {
          authorId: userId,
          title: dto.title,
          synopsis: dto.synopsis || null,
          genre: dto.genre || null,
          status: 'DRAFT',
        },
      });

      for (let i = 0; i < dto.chapters.length; i++) {
        const ch = dto.chapters[i];
        await this.prisma.episode.create({
          data: {
            workId: work.id,
            authorId: userId,
            title: ch.title,
            content: ch.content,
            orderIndex: i,
            wordCount: ch.content.length,
            publishedAt: new Date(), // インポートしたエピソードは即公開
          },
        });
      }

      await this.prisma.workImport.update({
        where: { id: importRecord.id },
        data: {
          workId: work.id,
          status: 'COMPLETED',
          importedChapters: dto.chapters.length,
        },
      });

      return { workId: work.id, importId: importRecord.id, chapters: dto.chapters.length };
    } catch (e) {
      await this.prisma.workImport.update({
        where: { id: importRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: e instanceof Error ? e.message : 'Unknown error',
        },
      });
      throw e;
    }
  }

  async importFromUrl(userId: string, dto: ImportUrlDto) {
    const url = dto.url.trim();
    const autoScore = dto.autoScore !== false; // default true

    this.logger.log(`importFromUrl: url=${url}, userId=${userId}`);

    // Detect platform
    const isNarou = this.narouScraper.parseUrl(url) !== null;
    const isKakuyomu = this.kakuyomuScraper.parseUrl(url) !== null;

    if (!isNarou && !isKakuyomu) {
      throw new BadRequestException('対応していないURLです。小説家になろう (ncode.syosetu.com) またはカクヨム (kakuyomu.jp) のURLを入力してください。');
    }

    // Check for duplicate import
    const existing = await this.prisma.workImport.findFirst({
      where: { sourceUrl: url, status: 'COMPLETED' },
    });
    if (existing) {
      throw new BadRequestException('このURLは既にインポート済みです。同じ作品を再インポートする場合は、先に既存の作品を削除してください。');
    }

    const source = isNarou ? 'url_narou' : 'url_kakuyomu';

    // Consume credits for import
    let importTransactionId: string | null = null;
    try {
      const result = await this.creditService.consumeCredits(
        userId,
        WorkImportService.IMPORT_CREDIT_COST,
        'url_import',
      );
      importTransactionId = result.transactionId;
    } catch (e) {
      this.logger.warn(`Credit consumption failed for URL import: ${e}`);
      throw e;
    }

    // Create import record
    const importRecord = await this.prisma.workImport.create({
      data: {
        userId,
        source,
        sourceUrl: url,
        status: 'PROCESSING',
      },
    });

    try {
      // Scrape
      const scraper = isNarou ? this.narouScraper : this.kakuyomuScraper;
      const scraped = await scraper.scrape(url, async (imported, total) => {
        // Update progress
        await this.prisma.workImport.update({
          where: { id: importRecord.id },
          data: { importedChapters: imported, totalChapters: total },
        }).catch(() => {});
      });

      if (scraped.episodes.length === 0) {
        throw new Error('エピソードを取得できませんでした。');
      }

      // Create work + episodes
      const work = await this.prisma.work.create({
        data: {
          authorId: userId,
          title: scraped.title,
          synopsis: scraped.synopsis || null,
          genre: scraped.genre || null,
          status: 'DRAFT',
        },
      });

      for (let i = 0; i < scraped.episodes.length; i++) {
        const ep = scraped.episodes[i];
        await this.prisma.episode.create({
          data: {
            workId: work.id,
            authorId: userId,
            title: ep.title,
            content: ep.content,
            orderIndex: i,
            wordCount: ep.content.length,
            publishedAt: new Date(), // インポートしたエピソードは即公開
          },
        });
      }

      // Update import record
      await this.prisma.workImport.update({
        where: { id: importRecord.id },
        data: {
          workId: work.id,
          status: 'COMPLETED',
          importedChapters: scraped.episodes.length,
          totalChapters: scraped.episodes.length,
          metadata: {
            title: scraped.title,
            synopsis: scraped.synopsis,
            genre: scraped.genre,
            episodeCount: scraped.episodes.length,
          },
        },
      });

      // Auto-score if requested
      let scoringResult = null;
      if (autoScore) {
        try {
          scoringResult = await this.scoringService.scoreWork(work.id, userId);
        } catch (e) {
          this.logger.warn(`Auto-scoring failed for work ${work.id}: ${e}`);
        }
      }

      // Confirm import credit
      if (importTransactionId) {
        await this.creditService.confirmTransaction(importTransactionId).catch((err) =>
          this.logger.error(`Import credit confirm failed: ${importTransactionId}`, err),
        );
      }

      return {
        importId: importRecord.id,
        workId: work.id,
        title: scraped.title,
        episodes: scraped.episodes.length,
        scoringResult,
      };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      this.logger.error(`importFromUrl failed for ${url}: ${errorMessage}`, e instanceof Error ? e.stack : '');

      // Refund import credit on failure
      if (importTransactionId) {
        await this.creditService.refundTransaction(importTransactionId).catch((err) =>
          this.logger.error(`Import credit refund failed: ${importTransactionId}`, err),
        );
      }

      await this.prisma.workImport.update({
        where: { id: importRecord.id },
        data: {
          status: 'FAILED',
          errorMessage,
        },
      });
      throw new Error(`インポートに失敗しました: ${errorMessage}`);
    }
  }

  async getImportStatus(importId: string, userId: string) {
    const record = await this.prisma.workImport.findUnique({
      where: { id: importId },
    });
    if (!record || record.userId !== userId) {
      throw new NotFoundException('Import not found');
    }
    return record;
  }

  async getImportHistory(userId: string) {
    return this.prisma.workImport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}

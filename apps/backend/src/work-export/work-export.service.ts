import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Epub = require('epub-gen-memory');

export type ExportFormat = 'txt' | 'epub' | 'html';

interface ExportOptions {
  format: ExportFormat;
  includeDrafts?: boolean;
}

interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

@Injectable()
export class WorkExportService {
  private readonly logger = new Logger(WorkExportService.name);

  constructor(private prisma: PrismaService) {}

  async exportWork(workId: string, userId: string, options: ExportOptions): Promise<ExportResult> {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      include: {
        author: { select: { id: true, name: true, displayName: true } },
        tags: true,
      },
    });
    if (!work) throw new NotFoundException('作品が見つかりません');
    if (work.authorId !== userId) throw new ForbiddenException('自分の作品のみエクスポートできます');

    const whereEpisode: Record<string, unknown> = { workId };
    if (!options.includeDrafts) {
      whereEpisode.publishedAt = { not: null };
    }

    const episodes = await this.prisma.episode.findMany({
      where: whereEpisode,
      orderBy: { orderIndex: 'asc' },
      select: {
        title: true,
        content: true,
        chapterTitle: true,
        orderIndex: true,
        wordCount: true,
      },
    });

    const authorName = work.author.displayName || work.author.name;
    const safeTitle = work.title.replace(/[\\/:*?"<>|]/g, '_');

    switch (options.format) {
      case 'txt':
        return this.generateText(work, episodes, authorName, safeTitle);
      case 'epub':
        return this.generateEpub(work, episodes, authorName, safeTitle);
      case 'html':
        return this.generateHtml(work, episodes, authorName, safeTitle);
      default:
        throw new Error(`未対応のフォーマット: ${options.format}`);
    }
  }

  private generateText(
    work: any,
    episodes: any[],
    authorName: string,
    safeTitle: string,
  ): ExportResult {
    const lines: string[] = [];

    // Title page
    lines.push(work.title);
    lines.push(`著者: ${authorName}`);
    lines.push('');
    if (work.synopsis) {
      lines.push('【あらすじ】');
      lines.push(work.synopsis);
      lines.push('');
    }
    lines.push('═'.repeat(40));
    lines.push('');

    // Prologue
    if (work.prologue) {
      lines.push('【プロローグ】');
      lines.push('');
      lines.push(work.prologue);
      lines.push('');
      lines.push('─'.repeat(40));
      lines.push('');
    }

    // Episodes
    for (const ep of episodes) {
      if (ep.chapterTitle) {
        lines.push(`■ ${ep.chapterTitle}`);
        lines.push('');
      }
      lines.push(`第${ep.orderIndex + 1}話　${ep.title}`);
      lines.push('');
      lines.push(ep.content);
      lines.push('');
      lines.push('─'.repeat(40));
      lines.push('');
    }

    // Footer
    lines.push('');
    lines.push(`『${work.title}』`);
    lines.push(`著: ${authorName}`);
    lines.push(`エクスポート日: ${new Date().toISOString().split('T')[0]}`);
    lines.push('Powered by Workwrite');

    const text = lines.join('\n');
    const buffer = Buffer.from(text, 'utf-8');

    return {
      buffer,
      filename: `${safeTitle}.txt`,
      contentType: 'text/plain; charset=utf-8',
    };
  }

  private async generateEpub(
    work: any,
    episodes: any[],
    authorName: string,
    safeTitle: string,
  ): Promise<ExportResult> {
    const chapters: { title: string; content: string }[] = [];

    // Synopsis as first chapter if exists
    if (work.synopsis) {
      chapters.push({
        title: 'あらすじ',
        content: `<p>${this.escapeHtml(work.synopsis).replace(/\n/g, '</p><p>')}</p>`,
      });
    }

    // Prologue
    if (work.prologue) {
      chapters.push({
        title: 'プロローグ',
        content: `<p>${this.escapeHtml(work.prologue).replace(/\n/g, '</p><p>')}</p>`,
      });
    }

    // Episodes grouped by chapter
    let currentChapter: string | null = null;
    for (const ep of episodes) {
      if (ep.chapterTitle && ep.chapterTitle !== currentChapter) {
        currentChapter = ep.chapterTitle;
      }
      const title = ep.chapterTitle && ep.chapterTitle !== currentChapter
        ? `${ep.chapterTitle} - 第${ep.orderIndex + 1}話　${ep.title}`
        : `第${ep.orderIndex + 1}話　${ep.title}`;

      chapters.push({
        title,
        content: `<p>${this.escapeHtml(ep.content).replace(/\n/g, '</p><p>')}</p>`,
      });
    }

    const epubBuffer = await new Epub(
      {
        title: work.title,
        author: authorName,
        lang: 'ja',
        description: work.synopsis || '',
        publisher: 'Workwrite',
        date: new Date().toISOString().split('T')[0],
      },
      chapters,
    ).genEpub();

    return {
      buffer: Buffer.from(epubBuffer),
      filename: `${safeTitle}.epub`,
      contentType: 'application/epub+zip',
    };
  }

  private generateHtml(
    work: any,
    episodes: any[],
    authorName: string,
    safeTitle: string,
  ): ExportResult {
    const parts: string[] = [];

    parts.push(`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${this.escapeHtml(work.title)}</title>
<style>
  body { font-family: "游明朝", "YuMincho", "Hiragino Mincho Pro", serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.8; color: #333; }
  h1 { text-align: center; margin-bottom: 0.5rem; }
  .author { text-align: center; color: #666; margin-bottom: 2rem; }
  .synopsis { background: #f9f9f9; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; }
  .synopsis h2 { font-size: 1rem; color: #666; margin-top: 0; }
  .chapter-title { text-align: center; font-size: 1.2rem; color: #666; margin: 3rem 0 1rem; border-bottom: 1px solid #ddd; padding-bottom: 0.5rem; }
  .episode-title { margin-top: 2rem; font-size: 1.1rem; }
  .episode-content { text-indent: 1em; }
  .episode-content p { margin: 0.5em 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 3rem 0; }
  .footer { text-align: center; color: #999; font-size: 0.85rem; margin-top: 3rem; }
</style>
</head>
<body>`);

    // Title
    parts.push(`<h1>${this.escapeHtml(work.title)}</h1>`);
    parts.push(`<p class="author">${this.escapeHtml(authorName)}</p>`);

    // Synopsis
    if (work.synopsis) {
      parts.push(`<div class="synopsis"><h2>あらすじ</h2><p>${this.escapeHtml(work.synopsis).replace(/\n/g, '</p><p>')}</p></div>`);
    }

    // Prologue
    if (work.prologue) {
      parts.push(`<h2>プロローグ</h2>`);
      parts.push(`<div class="episode-content"><p>${this.escapeHtml(work.prologue).replace(/\n/g, '</p><p>')}</p></div>`);
      parts.push('<hr>');
    }

    // Episodes
    let lastChapter = '';
    for (const ep of episodes) {
      if (ep.chapterTitle && ep.chapterTitle !== lastChapter) {
        lastChapter = ep.chapterTitle;
        parts.push(`<div class="chapter-title">${this.escapeHtml(ep.chapterTitle)}</div>`);
      }
      parts.push(`<h3 class="episode-title">第${ep.orderIndex + 1}話　${this.escapeHtml(ep.title)}</h3>`);
      parts.push(`<div class="episode-content"><p>${this.escapeHtml(ep.content).replace(/\n/g, '</p><p>')}</p></div>`);
      parts.push('<hr>');
    }

    // Footer
    parts.push(`<div class="footer">
  <p>『${this.escapeHtml(work.title)}』</p>
  <p>著: ${this.escapeHtml(authorName)}</p>
  <p>エクスポート日: ${new Date().toISOString().split('T')[0]}</p>
  <p>Powered by Workwrite</p>
</div>`);

    parts.push('</body></html>');

    const html = parts.join('\n');
    const buffer = Buffer.from(html, 'utf-8');

    return {
      buffer,
      filename: `${safeTitle}.html`,
      contentType: 'text/html; charset=utf-8',
    };
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

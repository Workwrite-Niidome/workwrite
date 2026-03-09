import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AnalyzeTextDto, ImportTextDto } from './dto/work-import.dto';

export interface DetectedChapter {
  title: string;
  content: string;
  startLine: number;
}

@Injectable()
export class WorkImportService {
  constructor(private prisma: PrismaService) {}

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
        // Save previous chapter
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
        // Check if it's a separator (--- or ***)
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

    // Save last chapter
    const lastContent = currentContent.join('\n').trim();
    if (lastContent) {
      chapters.push({
        title: currentTitle || `チャプター ${chapters.length + 1}`,
        content: lastContent,
        startLine: currentStartLine,
      });
    }

    // If no chapters detected, treat entire text as single chapter
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

  async getImportHistory(userId: string) {
    return this.prisma.workImport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}

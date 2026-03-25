import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { CreditService } from '../billing/credit.service';
import {
  AnalyzeTextDto,
  ImportTextDto,
  ImportFileDto,
  ImportMultipleFilesDto,
} from './dto/work-import.dto';
import { decodeBuffer } from './utils/detect-encoding';

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
  ) {}

  /**
   * テキストから章構造を検出する共通ロジック
   */
  private detectChapters(text: string): DetectedChapter[] {
    const lines = text.split('\n');
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

    if (chapters.length === 0 && text.trim()) {
      chapters.push({
        title: 'チャプター 1',
        content: text.trim(),
        startLine: 0,
      });
    }

    return chapters;
  }

  analyzeText(dto: AnalyzeTextDto): { chapters: DetectedChapter[] } {
    return { chapters: this.detectChapters(dto.text) };
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

  // -------------------------------------------------------
  // ファイルインポート
  // -------------------------------------------------------

  /**
   * ファイル解析（プレビュー用）
   */
  analyzeFile(buffer: Buffer) {
    const { text, detectedEncoding } = decodeBuffer(buffer);
    const chapters = this.detectChapters(text);
    return { chapters, detectedEncoding, totalCharacters: text.length };
  }

  /**
   * 既存作品の所有者確認 & 最大orderIndex取得
   */
  private async verifyWorkOwnership(
    workId: string,
    userId: string,
  ): Promise<{ maxOrderIndex: number }> {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) {
      throw new NotFoundException('作品が見つかりません');
    }
    if (work.authorId !== userId) {
      throw new ForbiddenException('この作品にエピソードを追加する権限がありません');
    }
    const lastEpisode = await this.prisma.episode.findFirst({
      where: { workId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    return { maxOrderIndex: lastEpisode ? lastEpisode.orderIndex : -1 };
  }

  /**
   * エピソードを一括作成する共通処理
   */
  private async createEpisodes(
    workId: string,
    userId: string,
    chapters: { title: string; content: string }[],
    startOrderIndex: number,
  ) {
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      await this.prisma.episode.create({
        data: {
          workId,
          authorId: userId,
          title: ch.title,
          content: ch.content,
          orderIndex: startOrderIndex + i,
          wordCount: ch.content.length,
          publishedAt: new Date(),
        },
      });
    }
  }

  /**
   * 1ファイルインポート（章自動検出 → 複数エピソード）
   */
  async importFile(
    userId: string,
    buffer: Buffer,
    originalFilename: string,
    dto: ImportFileDto,
  ) {
    const { text, detectedEncoding } = decodeBuffer(buffer);
    const chapters = this.detectChapters(text);

    if (chapters.length === 0) {
      throw new BadRequestException('ファイルにテキストが含まれていません');
    }

    const importRecord = await this.prisma.workImport.create({
      data: {
        userId,
        source: 'file_upload',
        status: 'PROCESSING',
        totalChapters: chapters.length,
        metadata: {
          filename: originalFilename,
          encoding: detectedEncoding,
          fileSize: buffer.length,
        },
      },
    });

    try {
      let workId: string;
      let startOrderIndex = 0;

      if (dto.workId) {
        // 既存作品にエピソードを追加
        const { maxOrderIndex } = await this.verifyWorkOwnership(
          dto.workId,
          userId,
        );
        workId = dto.workId;
        startOrderIndex = maxOrderIndex + 1;
      } else {
        // 新規作品として作成
        const title =
          dto.title || originalFilename.replace(/\.txt$/i, '') || '無題';
        const work = await this.prisma.work.create({
          data: {
            authorId: userId,
            title,
            synopsis: dto.synopsis || null,
            genre: dto.genre || null,
            status: 'DRAFT',
          },
        });
        workId = work.id;
      }

      await this.createEpisodes(workId, userId, chapters, startOrderIndex);

      await this.prisma.workImport.update({
        where: { id: importRecord.id },
        data: {
          workId,
          status: 'COMPLETED',
          importedChapters: chapters.length,
        },
      });

      return {
        workId,
        importId: importRecord.id,
        chapters: chapters.length,
        detectedEncoding,
      };
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

  /**
   * 複数ファイルインポート（各ファイル = 1エピソード）
   */
  async importMultipleFiles(
    userId: string,
    files: Express.Multer.File[],
    dto: ImportMultipleFilesDto,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('ファイルが必要です');
    }

    // 各ファイルをデコードしてエピソード情報を準備
    const episodes: { title: string; content: string; filename: string }[] = [];
    for (const file of files) {
      const { text } = decodeBuffer(file.buffer);
      const content = text.trim();
      if (!content) continue;
      const title = (file.originalname || 'untitled')
        .replace(/\.txt$/i, '');
      episodes.push({ title, content, filename: file.originalname });
    }

    if (episodes.length === 0) {
      throw new BadRequestException(
        'インポート可能なテキストが含まれていません',
      );
    }

    const importRecord = await this.prisma.workImport.create({
      data: {
        userId,
        source: 'file_upload',
        status: 'PROCESSING',
        totalChapters: episodes.length,
        metadata: {
          fileCount: files.length,
          filenames: files.map((f) => f.originalname),
        },
      },
    });

    try {
      let workId: string;
      let startOrderIndex = 0;

      if (dto.workId) {
        const { maxOrderIndex } = await this.verifyWorkOwnership(
          dto.workId,
          userId,
        );
        workId = dto.workId;
        startOrderIndex = maxOrderIndex + 1;
      } else {
        const title = dto.title || '無題';
        const work = await this.prisma.work.create({
          data: {
            authorId: userId,
            title,
            synopsis: dto.synopsis || null,
            genre: dto.genre || null,
            status: 'DRAFT',
          },
        });
        workId = work.id;
      }

      // トランザクション内で全エピソード作成
      await this.prisma.$transaction(async (tx) => {
        for (let i = 0; i < episodes.length; i++) {
          const ep = episodes[i];
          await tx.episode.create({
            data: {
              workId,
              authorId: userId,
              title: ep.title,
              content: ep.content,
              orderIndex: startOrderIndex + i,
              wordCount: ep.content.length,
              publishedAt: new Date(),
            },
          });
        }
      });

      await this.prisma.workImport.update({
        where: { id: importRecord.id },
        data: {
          workId,
          status: 'COMPLETED',
          importedChapters: episodes.length,
        },
      });

      return {
        workId,
        importId: importRecord.id,
        episodes: episodes.length,
      };
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
}

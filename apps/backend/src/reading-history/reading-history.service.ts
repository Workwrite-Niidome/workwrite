import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ImportHistoryDto } from './dto/import-history.dto';

@Injectable()
export class ReadingHistoryService {
  constructor(private prisma: PrismaService) {}

  async importHistory(userId: string, dto: ImportHistoryDto) {
    const records = await this.prisma.readingHistoryImport.createMany({
      data: dto.items.map((item) => ({
        userId,
        title: item.title,
        author: item.author,
        source: 'manual',
      })),
    });
    return { imported: records.count };
  }

  async getHistory(userId: string) {
    return this.prisma.readingHistoryImport.findMany({
      where: { userId },
      orderBy: { importedAt: 'desc' },
    });
  }

  async importCsv(userId: string, csvContent: string) {
    const lines = csvContent.split('\n').filter((l) => l.trim());
    // Skip header if present
    const start = lines[0]?.toLowerCase().includes('title') ? 1 : 0;

    const items = lines.slice(start).map((line) => {
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      return { title: parts[0], author: parts[1] || null };
    }).filter((item) => item.title);

    const records = await this.prisma.readingHistoryImport.createMany({
      data: items.map((item) => ({
        userId,
        title: item.title,
        author: item.author,
        source: 'csv',
      })),
    });
    return { imported: records.count };
  }
}

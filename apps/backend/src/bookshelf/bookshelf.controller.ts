import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookshelfStatus } from '@prisma/client';
import { BookshelfService } from './bookshelf.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Bookshelf')
@Controller('reading/bookshelf')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookshelfController {
  constructor(
    private bookshelfService: BookshelfService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get my bookshelf' })
  getBookshelf(
    @CurrentUser('id') userId: string,
    @Query('status') status?: BookshelfStatus,
  ) {
    return this.bookshelfService.getBookshelf(userId, status);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get reading history (works read but not in bookshelf)' })
  async getHistory(@CurrentUser('id') userId: string) {
    // Get works the user has reading progress for, but NOT in their bookshelf
    const bookshelfWorkIds = await this.prisma.bookshelfEntry.findMany({
      where: { userId },
      select: { workId: true },
    });
    const bookshelfSet = new Set(bookshelfWorkIds.map(e => e.workId));

    const readingProgress = await this.prisma.readingProgress.findMany({
      where: { userId },
      select: { workId: true, updatedAt: true },
      distinct: ['workId'],
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    const historyWorkIds = readingProgress
      .filter(rp => !bookshelfSet.has(rp.workId))
      .map(rp => rp.workId);

    if (historyWorkIds.length === 0) return { data: [] };

    const works = await this.prisma.work.findMany({
      where: { id: { in: historyWorkIds } },
      include: {
        author: { select: { id: true, name: true, displayName: true, avatarUrl: true } },
        qualityScore: { select: { overall: true } },
        _count: { select: { episodes: true } },
      },
    });

    // Sort by reading progress updatedAt order
    const workMap = new Map(works.map(w => [w.id, w]));
    const sorted = historyWorkIds.map(id => workMap.get(id)).filter(Boolean);

    return { data: sorted };
  }

  @Post()
  @ApiOperation({ summary: 'Add work to bookshelf' })
  add(@CurrentUser('id') userId: string, @Body('workId') workId: string) {
    return this.bookshelfService.addToBookshelf(userId, workId);
  }

  @Patch(':workId')
  @ApiOperation({ summary: 'Update bookshelf status' })
  update(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body('status') status: BookshelfStatus,
  ) {
    return this.bookshelfService.updateStatus(userId, workId, status);
  }

  @Delete(':workId')
  @ApiOperation({ summary: 'Remove from bookshelf' })
  remove(@CurrentUser('id') userId: string, @Param('workId') workId: string) {
    return this.bookshelfService.removeFromBookshelf(userId, workId);
  }
}

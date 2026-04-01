import { Controller, Post, Get, Param, Body, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorldCanonService } from './services/world-canon.service';
import { FragmentGeneratorService } from './services/fragment-generator.service';
import { CreateWishDto } from './dto/create-wish.dto';
import { BuildCanonDto } from './dto/build-canon.dto';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('World Fragments')
@Controller('world-fragments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorldFragmentsController {
  constructor(
    private canonService: WorldCanonService,
    private fragmentGenerator: FragmentGeneratorService,
    private prisma: PrismaService,
  ) {}

  // ===== Canon構築済み作品一覧 =====

  /** WorldCanonが構築されている作品の一覧 */
  @Get('works')
  async listCanonWorks() {
    const canons = await this.prisma.worldCanon.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    if (canons.length === 0) return { works: [] };

    const workIds = canons.map((c) => c.workId);
    const works = await this.prisma.work.findMany({
      where: { id: { in: workIds } },
      select: {
        id: true,
        title: true,
        synopsis: true,
        coverUrl: true,
        genre: true,
        completionStatus: true,
        author: { select: { id: true, name: true, displayName: true } },
      },
    });

    const fragmentCounts = await this.prisma.worldFragment.groupBy({
      by: ['workId'],
      where: { workId: { in: workIds }, status: 'PUBLISHED' },
      _count: true,
    });

    const countMap = new Map(fragmentCounts.map((fc) => [fc.workId, fc._count]));
    const canonMap = new Map(canons.map((c) => [c.workId, c]));

    return {
      works: works.map((w) => ({
        ...w,
        canon: {
          canonVersion: canonMap.get(w.id)?.canonVersion,
          upToEpisode: canonMap.get(w.id)?.upToEpisode,
          updatedAt: canonMap.get(w.id)?.updatedAt,
        },
        fragmentCount: countMap.get(w.id) ?? 0,
      })),
    };
  }

  // ===== WorldCanon =====

  /** WorldCanonを構築・更新する（作者 or Admin用） */
  @Post(':workId/canon/build')
  async buildCanon(
    @Param('workId') workId: string,
    @Body() body: BuildCanonDto,
  ) {
    const canon = await this.canonService.buildCanon(workId, body.upToEpisode);
    return canon;
  }

  /** WorldCanonを取得 */
  @Get(':workId/canon')
  async getCanon(@Param('workId') workId: string) {
    return this.canonService.getCanon(workId);
  }

  // ===== Fragments =====

  /** wishからFragmentを生成 */
  @Post(':workId/wish')
  async createWish(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() body: CreateWishDto,
  ) {
    return this.fragmentGenerator.generateFragment(
      userId,
      workId,
      body.wish,
      body.wishType,
      body.upToEpisode,
      {
        anchorEpisodeId: body.anchorEpisodeId,
        anchorEventId: body.anchorEventId,
        timelinePosition: body.timelinePosition,
      },
    );
  }

  /** 作品のFragment一覧を取得 */
  @Get(':workId/fragments')
  async listFragments(
    @Param('workId') workId: string,
    @Query('wishType') wishType?: string,
    @Query('sort') sort?: 'latest' | 'popular',
    @Query('page') page?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const take = 20;
    const skip = (pageNum - 1) * take;

    const orderBy = sort === 'popular'
      ? { applauseCount: 'desc' as const }
      : { createdAt: 'desc' as const };

    const where: any = {
      workId,
      status: 'PUBLISHED',
    };
    if (wishType) {
      where.wishType = wishType;
    }

    const [fragments, total] = await Promise.all([
      this.prisma.worldFragment.findMany({
        where,
        orderBy,
        take,
        skip,
        select: {
          id: true,
          wish: true,
          wishType: true,
          scope: true,
          content: true,
          contentMeta: true,
          qualityScore: true,
          viewCount: true,
          applauseCount: true,
          bookmarkCount: true,
          createdAt: true,
          publishedAt: true,
        },
      }),
      this.prisma.worldFragment.count({ where }),
    ]);

    return {
      fragments,
      pagination: {
        page: pageNum,
        totalPages: Math.ceil(total / take),
        total,
      },
    };
  }

  /** Fragment詳細を取得 */
  @Get('fragment/:fragmentId')
  async getFragment(
    @CurrentUser('id') userId: string,
    @Param('fragmentId') fragmentId: string,
  ) {
    const fragment = await this.prisma.worldFragment.findUnique({
      where: { id: fragmentId },
    });
    if (!fragment) throw new Error('Fragment not found');

    // viewCount インクリメント（非同期、エラー無視）
    this.prisma.worldFragment
      .update({ where: { id: fragmentId }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    // ユーザーの拍手・ブックマーク状態
    const [applause, bookmark] = await Promise.all([
      this.prisma.worldFragmentApplause.findUnique({
        where: { userId_fragmentId: { userId, fragmentId } },
      }),
      this.prisma.worldFragmentBookmark.findUnique({
        where: { userId_fragmentId: { userId, fragmentId } },
      }),
    ]);

    return {
      ...fragment,
      hasApplauded: !!applause,
      hasBookmarked: !!bookmark,
    };
  }

  /** Fragmentに拍手 */
  @Post('fragment/:fragmentId/applause')
  async toggleApplause(
    @CurrentUser('id') userId: string,
    @Param('fragmentId') fragmentId: string,
  ) {
    const existing = await this.prisma.worldFragmentApplause.findUnique({
      where: { userId_fragmentId: { userId, fragmentId } },
    });

    if (existing) {
      await this.prisma.worldFragmentApplause.delete({ where: { id: existing.id } });
      await this.prisma.worldFragment.update({
        where: { id: fragmentId },
        data: { applauseCount: { decrement: 1 } },
      });
      return { applauded: false };
    }

    await this.prisma.worldFragmentApplause.create({
      data: { userId, fragmentId },
    });
    await this.prisma.worldFragment.update({
      where: { id: fragmentId },
      data: { applauseCount: { increment: 1 } },
    });
    return { applauded: true };
  }

  /** Fragmentをブックマーク */
  @Post('fragment/:fragmentId/bookmark')
  async toggleBookmark(
    @CurrentUser('id') userId: string,
    @Param('fragmentId') fragmentId: string,
  ) {
    const existing = await this.prisma.worldFragmentBookmark.findUnique({
      where: { userId_fragmentId: { userId, fragmentId } },
    });

    if (existing) {
      await this.prisma.worldFragmentBookmark.delete({ where: { id: existing.id } });
      await this.prisma.worldFragment.update({
        where: { id: fragmentId },
        data: { bookmarkCount: { decrement: 1 } },
      });
      return { bookmarked: false };
    }

    await this.prisma.worldFragmentBookmark.create({
      data: { userId, fragmentId },
    });
    await this.prisma.worldFragment.update({
      where: { id: fragmentId },
      data: { bookmarkCount: { increment: 1 } },
    });
    return { bookmarked: true };
  }

  /** 自分が生成したFragmentの一覧 */
  @Get('my-fragments')
  async myFragments(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const take = 20;
    const skip = (pageNum - 1) * take;

    const [fragments, total] = await Promise.all([
      this.prisma.worldFragment.findMany({
        where: { requesterId: userId },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.worldFragment.count({ where: { requesterId: userId } }),
    ]);

    return {
      fragments,
      pagination: {
        page: pageNum,
        totalPages: Math.ceil(total / take),
        total,
      },
    };
  }
}

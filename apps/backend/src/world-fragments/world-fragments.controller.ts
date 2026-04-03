import { Controller, Post, Get, Patch, Param, Body, Query, UseGuards, Delete, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
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
      where: { id: { in: workIds }, enableWorldFragments: true },
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

  // ===== 作品のWorld Fragments有効化 =====

  /** 作品のenableWorldFragmentsフラグを切り替える（Admin用） */
  @Post(':workId/enable')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async enableWorldFragments(
    @Param('workId') workId: string,
    @Body() body: { enabled: boolean },
  ) {
    await this.prisma.work.update({
      where: { id: workId },
      data: { enableWorldFragments: body.enabled ?? true },
    });
    return { enabled: body.enabled ?? true };
  }

  // ===== WorldCanon =====

  /** WorldCanonを構築・更新する（Admin用） */
  @Post(':workId/canon/build')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async buildCanon(
    @Param('workId') workId: string,
    @Body() body: BuildCanonDto,
  ) {
    const canon = await this.canonService.buildCanon(workId, body.upToEpisode, body.steps);
    return canon;
  }

  /** エピソード本文からキャラクタープロファイルを深化させる（Admin用） */
  @Post(':workId/canon/enrich')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async enrichCanon(@Param('workId') workId: string) {
    return this.canonService.enrichCharacterProfiles(workId);
  }

  /** 手作りCanonを直接投入（Admin用） */
  @Post(':workId/canon/import')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async importCanon(
    @Param('workId') workId: string,
    @Body() body: any,
  ) {
    const existing = await this.prisma.worldCanon.findUnique({ where: { workId } });

    if (existing) {
      return this.prisma.worldCanon.update({
        where: { workId },
        data: {
          canonVersion: existing.canonVersion + 1,
          upToEpisode: body.upToEpisode ?? existing.upToEpisode,
          characterProfiles: body.characterProfiles,
          worldRules: body.worldRules,
          timeline: body.timeline,
          relationships: body.relationships,
          establishedFacts: body.establishedFacts,
          ambiguities: body.ambiguities,
          narrativeStyle: body.narrativeStyle ?? null,
          ...(body.worldLayers !== undefined ? { worldLayers: body.worldLayers } : {}),
          ...(body.layerInteractions !== undefined ? { layerInteractions: body.layerInteractions } : {}),
          ...(body.layerAmbiguities !== undefined ? { layerAmbiguities: body.layerAmbiguities } : {}),
          ...(body.wishSeeds !== undefined ? { wishSeeds: body.wishSeeds } : {}),
        },
      });
    }

    return this.prisma.worldCanon.create({
      data: {
        workId,
        upToEpisode: body.upToEpisode ?? 1,
        characterProfiles: body.characterProfiles,
        worldRules: body.worldRules,
        timeline: body.timeline,
        relationships: body.relationships,
        establishedFacts: body.establishedFacts,
        ambiguities: body.ambiguities,
        narrativeStyle: body.narrativeStyle ?? null,
        ...(body.worldLayers !== undefined ? { worldLayers: body.worldLayers } : {}),
        ...(body.layerInteractions !== undefined ? { layerInteractions: body.layerInteractions } : {}),
        ...(body.layerAmbiguities !== undefined ? { layerAmbiguities: body.layerAmbiguities } : {}),
        ...(body.wishSeeds !== undefined ? { wishSeeds: body.wishSeeds } : {}),
      },
    });
  }

  /** WorldCanonを部分更新（作者またはAdmin） */
  @Patch(':workId/canon')
  async patchCanon(
    @CurrentUser() user: { id: string; role: string },
    @Param('workId') workId: string,
    @Body() body: any,
  ) {
    // Auth check: must be work author or ADMIN
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { authorId: true },
    });
    if (!work) throw new NotFoundException('Work not found');
    if (work.authorId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException('Only the author or an admin can edit the canon');
    }

    const existing = await this.prisma.worldCanon.findUnique({ where: { workId } });
    if (!existing) throw new NotFoundException('Canon not found for this work');

    const updatableFields = [
      'characterProfiles',
      'worldRules',
      'establishedFacts',
      'ambiguities',
      'worldLayers',
      'layerInteractions',
      'layerAmbiguities',
      'narrativeStyle',
    ] as const;

    const data: Record<string, any> = {};
    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return existing;
    }

    data.canonVersion = existing.canonVersion + 1;

    return this.prisma.worldCanon.update({
      where: { workId },
      data,
    });
  }

  /** WorldCanonを取得 */
  @Get(':workId/canon')
  async getCanon(@Param('workId') workId: string) {
    return this.canonService.getCanon(workId);
  }

  // ===== Wish Seeds =====

  /** 願いの種をランダムに取得 */
  @Get(':workId/wish-seeds')
  async getWishSeeds(
    @Param('workId') workId: string,
    @Query('count') count?: string,
  ) {
    const n = parseInt(count || '5', 10);
    return { seeds: await this.canonService.getWishSeeds(workId, n) };
  }

  /** 願いの種プールを生成（Admin用） */
  @Post(':workId/wish-seeds/generate')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async generateWishSeeds(@Param('workId') workId: string) {
    const seeds = await this.canonService.generateWishSeeds(workId);
    return { seeds, count: seeds.length };
  }

  // ===== Fragments =====

  /** wishからFragmentを生成 */
  @Post(':workId/wish')
  async createWish(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() body: CreateWishDto,
  ) {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { enableWorldFragments: true },
    });
    if (!work) throw new NotFoundException('Work not found');
    if (!work.enableWorldFragments) {
      throw new BadRequestException('World Fragments is not enabled for this work');
    }

    return this.fragmentGenerator.initiateFragment(
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
          requesterId: true,
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

  /** Fragmentステータスをポーリング用に取得（軽量） */
  @Get('fragment/:fragmentId/status')
  async getFragmentStatus(
    @Param('fragmentId') fragmentId: string,
  ) {
    const fragment = await this.prisma.worldFragment.findUnique({
      where: { id: fragmentId },
      select: {
        id: true,
        status: true,
        rejectionReason: true,
        publishedAt: true,
      },
    });
    if (!fragment) throw new Error('Fragment not found');
    return fragment;
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

  /** 自分が生成したFragmentを削除 */
  @Delete('fragment/:fragmentId')
  async deleteFragment(
    @CurrentUser('id') userId: string,
    @Param('fragmentId') fragmentId: string,
  ) {
    const fragment = await this.prisma.worldFragment.findUnique({
      where: { id: fragmentId },
    });
    if (!fragment) throw new Error('Fragment not found');
    if (fragment.requesterId !== userId) throw new Error('Not your fragment');

    await this.prisma.worldFragment.delete({ where: { id: fragmentId } });
    return { deleted: true };
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

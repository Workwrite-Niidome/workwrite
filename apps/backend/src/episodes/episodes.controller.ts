import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EpisodesService } from './episodes.service';
import { CreateEpisodeDto, UpdateEpisodeDto } from './dto/episode.dto';
import { ReorderEpisodesDto } from './dto/reorder-episodes.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreationWizardService } from '../creation-wizard/creation-wizard.service';
import { EpisodeAnalysisService } from '../ai-assist/episode-analysis.service';
import { PostsService } from '../posts/posts.service';
import { WorksService } from '../works/works.service';
import { CharacterExtractionService } from '../character-talk/character-extraction.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { OriginalityService } from '../originality/originality.service';
import { PostType, Episode } from '@prisma/client';

interface EpisodeWithWork extends Episode {
  work?: { id: string; title: string; authorId?: string };
}

@ApiTags('Episodes')
@Controller()
export class EpisodesController {
  private readonly logger = new Logger(EpisodesController.name);

  constructor(
    private episodesService: EpisodesService,
    private creationWizardService: CreationWizardService,
    private episodeAnalysis: EpisodeAnalysisService,
    private postsService: PostsService,
    private worksService: WorksService,
    private characterExtraction: CharacterExtractionService,
    private prisma: PrismaService,
    private originalityService: OriginalityService,
  ) {}

  @Get('works/:workId/episodes')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List episodes of a work' })
  @ApiQuery({ name: 'published', required: false, type: Boolean })
  async findByWork(
    @Param('workId') workId: string,
    @CurrentUser('id') userId?: string,
    @Query('published') published?: string,
  ) {
    // Non-authors can only see published episodes
    const work = await this.prisma.work.findUnique({ where: { id: workId }, select: { authorId: true } });
    const isAuthor = work && userId && work.authorId === userId;
    const publishedOnly = isAuthor ? (published === 'true') : true;
    return this.episodesService.findByWork(workId, publishedOnly);
  }

  @Get('episodes/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get episode content' })
  async findOne(@Param('id') id: string, @CurrentUser('id') userId?: string) {
    const episode = await this.episodesService.findOne(id, userId);
    // Trigger character extraction in the background if not yet done
    this.characterExtraction.triggerIfNeeded(id);
    return episode;
  }

  @Post('works/:workId/episodes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create episode' })
  async create(
    @Param('workId') workId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateEpisodeDto,
    @Query('skipAnalysis') skipAnalysis?: string,
  ) {
    const result = await this.episodesService.create(workId, userId, dto);
    // Originality check only on save (lightweight, no API call)
    if (dto.content && dto.content.length > 100 && skipAnalysis !== 'true') {
      this.triggerOriginalityCheck(workId);
    }
    // Episode analysis and summary update are deferred to publish time
    return result;
  }

  @Patch('episodes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update episode' })
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateEpisodeDto,
    @Query('skipAnalysis') skipAnalysis?: string,
  ) {
    // Capture old content before update for change detection
    let oldContent: string | null = null;
    if (dto.content && dto.content.length > 100 && skipAnalysis !== 'true') {
      const oldEpisode = await this.episodesService.findOne(id, userId);
      oldContent = oldEpisode.content;
    }
    const result = await this.episodesService.update(id, userId, dto);
    if (dto.content && dto.content.length > 100 && skipAnalysis !== 'true') {
      const episode = await this.episodesService.findOne(id, userId);
      this.triggerOriginalityCheck(episode.workId);
      // For published episodes: re-analyze if content changed meaningfully
      if (episode.publishedAt) {
        this.triggerAnalysisIfSignificantChange(episode, oldContent, dto.content, userId);
      }
    }
    return result;
  }

  @Delete('episodes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete episode' })
  async delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const episode = await this.episodesService.findOne(id, userId);
    const workId = episode.workId;
    const result = await this.episodesService.delete(id, userId);
    this.triggerOriginalityCheck(workId);
    return result;
  }

  @Patch('works/:workId/episodes/reorder')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder episodes' })
  reorder(
    @Param('workId') workId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReorderEpisodesDto,
  ) {
    return this.episodesService.reorder(workId, userId, dto);
  }

  @Post('episodes/:id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish episode' })
  async publish(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const result = await this.episodesService.publish(id, userId);
    const episode = await this.episodesService.findOne(id, userId);
    // Run analysis on publish (the right time for API calls)
    this.triggerEpisodeAnalysis(episode.workId, id);
    // storySummary auto-fire disabled — not consumed by any feature, major API cost savings
    // Auto-post to SNS
    this.createAutoEpisodePost(userId, episode).catch((e) =>
      this.logger.warn(`Auto-post failed: ${e}`),
    );
    // Auto-score and index to search
    this.worksService.autoProcessWork(episode.workId).catch((e) =>
      this.logger.warn(`Auto-process on episode publish failed: ${e}`),
    );
    // Notify bookshelf users about new episode
    this.notifyBookshelfUsers(episode.workId, episode).catch(() => {});
    // Auto-update WorldCanon upToEpisode if World Fragments is enabled
    this.autoUpdateCanonEpisodeCount(episode.workId).catch((e) =>
      this.logger.warn(`Canon auto-update failed for work ${episode.workId}: ${e}`),
    );
    return result;
  }

  @Post('episodes/:id/unpublish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unpublish episode' })
  async unpublish(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const result = await this.episodesService.unpublish(id, userId);
    const episode = await this.episodesService.findOne(id, userId);
    this.triggerOriginalityCheck(episode.workId);
    return result;
  }

  @Post('episodes/:id/schedule')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Schedule episode publish' })
  schedule(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { scheduledAt: string },
  ) {
    return this.episodesService.schedule(id, userId, body.scheduledAt);
  }

  // Snapshot endpoints
  @Post('episodes/:id/snapshots')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create episode snapshot' })
  createSnapshot(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { label?: string },
  ) {
    return this.episodesService.createSnapshot(id, userId, body.label);
  }

  @Get('episodes/:id/snapshots')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List episode snapshots' })
  getSnapshots(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.episodesService.getSnapshots(id, userId);
  }

  @Get('episodes/snapshots/:snapshotId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get snapshot content' })
  getSnapshotContent(@Param('snapshotId') snapshotId: string, @CurrentUser('id') userId: string) {
    return this.episodesService.getSnapshotContent(snapshotId, userId);
  }

  @Post('episodes/snapshots/:snapshotId/restore')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore episode from snapshot' })
  restoreSnapshot(
    @Param('snapshotId') snapshotId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.episodesService.restoreSnapshot(snapshotId, userId);
  }

  /** Fire-and-forget summary update (non-blocking) */
  private triggerSummaryUpdate(workId: string, userId: string) {
    this.creationWizardService.updateStorySummary(workId, userId).catch((e) => {
      this.logger.warn(`Failed to auto-update story summary for work ${workId}: ${e.message}`);
    });
  }

  /** Fire-and-forget episode analysis (non-blocking) */
  private triggerEpisodeAnalysis(workId: string, episodeId: string) {
    this.episodeAnalysis.analyzeEpisode(workId, episodeId).catch((e) => {
      this.logger.warn(`Failed to auto-analyze episode ${episodeId}: ${e.message}`);
    });
  }

  /**
   * For published episodes: re-run analysis only if content changed meaningfully.
   * Compares actual character differences (not just length) to detect rewrites.
   */
  private async triggerAnalysisIfSignificantChange(
    episode: EpisodeWithWork, oldContent: string | null, newContent: string, userId: string,
  ) {
    try {
      const analysis = await this.episodeAnalysis.getAnalysis(episode.id);
      if (!analysis) {
        this.triggerEpisodeAnalysis(episode.workId, episode.id);
        return;
      }

      // Skip if analysis version matches current content version
      if (analysis.version === (episode.contentVersion ?? 0)) return;

      if (!oldContent) {
        this.triggerEpisodeAnalysis(episode.workId, episode.id);
        return;
      }

      // Normalize: strip whitespace/newlines/fullwidth spaces
      const normalize = (s: string) => s.replace(/[\s\n\r\u3000]+/g, '');
      const normNew = normalize(newContent);
      const normOld = normalize(oldContent);

      // Quick check: length difference > 20%
      const maxLen = Math.max(normOld.length, normNew.length);
      if (maxLen === 0) return;
      const lenRatio = Math.abs(normNew.length - normOld.length) / maxLen;
      if (lenRatio > 0.2) {
        this.logger.log(`Published episode ${episode.id} content length changed ${Math.round(lenRatio * 100)}%, re-analyzing`);
        this.triggerEpisodeAnalysis(episode.workId, episode.id);
        return;
      }

      // Character-level sampling: compare at evenly spaced positions
      const minLen = Math.min(normOld.length, normNew.length);
      const sampleSize = Math.min(100, minLen);
      if (sampleSize === 0) return;
      const step = Math.max(1, Math.floor(minLen / sampleSize));
      let diffCount = 0;
      for (let i = 0; i < minLen && diffCount < sampleSize; i += step) {
        if (normOld[i] !== normNew[i]) diffCount++;
      }
      const sampled = Math.min(sampleSize, Math.ceil(minLen / step));
      const diffRatio = sampled > 0 ? diffCount / sampled : 0;

      if (diffRatio >= 0.2) {
        this.logger.log(`Published episode ${episode.id} content changed ~${Math.round(diffRatio * 100)}% (sampled), re-analyzing`);
        this.triggerEpisodeAnalysis(episode.workId, episode.id);
      }
    } catch {
      // On error, skip re-analysis silently
    }
  }

  /** Fire-and-forget originality check (non-blocking) */
  private triggerOriginalityCheck(workId: string) {
    this.originalityService.recalculate(workId).catch((e) => {
      this.logger.warn(`Failed to check originality for work ${workId}: ${e.message}`);
    });
  }

  /** Notify bookshelf users about a newly published episode */
  private async notifyBookshelfUsers(workId: string, episode: any) {
    // Get all users who have this work in their bookshelf (READING or WANT_TO_READ)
    const entries = await this.prisma.bookshelfEntry.findMany({
      where: { workId, status: { in: ['READING', 'WANT_TO_READ'] } },
      select: { userId: true },
    });

    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { title: true, authorId: true },
    });
    if (!work || entries.length === 0) return;

    // Create notifications (skip the author themselves)
    const notifications = entries
      .filter(e => e.userId !== work.authorId)
      .map(e => ({
        userId: e.userId,
        type: 'new_episode',
        title: `『${work.title}』の新しいエピソードが公開されました`,
        body: `第${(episode.orderIndex ?? 0) + 1}話「${episode.title || ''}」`,
        data: { workId, episodeId: episode.id },
      }));

    if (notifications.length > 0) {
      await this.prisma.notification.createMany({ data: notifications });
    }
  }

  /** Create auto-post when episode is published */
  private async createAutoEpisodePost(userId: string, episode: EpisodeWithWork) {
    const work = episode.work;
    const title = work?.title || '';
    const epTitle = episode.title || '';
    const order = episode.orderIndex ?? 0;
    const content = `『${title}』第${order}話「${epTitle}」を公開しました`;
    await this.postsService.createAutoPost(userId, PostType.AUTO_EPISODE, {
      content,
      workId: work?.id || episode.workId,
      episodeId: episode.id,
    });
  }

  /** Auto-update WorldCanon upToEpisode when a new episode is published (fire-and-forget) */
  private async autoUpdateCanonEpisodeCount(workId: string) {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { enableWorldFragments: true },
    });
    if (!work?.enableWorldFragments) return;

    const publishedCount = await this.prisma.episode.count({
      where: { workId, publishedAt: { not: null } },
    });

    // Update the canon's upToEpisode to match the published episode count
    await this.prisma.worldCanon.updateMany({
      where: { workId, upToEpisode: { lt: publishedCount } },
      data: { upToEpisode: publishedCount },
    });

    this.logger.log(`WorldCanon for work ${workId} updated to upToEpisode=${publishedCount}`);
  }
}

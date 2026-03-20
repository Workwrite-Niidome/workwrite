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
import { PostType } from '@prisma/client';

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
  ) {}

  @Get('works/:workId/episodes')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List episodes of a work' })
  @ApiQuery({ name: 'published', required: false, type: Boolean })
  findByWork(
    @Param('workId') workId: string,
    @Query('published') published?: string,
  ) {
    const publishedOnly = published === 'true';
    return this.episodesService.findByWork(workId, publishedOnly);
  }

  @Get('episodes/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get episode content' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId?: string) {
    return this.episodesService.findOne(id, userId);
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
    const result = await this.episodesService.update(id, userId, dto);
    if (dto.content && dto.content.length > 100 && skipAnalysis !== 'true') {
      const episode = await this.episodesService.findOne(id, userId);
      // Originality check on every save (lightweight, no API call)
      this.triggerOriginalityCheck(episode.workId);
      // For published episodes: re-analyze if content changed significantly (20%+)
      if (episode.publishedAt) {
        this.triggerAnalysisIfSignificantChange(episode.workId, episode.id, dto.content, userId);
      }
    }
    return result;
  }

  @Delete('episodes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete episode' })
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.episodesService.delete(id, userId);
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
    // Run analysis and summary on publish (the right time for API calls)
    this.triggerEpisodeAnalysis(episode.workId, id);
    this.triggerSummaryUpdate(episode.workId, userId);
    // Auto-post to SNS
    this.createAutoEpisodePost(userId, episode).catch((e) =>
      this.logger.warn(`Auto-post failed: ${e}`),
    );
    // Auto-score and index to search
    this.worksService.autoProcessWork(episode.workId).catch((e) =>
      this.logger.warn(`Auto-process on episode publish failed: ${e}`),
    );
    return result;
  }

  @Post('episodes/:id/unpublish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unpublish episode' })
  unpublish(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.episodesService.unpublish(id, userId);
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
  @ApiOperation({ summary: 'List episode snapshots' })
  getSnapshots(@Param('id') id: string) {
    return this.episodesService.getSnapshots(id);
  }

  @Get('episodes/snapshots/:snapshotId')
  @ApiOperation({ summary: 'Get snapshot content' })
  getSnapshotContent(@Param('snapshotId') snapshotId: string) {
    return this.episodesService.getSnapshotContent(snapshotId);
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
   * For published episodes: re-run analysis only if content changed by 20%+.
   * Compares new content length against the last analyzed version.
   */
  private async triggerAnalysisIfSignificantChange(
    workId: string, episodeId: string, newContent: string, userId: string,
  ) {
    try {
      const analysis = await this.episodeAnalysis.getAnalysis(episodeId);
      if (!analysis) {
        // No previous analysis — run it
        this.triggerEpisodeAnalysis(workId, episodeId);
        this.triggerSummaryUpdate(workId, userId);
        return;
      }
      // Compare: if content length changed by 20%+ from the summary length, re-analyze
      const prevLength = (analysis.summary?.length || 0) * 5; // rough estimate of original content from summary
      const changeRatio = Math.abs(newContent.length - prevLength) / Math.max(prevLength, 1);
      if (changeRatio > 0.2) {
        this.logger.log(`Published episode ${episodeId} content changed significantly (${Math.round(changeRatio * 100)}%), re-analyzing`);
        this.triggerEpisodeAnalysis(workId, episodeId);
        this.triggerSummaryUpdate(workId, userId);
      }
    } catch {
      // On error, skip re-analysis silently
    }
  }

  /** Fire-and-forget originality check (non-blocking) */
  private triggerOriginalityCheck(workId: string) {
    this.worksService.calculateAndFlagAiGenerated(workId).catch((e) => {
      this.logger.warn(`Failed to check originality for work ${workId}: ${e.message}`);
    });
  }

  /** Create auto-post when episode is published */
  private async createAutoEpisodePost(userId: string, episode: any) {
    const work = episode.work || {};
    const title = work.title || '';
    const epTitle = episode.title || '';
    const order = episode.orderIndex ?? 0;
    const content = `『${title}』第${order}話「${epTitle}」を公開しました`;
    await this.postsService.createAutoPost(userId, PostType.AUTO_EPISODE, {
      content,
      workId: work.id || episode.workId,
      episodeId: episode.id,
    });
  }
}

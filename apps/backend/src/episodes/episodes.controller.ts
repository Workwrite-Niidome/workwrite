import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EpisodesService } from './episodes.service';
import { CreateEpisodeDto, UpdateEpisodeDto } from './dto/episode.dto';
import { ReorderEpisodesDto } from './dto/reorder-episodes.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Episodes')
@Controller()
export class EpisodesController {
  constructor(private episodesService: EpisodesService) {}

  @Get('works/:workId/episodes')
  @ApiOperation({ summary: 'List episodes of a work' })
  findByWork(@Param('workId') workId: string) {
    return this.episodesService.findByWork(workId);
  }

  @Get('episodes/:id')
  @ApiOperation({ summary: 'Get episode content' })
  findOne(@Param('id') id: string) {
    return this.episodesService.findOne(id);
  }

  @Post('works/:workId/episodes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create episode' })
  create(
    @Param('workId') workId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateEpisodeDto,
  ) {
    return this.episodesService.create(workId, userId, dto);
  }

  @Patch('episodes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update episode' })
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateEpisodeDto,
  ) {
    return this.episodesService.update(id, userId, dto);
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
  publish(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.episodesService.publish(id, userId);
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
}

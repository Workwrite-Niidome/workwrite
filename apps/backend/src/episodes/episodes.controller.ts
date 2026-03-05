import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EpisodesService } from './episodes.service';
import { CreateEpisodeDto, UpdateEpisodeDto } from './dto/episode.dto';
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
}

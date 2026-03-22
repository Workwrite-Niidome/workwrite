import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { DiscoverService } from './discover.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Discover')
@Controller('discover')
export class DiscoverController {
  constructor(private discoverService: DiscoverService) {}

  @Get('continue-reading')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get continue reading list' })
  getContinueReading(@CurrentUser('id') userId: string) {
    return this.discoverService.getContinueReading(userId);
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete search' })
  @ApiQuery({ name: 'q', required: true })
  autocomplete(@Query('q') q: string) {
    return this.discoverService.autocomplete(q);
  }

  @Get('search')
  @ApiOperation({ summary: 'Full-text search works' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'genre', required: false })
  @ApiQuery({ name: 'emotionTags', required: false })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'aiGenerated', required: false })
  search(
    @Query('q') q: string,
    @Query('genre') genre?: string,
    @Query('emotionTags') emotionTags?: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('category') category?: string,
    @Query('aiGenerated') aiGenerated?: string,
  ) {
    return this.discoverService.search(q, {
      genre,
      emotionTags: emotionTags ? emotionTags.split(',') : undefined,
      sort,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      category,
      aiGenerated: aiGenerated === 'true' ? true : undefined,
    });
  }

  @Get('top')
  @ApiOperation({ summary: 'Get top page data (popular, recent, hidden gems, trending tags)' })
  getTopPage() {
    return this.discoverService.getTopPage();
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular works' })
  getPopular(@Query('limit') limit?: string) {
    return this.discoverService.getPopularWorks(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent works' })
  getRecent(@Query('limit') limit?: string) {
    return this.discoverService.getRecentWorks(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('hidden-gems')
  @ApiOperation({ summary: 'Get hidden gem works (high quality, low views)' })
  getHiddenGems(@Query('limit') limit?: string) {
    return this.discoverService.getHiddenGems(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('next-for-me')
  @ApiOperation({ summary: 'Get "next book" suggestions based on a completed work' })
  @ApiQuery({ name: 'workId', required: true })
  getNextForMe(@Query('workId') workId: string) {
    return this.discoverService.getNextForMe(workId);
  }

  @Get('emotion/:tagName')
  @ApiOperation({ summary: 'Get works by emotion tag' })
  getByEmotionTag(
    @Param('tagName') tagName: string,
    @Query('limit') limit?: string,
  ) {
    return this.discoverService.getWorksByEmotionTag(tagName, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('immersion')
  @ApiOperation({ summary: 'Get high immersion works' })
  getHighImmersion(@Query('limit') limit?: string) {
    return this.discoverService.getHighImmersionWorks(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('worlds')
  @ApiOperation({ summary: 'Get works with great world building' })
  getGreatWorldBuilding(@Query('limit') limit?: string) {
    return this.discoverService.getGreatWorldBuilding(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('genre/:genre')
  @ApiOperation({ summary: 'Get works by genre' })
  getByGenre(
    @Param('genre') genre: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.discoverService.getWorksByGenre(genre, limit ? parseInt(limit, 10) : undefined, cursor);
  }
}

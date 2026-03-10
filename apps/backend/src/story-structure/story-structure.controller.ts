import {
  Controller, Get, Post, Put, Delete,
  Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoryStructureService } from './story-structure.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CreateCharacterDto, UpdateCharacterDto, SetRelationDto,
  UpsertArcDto, CreateSceneDto, UpdateSceneDto,
} from './dto/story-structure.dto';

@ApiTags('Story Structure')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StoryStructureController {
  constructor(private service: StoryStructureService) {}

  // ─── Characters ────────────────────────────────────

  @Get('works/:workId/characters')
  @ApiOperation({ summary: 'Get all characters for a work (author view)' })
  getCharacters(@Param('workId') workId: string) {
    return this.service.getCharacters(workId);
  }

  @Get('works/:workId/characters/public')
  @ApiOperation({ summary: 'Get public characters (reader view)' })
  getPublicCharacters(@Param('workId') workId: string) {
    return this.service.getPublicCharacters(workId);
  }

  @Post('works/:workId/characters')
  @ApiOperation({ summary: 'Create a character' })
  createCharacter(
    @Param('workId') workId: string,
    @Body() dto: CreateCharacterDto,
  ) {
    return this.service.createCharacter(workId, dto);
  }

  @Put('works/:workId/characters/:id')
  @ApiOperation({ summary: 'Update a character' })
  updateCharacter(
    @Param('workId') workId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCharacterDto,
  ) {
    return this.service.updateCharacter(workId, id, dto);
  }

  @Delete('works/:workId/characters/:id')
  @ApiOperation({ summary: 'Delete a character' })
  deleteCharacter(
    @Param('workId') workId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteCharacter(workId, id);
  }

  @Put('works/:workId/characters/:id/relations')
  @ApiOperation({ summary: 'Set character relation' })
  setRelation(
    @Param('workId') workId: string,
    @Param('id') fromId: string,
    @Body() dto: SetRelationDto,
  ) {
    return this.service.setRelation(workId, fromId, dto);
  }

  @Post('works/:workId/characters/migrate')
  @ApiOperation({ summary: 'Migrate characters from creation plan JSON' })
  migrateCharacters(@Param('workId') workId: string) {
    return this.service.migrateCharacters(workId);
  }

  // ─── Story Arc ─────────────────────────────────────

  @Get('works/:workId/story-arc')
  @ApiOperation({ summary: 'Get story arc with acts and scenes' })
  getStoryArc(@Param('workId') workId: string) {
    return this.service.getStoryArc(workId);
  }

  @Put('works/:workId/story-arc')
  @ApiOperation({ summary: 'Create or update story arc' })
  upsertArc(
    @Param('workId') workId: string,
    @Body() dto: UpsertArcDto,
  ) {
    return this.service.upsertArc(workId, dto);
  }

  @Post('works/:workId/story-arc/scenes')
  @ApiOperation({ summary: 'Add a scene' })
  createScene(
    @Param('workId') workId: string,
    @Body() dto: CreateSceneDto,
  ) {
    return this.service.createScene(workId, dto);
  }

  @Put('works/:workId/story-arc/scenes/:sceneId')
  @ApiOperation({ summary: 'Update a scene' })
  updateScene(
    @Param('workId') workId: string,
    @Param('sceneId') sceneId: string,
    @Body() dto: UpdateSceneDto,
  ) {
    return this.service.updateScene(workId, sceneId, dto);
  }

  @Delete('works/:workId/story-arc/scenes/:sceneId')
  @ApiOperation({ summary: 'Delete a scene' })
  deleteScene(
    @Param('workId') workId: string,
    @Param('sceneId') sceneId: string,
  ) {
    return this.service.deleteScene(workId, sceneId);
  }

  @Post('works/:workId/story-arc/scenes/:sceneId/link-episode')
  @ApiOperation({ summary: 'Link a scene to an episode' })
  linkSceneToEpisode(
    @Param('workId') workId: string,
    @Param('sceneId') sceneId: string,
    @Body('episodeId') episodeId: string,
  ) {
    return this.service.linkSceneToEpisode(workId, sceneId, episodeId);
  }

  @Post('works/:workId/story-arc/migrate')
  @ApiOperation({ summary: 'Migrate arc from creation plan JSON' })
  migrateArc(@Param('workId') workId: string) {
    return this.service.migrateArc(workId);
  }

  // ─── AI Context ────────────────────────────────────

  @Get('works/:workId/story-context')
  @ApiOperation({ summary: 'Get structured context string for AI' })
  getStructuredContext(@Param('workId') workId: string) {
    return this.service.buildStructuredContext(workId);
  }
}

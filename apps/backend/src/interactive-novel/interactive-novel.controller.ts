import { Controller, Post, Get, Param, Body, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SceneComposerService } from './services/scene-composer.service';
import { ReaderStateService } from './services/reader-state.service';
import { WorldConversationService } from './services/world-conversation.service';
import { WorldBuilderService } from './services/world-builder.service';
import { EventSplitterService } from './services/event-splitter.service';
import { EnterDto } from './dto/enter.dto';
import { MoveDto } from './dto/move.dto';
import { TalkDto } from './dto/talk.dto';

@ApiTags('Interactive Novel')
@Controller('interactive-novel')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InteractiveNovelController {
  constructor(
    private sceneComposer: SceneComposerService,
    private readerState: ReaderStateService,
    private worldConversation: WorldConversationService,
    private worldBuilder: WorldBuilderService,
    private eventSplitter: EventSplitterService,
  ) {}

  // ===== REST Endpoints (fast, no SSE) =====

  @Post(':workId/enter')
  async enter(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() body: EnterDto,
  ) {
    const entryLayer = body.entryType === 'read' ? 1 : 2;
    const state = await this.readerState.getOrCreateState(userId, workId, entryLayer);
    await this.readerState.recordJourney(userId, workId, 'enter', { entryType: body.entryType }, state);

    const scene = await this.sceneComposer.composeScene(userId, workId);
    return { data: { state, scene } };
  }

  @Post(':workId/reset')
  async reset(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    await this.readerState.resetState(userId, workId);
    return { data: { reset: true } };
  }

  @Post(':workId/move')
  async move(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() body: MoveDto,
  ) {
    const state = await this.readerState.updateLocation(userId, workId, body.locationId);
    await this.readerState.discoverLocation(userId, workId, body.locationId);
    await this.readerState.recordJourney(userId, workId, 'move', { locationId: body.locationId }, state);

    const scene = await this.sceneComposer.composeScene(userId, workId);
    return { data: { state, scene } };
  }

  @Post(':workId/perspective')
  async changePerspective(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() body: { mode: string },
  ) {
    const perspective = body.mode as 'protagonist' | 'character' | 'omniscient';
    await this.readerState.updatePerspective(userId, workId, perspective);
    await this.readerState.recordJourney(userId, workId, 'perspective', { mode: perspective });

    const scene = await this.sceneComposer.composeScene(userId, workId);
    return { data: { scene } };
  }

  @Post(':workId/time-advance')
  async timeAdvance(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    const state = await this.readerState.advanceTime(userId, workId, 1 / 21);
    await this.readerState.recordJourney(userId, workId, 'time', {}, state);

    const scene = await this.sceneComposer.composeScene(userId, workId);
    return { data: { state, scene } };
  }


  @Get(':workId/state')
  async getState(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    const state = await this.readerState.getState(userId, workId);
    return { data: { state } };
  }

  @Get(':workId/locations')
  async getLocations(
    @Param('workId') workId: string,
  ) {
    const [locations, connections] = await Promise.all([
      this.sceneComposer['prisma'].worldLocation.findMany({ where: { workId } }),
      this.sceneComposer['prisma'].locationConnection.findMany({ where: { workId } }),
    ]);
    return { data: { locations, connections } };
  }

  @Get(':workId/journey')
  async getJourney(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    const logs = await this.readerState.getJourney(userId, workId);
    return { data: { logs } };
  }

  @Get(':workId/experience')
  async getExperience(
    @Param('workId') workId: string,
  ) {
    const work = await this.sceneComposer['prisma'].work.findUnique({
      where: { id: workId },
      select: { experienceScript: true, title: true },
    });
    return { data: { script: work?.experienceScript, title: work?.title } };
  }

  @Get(':workId/build-status')
  async getBuildStatus(
    @Param('workId') workId: string,
  ) {
    const status = await this.worldBuilder.getWorldStatus(workId);
    return { data: status };
  }

  @Post(':workId/build')
  async buildWorld(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    // Admin-only
    const user = await this.sceneComposer['prisma'].user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role !== 'ADMIN') {
      return { error: 'Admin only' };
    }
    const result = await this.worldBuilder.buildWorld(workId);
    return { data: result };
  }

  @Post(':workId/observe')
  async observe(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    const state = await this.readerState.getState(userId, workId);
    if (!state?.locationId) return { data: { text: '周りを見渡す。' } };

    const timeOfDay = this.sceneComposer.getTimeOfDay(state.timelinePosition);
    const rendering = await this.sceneComposer['prisma'].locationRendering.findUnique({
      where: { locationId_timeOfDay: { locationId: state.locationId, timeOfDay } },
    });

    if (rendering) {
      const sensory = rendering.sensoryText as Record<string, string>;
      const parts = Object.values(sensory).filter(Boolean);
      // Return one random sensory detail
      const text = parts[Math.floor(Math.random() * parts.length)] || '静かだ。';
      await this.readerState.recordJourney(userId, workId, 'observe', { timeOfDay }, state);
      return { data: { text } };
    }

    return { data: { text: '静かだ。時間がゆっくりと流れている。' } };
  }

  // ===== SSE Endpoints (streaming) =====

  @Post(':workId/talk')
  async talk(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() body: TalkDto,
    @Res() res: Response,
  ) {
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const keepAlive = setInterval(() => { res.write(`: ping\n\n`); }, 15_000);

    try {
      const stream = this.worldConversation.streamWorldChat(
        userId, workId, body.characterId, body.message, body.useSonnet,
      );
      for await (const chunk of stream) {
        if (res.destroyed) break;
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      res.write(`data: [DONE]\n\n`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      clearInterval(keepAlive);
      res.end();
    }
  }
}

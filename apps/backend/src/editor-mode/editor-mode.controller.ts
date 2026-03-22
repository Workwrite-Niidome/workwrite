import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { EditorModeService } from './editor-mode.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  EditorModeChatDto,
  FinalizeDesignDto,
  StartGenerationDto,
  ReviseEpisodeDto,
  ChangeGenerationModeDto,
} from './dto/editor-mode.dto';

@ApiTags('Editor Mode')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EditorModeController {
  constructor(private editorModeService: EditorModeService) {}

  // ─── Design Chat (SSE) ────────────────────────────────────

  @Post('works/:workId/editor-mode/chat')
  @ApiOperation({ summary: 'Design chat with AI editor (SSE stream)' })
  async chat(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() dto: EditorModeChatDto,
    @Res() res: Response,
  ) {
    const keepAlive = this.setSSEHeaders(res);
    try {
      const stream = this.editorModeService.streamDesignChat(
        userId, workId, dto.message, dto.aiMode || 'normal',
      );
      for await (const chunk of stream) {
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

  // ─── Finalize Design ──────────────────────────────────────

  @Post('works/:workId/editor-mode/finalize')
  @ApiOperation({ summary: 'Finalize design and move to taste check' })
  async finalize(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() dto: FinalizeDesignDto,
  ) {
    return this.editorModeService.finalizeDesign(userId, workId, dto);
  }

  // ─── Generate First Episode (SSE) ─────────────────────────

  @Post('works/:workId/editor-mode/generate-first')
  @ApiOperation({ summary: 'Generate first episode for taste check (SSE stream)' })
  async generateFirst(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() body: { aiMode?: 'normal' | 'premium' },
    @Res() res: Response,
  ) {
    const keepAlive = this.setSSEHeaders(res);
    try {
      const stream = this.editorModeService.generateFirstEpisode(
        userId, workId, body.aiMode || 'normal',
      );
      for await (const chunk of stream) {
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

  // ─── Start Generation ─────────────────────────────────────

  @Post('works/:workId/editor-mode/start')
  @ApiOperation({ summary: 'Start batch generation (fire-and-forget)' })
  async start(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() dto: StartGenerationDto,
  ) {
    return this.editorModeService.startGeneration(userId, workId, dto);
  }

  // ─── Pause ────────────────────────────────────────────────

  @Post('works/:workId/editor-mode/pause')
  @ApiOperation({ summary: 'Pause generation' })
  async pause(@Param('workId') workId: string) {
    return this.editorModeService.pauseGeneration(workId);
  }

  // ─── Resume ───────────────────────────────────────────────

  @Post('works/:workId/editor-mode/resume')
  @ApiOperation({ summary: 'Resume generation' })
  async resume(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() dto: StartGenerationDto,
  ) {
    return this.editorModeService.resumeGeneration(userId, workId, dto);
  }

  // ─── Change Generation Mode ───────────────────────────────

  @Post('works/:workId/editor-mode/mode')
  @ApiOperation({ summary: 'Change generation mode (batch/confirm)' })
  async changeMode(
    @Param('workId') workId: string,
    @Body() dto: ChangeGenerationModeDto,
  ) {
    return this.editorModeService.changeGenerationMode(workId, dto);
  }

  // ─── Revise Episode (SSE) ─────────────────────────────────

  @Post('works/:workId/editor-mode/episodes/:episodeId/revise')
  @ApiOperation({ summary: 'Revise episode with instruction (SSE stream)' })
  async revise(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Param('episodeId') episodeId: string,
    @Body() dto: ReviseEpisodeDto,
    @Res() res: Response,
  ) {
    const keepAlive = this.setSSEHeaders(res);
    try {
      const stream = this.editorModeService.streamReviseEpisode(
        userId, workId, episodeId, dto.instruction, dto.aiMode || 'normal',
      );
      for await (const chunk of stream) {
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

  // ─── Regenerate Episode (SSE) ─────────────────────────────

  @Post('works/:workId/editor-mode/episodes/:episodeId/regenerate')
  @ApiOperation({ summary: 'Regenerate episode from scratch (SSE stream)' })
  async regenerate(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Param('episodeId') episodeId: string,
    @Body() body: { aiMode?: 'normal' | 'premium' },
    @Res() res: Response,
  ) {
    const keepAlive = this.setSSEHeaders(res);
    try {
      const stream = this.editorModeService.streamRegenerateEpisode(
        userId, workId, episodeId, body.aiMode || 'normal',
      );
      for await (const chunk of stream) {
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

  // ─── Auto-fix Episode (SSE) ───────────────────────────────

  @Post('works/:workId/editor-mode/episodes/:episodeId/auto-fix')
  @ApiOperation({ summary: 'AI auto-fix episode with context (SSE stream)' })
  async autoFix(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Param('episodeId') episodeId: string,
    @Body() body: { aiMode?: 'normal' | 'premium' },
    @Res() res: Response,
  ) {
    const keepAlive = this.setSSEHeaders(res);
    try {
      const stream = this.editorModeService.autoFixEpisode(
        userId, workId, episodeId, body.aiMode || 'normal',
      );
      for await (const chunk of stream) {
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

  // ─── Approve Episode ──────────────────────────────────────

  @Post('works/:workId/editor-mode/episodes/:episodeId/approve')
  @ApiOperation({ summary: 'Approve episode' })
  async approve(
    @Param('workId') workId: string,
    @Param('episodeId') episodeId: string,
  ) {
    return this.editorModeService.approveEpisode(workId, episodeId);
  }

  // ─── Status ───────────────────────────────────────────────

  @Get('works/:workId/editor-mode/status')
  @ApiOperation({ summary: 'Get editor mode job status' })
  async status(@Param('workId') workId: string) {
    return this.editorModeService.getStatus(workId);
  }

  // ─── Helpers ──────────────────────────────────────────────

  private setSSEHeaders(res: Response): NodeJS.Timeout {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    return setInterval(() => { res.write(`: ping\n\n`); }, 15_000);
  }
}

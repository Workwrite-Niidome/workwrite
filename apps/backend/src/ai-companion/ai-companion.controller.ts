import { Controller, Post, Get, Delete, Param, Body, Res, UseGuards, ForbiddenException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AiCompanionService } from './ai-companion.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('AI Companion')
@Controller('ai/companion')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiCompanionController {
  constructor(private aiCompanionService: AiCompanionService) {}

  @Post(':workId/chat')
  @ApiOperation({ summary: 'Chat with AI book companion (SSE stream)' })
  async chat(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() body: { message: string },
    @Res() res: Response,
  ) {
    // Start SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Keep-alive ping to prevent Railway/proxy timeout
    const keepAlive = setInterval(() => { res.write(`: ping\n\n`); }, 15_000);

    try {
      const stream = this.aiCompanionService.streamChat(userId, workId, body.message);
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

  @Get(':workId/history')
  @ApiOperation({ summary: 'Get conversation history' })
  getHistory(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    return this.aiCompanionService.getHistory(userId, workId);
  }

  @Delete(':workId')
  @ApiOperation({ summary: 'Clear conversation' })
  clearConversation(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    return this.aiCompanionService.clearConversation(userId, workId);
  }
}

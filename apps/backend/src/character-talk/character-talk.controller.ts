import { Controller, Post, Get, Delete, Param, Body, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { CharacterTalkService } from './character-talk.service';
import { CharacterTalkRevenueService } from './character-talk-revenue.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Character Talk')
@Controller('ai/character-talk')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CharacterTalkController {
  constructor(
    private characterTalkService: CharacterTalkService,
    private revenueService: CharacterTalkRevenueService,
  ) {}

  // Static route must come before parameterized :workId routes
  @Get('earnings')
  @ApiOperation({ summary: 'Get author earnings from character talk' })
  getEarnings(
    @CurrentUser('id') userId: string,
  ) {
    return this.revenueService.getAuthorEarnings(userId);
  }

  @Post(':workId/chat')
  @ApiOperation({ summary: 'Chat with character or companion (SSE stream)' })
  async chat(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() body: { message: string; mode?: 'character' | 'companion'; characterId?: string; useSonnet?: boolean },
    @Res() res: Response,
  ) {
    const mode = body.mode || 'companion';

    // Start SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Keep-alive ping to prevent proxy timeout
    const keepAlive = setInterval(() => { res.write(`: ping\n\n`); }, 15_000);

    try {
      const stream = this.characterTalkService.streamChat(userId, workId, body.message, {
        mode,
        characterId: body.characterId,
        useSonnet: body.useSonnet,
      });
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

  @Get(':workId/characters')
  @ApiOperation({ summary: 'Get available characters for talk' })
  getAvailableCharacters(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Query('episodeId') episodeId?: string,
  ) {
    return this.characterTalkService.getAvailableCharacters(userId, workId, episodeId);
  }

  @Get(':workId/conversations')
  @ApiOperation({ summary: 'Get all conversations for a work' })
  getConversations(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    return this.characterTalkService.getConversations(userId, workId);
  }

  @Get(':workId/history')
  @ApiOperation({ summary: 'Get companion conversation history' })
  getHistory(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    return this.characterTalkService.getHistory(userId, workId);
  }

  @Get(':workId/history/:characterId')
  @ApiOperation({ summary: 'Get character conversation history' })
  getCharacterHistory(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Param('characterId') characterId: string,
  ) {
    return this.characterTalkService.getHistory(userId, workId, characterId);
  }

  @Delete(':workId/conversation')
  @ApiOperation({ summary: 'Clear companion conversation' })
  clearConversation(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
  ) {
    return this.characterTalkService.clearConversation(userId, workId);
  }

  @Delete(':workId/conversation/:characterId')
  @ApiOperation({ summary: 'Clear character conversation' })
  clearCharacterConversation(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Param('characterId') characterId: string,
  ) {
    return this.characterTalkService.clearConversation(userId, workId, characterId, 'character');
  }
}

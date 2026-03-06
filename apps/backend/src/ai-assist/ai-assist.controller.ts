import { Controller, Get, Post, Put, Delete, Body, Param, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AiAssistService } from './ai-assist.service';
import { AiAssistDto, SaveDraftDto } from './dto/ai-assist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('AI Assist')
@Controller()
export class AiAssistController {
  constructor(
    private aiAssist: AiAssistService,
    private prisma: PrismaService,
  ) {}

  @Get('ai/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check AI availability' })
  async getStatus() {
    return this.aiAssist.checkStatus();
  }

  @Post('ai/assist')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI writing assist (SSE stream)' })
  async assist(
    @CurrentUser('id') userId: string,
    @Body() dto: AiAssistDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const stream = this.aiAssist.streamAssist(userId, dto.templateSlug, dto.variables);
      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      res.write(`data: [DONE]\n\n`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      res.end();
    }
  }

  // === Draft endpoints ===

  @Put('episodes/draft')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save episode draft (upsert)' })
  async saveDraft(
    @CurrentUser('id') userId: string,
    @Body() dto: SaveDraftDto,
  ) {
    return this.prisma.episodeDraft.upsert({
      where: {
        userId_workId_episodeId: {
          userId,
          workId: dto.workId,
          episodeId: dto.episodeId || '',
        },
      },
      update: {
        title: dto.title,
        content: dto.content,
        savedAt: new Date(),
      },
      create: {
        userId,
        workId: dto.workId,
        episodeId: dto.episodeId || '',
        title: dto.title,
        content: dto.content,
      },
    });
  }

  @Get('episodes/draft/:workId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get episode draft' })
  async getDraft(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Query('episodeId') episodeId?: string,
  ) {
    return this.prisma.episodeDraft.findUnique({
      where: {
        userId_workId_episodeId: {
          userId,
          workId,
          episodeId: episodeId || '',
        },
      },
    });
  }

  @Delete('episodes/draft/:workId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete episode draft' })
  async deleteDraft(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Query('episodeId') episodeId?: string,
  ) {
    await this.prisma.episodeDraft.deleteMany({
      where: { userId, workId, episodeId: episodeId || '' },
    });
    return { deleted: true };
  }
}

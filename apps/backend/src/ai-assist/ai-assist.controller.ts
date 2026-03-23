import { Controller, Get, Post, Put, Delete, Body, Param, Query, Res, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AiAssistService } from './ai-assist.service';
import { EpisodeAnalysisService } from './episode-analysis.service';
import { AiContextBuilderService } from './ai-context-builder.service';
import { AiAssistDto, ExtractCharactersDto, SaveDraftDto } from './dto/ai-assist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('AI Assist')
@Controller()
export class AiAssistController {
  private readonly logger = new Logger(AiAssistController.name);

  constructor(
    private aiAssist: AiAssistService,
    private episodeAnalysis: EpisodeAnalysisService,
    private contextBuilder: AiContextBuilderService,
    private prisma: PrismaService,
  ) {}

  @Get('ai/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check AI availability and user tier' })
  async getStatus(@CurrentUser('id') userId: string) {
    return this.aiAssist.checkStatus(userId);
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

    // Keep-alive ping to prevent Railway/proxy timeout during long AI generation
    const keepAlive = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 15_000);

    try {
      const stream = this.aiAssist.streamAssist(
        userId,
        dto.templateSlug,
        dto.variables,
        dto.premiumMode,
        dto.conversationId,
        dto.followUpMessage,
        dto.episodeId,
        dto.aiMode,
      );
      for await (const chunk of stream) {
        if (res.destroyed) break;
        // Check for metadata (conversationId)
        if (chunk.startsWith('\n__CONVERSATION_ID__:')) {
          const convId = chunk.replace('\n__CONVERSATION_ID__:', '');
          res.write(`data: ${JSON.stringify({ conversationId: convId })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        }
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

  @Post('ai/extract-characters')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Extract new characters from generated text' })
  async extractCharacters(@Body() dto: ExtractCharactersDto) {
    return this.aiAssist.extractNewCharacters(
      dto.generatedText,
      dto.existingCharacters || [],
    );
  }

  // === Generation History endpoints ===

  @Get('ai/history/:workId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get AI generation history for a work' })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = Math.min(parseInt(limit || '20', 10), 50);
    const skip = parseInt(offset || '0', 10);

    const [items, total] = await Promise.all([
      this.prisma.aiGenerationHistory.findMany({
        where: { userId, workId },
        orderBy: { updatedAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          templateSlug: true,
          promptSummary: true,
          messages: true,
          creditCost: true,
          model: true,
          premiumMode: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.aiGenerationHistory.count({ where: { userId, workId } }),
    ]);

    return { data: items, total };
  }

  @Delete('ai/history/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a generation history item' })
  async deleteHistory(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.prisma.aiGenerationHistory.deleteMany({
      where: { id, userId },
    });
    return { deleted: true };
  }

  // === Structural Analysis endpoints ===

  @Post('ai/analyze/episode/:episodeId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Analyze a single episode for structural data' })
  async analyzeEpisode(
    @Param('episodeId') episodeId: string,
    @CurrentUser('id') userId: string,
  ) {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      select: { workId: true, authorId: true },
    });
    if (!episode || episode.authorId !== userId) {
      return { error: 'Episode not found' };
    }
    await this.episodeAnalysis.analyzeEpisode(episode.workId, episodeId);
    return { success: true };
  }

  @Post('ai/analyze/work/:workId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Analyze all episodes of a work' })
  async analyzeWork(
    @Param('workId') workId: string,
    @CurrentUser('id') userId: string,
    @Query('force') force?: string,
  ) {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { authorId: true },
    });
    if (!work || work.authorId !== userId) {
      return { error: 'Work not found' };
    }
    const result = await this.episodeAnalysis.analyzeAllEpisodes(workId, force === 'true');
    return result;
  }

  @Post('admin/analyze-work/:workId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Analyze all episodes of a specific work (admin only)' })
  async adminAnalyzeWork(
    @Param('workId') workId: string,
    @Query('force') force?: string,
  ) {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: { id: true, title: true },
    });
    if (!work) return { error: 'Work not found' };
    const result = await this.episodeAnalysis.analyzeAllEpisodes(workId, force === 'true');
    return { workId, title: work.title, ...result };
  }

  @Post('admin/analyze-all-published')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Analyze all episodes of all published works (admin only)' })
  async analyzeAllPublished(@Query('force') force?: string) {
    const works = await this.prisma.work.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, title: true, _count: { select: { episodes: true } } },
    });

    const results: { workId: string; title: string; result: any }[] = [];
    for (const work of works) {
      this.logger.log(`Analyzing work: ${work.title} (${work.id}), ${work._count.episodes} episodes`);
      try {
        const result = await this.episodeAnalysis.analyzeAllEpisodes(work.id, force === 'true');
        results.push({ workId: work.id, title: work.title, result });
      } catch (e: any) {
        results.push({ workId: work.id, title: work.title, result: { error: e.message } });
      }
    }

    return { total: works.length, results };
  }

  @Get('ai/context/:workId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get AI writing context for a work' })
  async getContext(
    @Param('workId') workId: string,
    @Query('episodeOrder') episodeOrder?: string,
  ) {
    const order = episodeOrder ? parseInt(episodeOrder, 10) : 999;
    const ctx = await this.contextBuilder.buildContext(workId, order);
    const formatted = this.contextBuilder.formatForPrompt(ctx);
    return { context: ctx, formatted };
  }

  @Get('ai/analysis/:workId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all episode analyses for a work' })
  async getAnalyses(@Param('workId') workId: string) {
    return this.episodeAnalysis.getAnalysisForWork(workId);
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

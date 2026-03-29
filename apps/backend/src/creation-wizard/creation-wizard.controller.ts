import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { CreationWizardService } from './creation-wizard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OriginalityService } from '../originality/originality.service';
import {
  GenerateCharactersDto,
  GeneratePlotDto,
  GenerateEmotionBlueprintDto,
  GenerateChapterOutlineDto,
  GenerateEpisodesForActDto,
  GenerateWorldBuildingDto,
  GenerateSynopsisDto,
  SaveCreationPlanDto,
  AiFeedbackDto,
  AiCheckDto,
} from './dto/creation-wizard.dto';

@ApiTags('Creation Wizard')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CreationWizardController {
  constructor(
    private creationWizardService: CreationWizardService,
    private originalityService: OriginalityService,
  ) {}

  // ─── SSE streaming endpoints ─────────────────────────────────

  @Post('works/:workId/creation/characters')
  @ApiOperation({ summary: 'Generate character suggestions (SSE stream)' })
  async generateCharacters(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() dto: GenerateCharactersDto,
    @Res() res: Response,
  ) {
    const keepAlive = this.setSSEHeaders(res);
    try {
      const stream = this.creationWizardService.generateCharacters(userId, workId, dto);
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

  @Post('works/:workId/creation/plot')
  @ApiOperation({ summary: 'Generate plot outline (SSE stream with parsed JSON)' })
  async generatePlot(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() dto: GeneratePlotDto,
    @Res() res: Response,
  ) {
    const keepAlive = this.setSSEHeaders(res);
    try {
      const stream = this.creationWizardService.generatePlot(userId, workId, dto);
      let fullOutput = '';
      for await (const chunk of stream) {
        fullOutput += chunk;
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      // Parse and send structured data
      const parsed = this.parsePlotJson(fullOutput);
      if (parsed) {
        res.write(`data: ${JSON.stringify({ parsed })}\n\n`);
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

  @Post('works/:workId/creation/emotions')
  @ApiOperation({ summary: 'Generate emotion blueprint (SSE stream)' })
  async generateEmotionBlueprint(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() dto: GenerateEmotionBlueprintDto,
    @Res() res: Response,
  ) {
    const keepAlive = this.setSSEHeaders(res);
    try {
      const stream = this.creationWizardService.generateEmotionBlueprint(userId, workId, dto);
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

  @Post('works/:workId/creation/chapters')
  @ApiOperation({ summary: 'Generate chapter outline (SSE stream with parsed JSON)' })
  async generateChapterOutline(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() dto: GenerateChapterOutlineDto,
    @Res() res: Response,
  ) {
    const keepAlive = this.setSSEHeaders(res);
    try {
      const stream = this.creationWizardService.generateChapterOutline(userId, workId, dto);
      let fullOutput = '';
      for await (const chunk of stream) {
        fullOutput += chunk;
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      // Parse the accumulated output and send structured data
      const parsed = this.parseChapterJson(fullOutput);
      if (parsed) {
        res.write(`data: ${JSON.stringify({ parsed })}\n\n`);
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

  @Post('works/:workId/creation/episodes-for-act')
  @ApiOperation({ summary: 'Generate episode suggestions for a specific act (SSE stream)' })
  async generateEpisodesForAct(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() dto: GenerateEpisodesForActDto,
    @Res() res: Response,
  ) {
    const keepAlive = this.setSSEHeaders(res);
    try {
      const stream = this.creationWizardService.generateEpisodesForAct(userId, workId, dto);
      let fullOutput = '';
      for await (const chunk of stream) {
        fullOutput += chunk;
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      const parsed = this.parseEpisodesJson(fullOutput);
      if (parsed) {
        res.write(`data: ${JSON.stringify({ parsed })}\n\n`);
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

  @Post('works/:workId/creation/world-building')
  @ApiOperation({ summary: 'Generate world building suggestions (SSE stream)' })
  async generateWorldBuilding(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() dto: GenerateWorldBuildingDto,
    @Res() res: Response,
  ) {
    const keepAlive = this.setSSEHeaders(res);
    try {
      const stream = this.creationWizardService.generateWorldBuilding(userId, workId, dto);
      let fullOutput = '';
      for await (const chunk of stream) {
        fullOutput += chunk;
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
      const parsed = this.parseGenericJson(fullOutput);
      if (parsed) {
        res.write(`data: ${JSON.stringify({ parsed })}\n\n`);
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

  @Post('works/:workId/creation/synopsis')
  @ApiOperation({ summary: 'Generate synopsis from context (SSE stream)' })
  async generateSynopsis(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() dto: GenerateSynopsisDto,
    @Res() res: Response,
  ) {
    const keepAlive = this.setSSEHeaders(res);
    try {
      const stream = this.creationWizardService.generateSynopsis(userId, workId, dto);
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

  @Post('works/:workId/episodes/:episodeId/ai-check')
  @ApiOperation({ summary: 'AI consistency check for episode content' })
  async aiCheck(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Param('episodeId') episodeId: string,
    @Body() dto: AiCheckDto,
  ) {
    return this.creationWizardService.aiConsistencyCheck(userId, workId, episodeId, dto.content);
  }

  // ─── JSON parsers ─────────────────────────────────────────

  private parseChapterJson(raw: string): { chapters: any[]; suggestions: string } | null {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // Strategy 1: JSON object with "chapters" key
    try {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        const json = JSON.parse(cleaned.slice(start, end + 1));
        if (json.chapters && Array.isArray(json.chapters) && json.chapters.length > 0) {
          return { chapters: json.chapters, suggestions: json.suggestions || json.pacing || '' };
        }
      }
    } catch { /* next */ }

    // Strategy 2: JSON array directly
    try {
      const arrStart = cleaned.indexOf('[');
      const arrEnd = cleaned.lastIndexOf(']');
      if (arrStart !== -1 && arrEnd > arrStart) {
        const arr = JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
        if (Array.isArray(arr) && arr.length > 0 && arr[0].title) {
          return { chapters: arr, suggestions: '' };
        }
      }
    } catch { /* next */ }

    // Strategy 3: Extract individual JSON objects with "title"
    try {
      const chapters: any[] = [];
      let depth = 0;
      let objStart = -1;
      for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') {
          if (depth === 0) objStart = i;
          depth++;
        } else if (cleaned[i] === '}') {
          depth--;
          if (depth === 0 && objStart !== -1) {
            try {
              const obj = JSON.parse(cleaned.slice(objStart, i + 1));
              if (obj.title && typeof obj.title === 'string') {
                chapters.push(obj);
              }
            } catch { /* skip */ }
            objStart = -1;
          }
        }
      }
      if (chapters.length > 0) {
        return { chapters, suggestions: '' };
      }
    } catch { /* next */ }

    // Strategy 4: Plain text pattern matching
    try {
      const chapters: any[] = [];
      const lines = cleaned.split('\n');
      let current: { number: number; title: string; summary: string } | null = null;

      for (const line of lines) {
        const chMatch = line.match(/^(?:第(\d+)話|(\d+)\.)\s*[：:「]?\s*(.+?)[」]?\s*$/);
        if (chMatch) {
          if (current) chapters.push(current);
          current = {
            number: parseInt(chMatch[1] || chMatch[2], 10),
            title: chMatch[3].trim(),
            summary: '',
          };
        } else if (current && line.trim()) {
          current.summary += (current.summary ? ' ' : '') + line.trim();
        }
      }
      if (current) chapters.push(current);
      if (chapters.length > 0) {
        return { chapters, suggestions: '' };
      }
    } catch { /* skip */ }

    return null;
  }

  private parsePlotJson(raw: string): any | null {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        const json = JSON.parse(cleaned.slice(start, end + 1));
        if (json.premise || json.threeActStructure || json.centralConflict) {
          return json;
        }
      }
    } catch { /* skip */ }
    return null;
  }

  private parseEpisodesJson(raw: string): { episodes: any[] } | null {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        const json = JSON.parse(cleaned.slice(start, end + 1));
        if (json.episodes && Array.isArray(json.episodes)) return json;
      }
    } catch { /* next */ }
    try {
      const arrStart = cleaned.indexOf('[');
      const arrEnd = cleaned.lastIndexOf(']');
      if (arrStart !== -1 && arrEnd > arrStart) {
        const arr = JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
        if (Array.isArray(arr) && arr.length > 0) return { episodes: arr };
      }
    } catch { /* skip */ }
    return null;
  }

  private parseGenericJson(raw: string): any | null {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1));
      }
    } catch { /* skip */ }
    return null;
  }

  // ─── Plan CRUD ───────────────────────────────────────────────

  @Put('works/:workId/creation/plan')
  @ApiOperation({ summary: 'Save/update creation plan' })
  saveCreationPlan(
    @Param('workId') workId: string,
    @Body() dto: SaveCreationPlanDto,
  ) {
    return this.creationWizardService.saveCreationPlan(workId, dto);
  }

  @Get('works/:workId/creation/plan')
  @ApiOperation({ summary: 'Get creation plan' })
  getCreationPlan(@Param('workId') workId: string) {
    return this.creationWizardService.getCreationPlan(workId);
  }

  // ─── AI feedback ─────────────────────────────────────────────

  @Post('ai/creation/feedback')
  @ApiOperation({ summary: 'Log AI creation feedback' })
  logAiFeedback(
    @CurrentUser('id') userId: string,
    @Body() dto: AiFeedbackDto,
  ) {
    return this.creationWizardService.logAiFeedback(userId, dto);
  }

  // ─── Originality ─────────────────────────────────────────────

  @Get('works/:workId/originality')
  @ApiOperation({ summary: 'Get originality score with breakdown' })
  getOriginality(@Param('workId') workId: string) {
    return this.originalityService.getBreakdown(workId);
  }

  // ─── Story Summary ──────────────────────────────────────

  @Post('works/:workId/creation/summary')
  @ApiOperation({ summary: 'Update cached story summary (uses Haiku)' })
  async updateStorySummary(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Query('force') force?: string,
  ) {
    await this.creationWizardService.updateStorySummary(workId, userId, force === 'true');
    return { success: true };
  }

  @Get('works/:workId/creation/summary')
  @ApiOperation({ summary: 'Get cached story summary' })
  getStorySummary(@Param('workId') workId: string) {
    return this.creationWizardService.getStorySummary(workId);
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private setSSEHeaders(res: Response): NodeJS.Timeout {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    // Keep-alive ping to prevent Railway/proxy timeout during long AI generation
    return setInterval(() => { res.write(`: ping\n\n`); }, 15_000);
  }
}

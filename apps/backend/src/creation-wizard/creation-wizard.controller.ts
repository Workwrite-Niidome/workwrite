import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { CreationWizardService } from './creation-wizard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  GenerateCharactersDto,
  GeneratePlotDto,
  GenerateEmotionBlueprintDto,
  GenerateChapterOutlineDto,
  SaveCreationPlanDto,
  AiFeedbackDto,
} from './dto/creation-wizard.dto';

@ApiTags('Creation Wizard')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CreationWizardController {
  constructor(private creationWizardService: CreationWizardService) {}

  // ─── SSE streaming endpoints ─────────────────────────────────

  @Post('works/:workId/creation/characters')
  @ApiOperation({ summary: 'Generate character suggestions (SSE stream)' })
  async generateCharacters(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() dto: GenerateCharactersDto,
    @Res() res: Response,
  ) {
    this.setSSEHeaders(res);
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
      res.end();
    }
  }

  @Post('works/:workId/creation/plot')
  @ApiOperation({ summary: 'Generate plot outline (SSE stream)' })
  async generatePlot(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() dto: GeneratePlotDto,
    @Res() res: Response,
  ) {
    this.setSSEHeaders(res);
    try {
      const stream = this.creationWizardService.generatePlot(userId, workId, dto);
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

  @Post('works/:workId/creation/emotions')
  @ApiOperation({ summary: 'Generate emotion blueprint (SSE stream)' })
  async generateEmotionBlueprint(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() dto: GenerateEmotionBlueprintDto,
    @Res() res: Response,
  ) {
    this.setSSEHeaders(res);
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
      res.end();
    }
  }

  @Post('works/:workId/creation/chapters')
  @ApiOperation({ summary: 'Generate chapter outline (SSE stream)' })
  async generateChapterOutline(
    @CurrentUser('id') userId: string,
    @Param('workId') workId: string,
    @Body() dto: GenerateChapterOutlineDto,
    @Res() res: Response,
  ) {
    this.setSSEHeaders(res);
    try {
      const stream = this.creationWizardService.generateChapterOutline(userId, workId, dto);
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
    return this.creationWizardService.calculateOriginality(workId);
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private setSSEHeaders(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
  }
}

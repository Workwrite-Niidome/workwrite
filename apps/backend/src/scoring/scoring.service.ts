import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { CreditService } from '../billing/credit.service';
import { TextAnalyzerService } from './text-analyzer.service';
import { StructuralDataBuilderService } from './structural-data-builder.service';
import { SampleExtractorService } from './sample-extractor.service';
import { WorkStructureExtractorService } from './work-structure-extractor.service';
import { SCORING_SYSTEM_PROMPT, buildScoringUserPrompt } from './scoring-prompt';
import { ScoringResult, ScoringInput } from './types';

// Re-export for backward compatibility
export type { ScoringResult } from './types';

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  private static readonly SCORING_CREDIT_COST = 1;

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
    private creditService: CreditService,
    private textAnalyzer: TextAnalyzerService,
    private structuralDataBuilder: StructuralDataBuilderService,
    private sampleExtractor: SampleExtractorService,
    private structureExtractor: WorkStructureExtractorService,
  ) {}

  async scoreWork(workId: string, userId?: string): Promise<ScoringResult | null> {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      include: {
        episodes: { orderBy: { orderIndex: 'asc' } },
        tags: true,
      },
    });

    if (!work || work.episodes.length === 0) return null;

    // Credit consumption
    let transactionId: string | null = null;
    if (userId && ScoringService.SCORING_CREDIT_COST > 0) {
      try {
        const result = await this.creditService.consumeCredits(
          userId,
          ScoringService.SCORING_CREDIT_COST,
          'scoring',
          'claude-haiku-4-5-20251001',
        );
        transactionId = result.transactionId;
      } catch (e) {
        this.logger.warn(`Credit consumption failed for scoring: ${e}`);
        throw e;
      }
    }

    try {
      // ── Phase 1: Structural Analysis (no LLM cost) ──
      const episodes = work.episodes.map((ep) => ({
        id: ep.id,
        content: ep.content,
        title: ep.title,
        orderIndex: ep.orderIndex,
      }));

      const importRecord = await this.prisma.workImport.findFirst({
        where: { workId },
        select: { source: true },
      });
      const isImported = !!importRecord;

      // For imported works: auto-extract structure (characters, world, plot) before scoring
      if (isImported) {
        const hasStructure = await this.prisma.storyCharacter.count({ where: { workId } });
        if (hasStructure === 0) {
          this.logger.log(`Auto-extracting structure for imported work ${workId}`);
          await this.structureExtractor.extractAndSave(workId, episodes);
        }
        await this.structureExtractor.batchAnalyzeEpisodes(workId, episodes);
      }

      const [metrics, structure] = await Promise.all([
        Promise.resolve(this.textAnalyzer.analyze(episodes)),
        this.structuralDataBuilder.build(workId, episodes),
      ]);

      const scoringInput: ScoringInput = {
        title: work.title,
        genre: (work as any).genre || null,
        completionStatus: (work as any).completionStatus || 'ONGOING',
        isImported,
        metrics,
        structure,
      };

      this.logger.log(
        `Scoring ${work.title}: ${metrics.totalCharCount} chars, ` +
        `${metrics.episodeCount} episodes, ` +
        `analysis coverage: ${Math.round(structure.analysisCoverage * 100)}%`,
      );

      // ── Phase 2: LLM Scoring (single call with structured data) ──
      const result = await this.callLlmForScoring(scoringInput);

      await this.prisma.qualityScore.upsert({
        where: { workId },
        update: {
          immersion: result.immersion,
          transformation: result.transformation,
          virality: result.virality,
          worldBuilding: result.worldBuilding,
          characterDepth: result.characterDepth,
          structuralScore: result.structuralScore,
          overall: result.overall,
          analysisJson: result.analysis as object,
          improvementTips: result.improvementTips,
          scoredAt: new Date(),
          version: { increment: 1 },
        },
        create: {
          workId,
          immersion: result.immersion,
          transformation: result.transformation,
          virality: result.virality,
          worldBuilding: result.worldBuilding,
          characterDepth: result.characterDepth,
          structuralScore: result.structuralScore,
          overall: result.overall,
          analysisJson: result.analysis as object,
          improvementTips: result.improvementTips,
        },
      });

      // Confirm credit transaction
      if (transactionId) {
        await this.creditService.confirmTransaction(transactionId).catch((e) =>
          this.logger.error(`Credit confirm failed: ${transactionId}`, e),
        );
      }

      return result;
    } catch (e) {
      // Refund on failure
      if (transactionId) {
        await this.creditService.refundTransaction(transactionId).catch((err) =>
          this.logger.error(`Credit refund failed: ${transactionId}`, err),
        );
      }
      this.logger.error('Scoring failed', e);
      return null;
    }
  }

  private async callLlmForScoring(input: ScoringInput): Promise<ScoringResult> {
    const apiKey = await this.aiSettings.getApiKey();

    if (!apiKey) {
      this.logger.warn('CLAUDE_API_KEY not set, using mock scores');
      return this.generateMockScores();
    }

    const userPrompt = buildScoringUserPrompt(input);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
        system: [
          {
            type: 'text',
            text: SCORING_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';

    if (data.stop_reason === 'max_tokens') {
      this.logger.warn(`Scoring response truncated (max_tokens reached). Content length: ${content.length}`);
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // If JSON is truncated, try to repair by closing unclosed strings and braces
      let repaired = jsonMatch[0];
      // Close any unclosed string
      const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
      if (quoteCount % 2 !== 0) repaired += '"';
      // Close unclosed arrays/objects
      const openBrackets = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length;
      const openBraces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length;
      for (let i = 0; i < openBrackets; i++) repaired += ']';
      for (let i = 0; i < openBraces; i++) repaired += '}';
      try {
        parsed = JSON.parse(repaired);
        this.logger.warn('Scoring JSON was truncated but repaired successfully');
      } catch {
        throw new Error('Failed to parse scoring JSON even after repair');
      }
    }

    // Overall = equal-weighted average of all 6 axes
    const overall = Math.round(
      (parsed.immersion +
        parsed.transformation +
        parsed.virality +
        parsed.worldBuilding +
        (parsed.characterDepth || 0) +
        (parsed.structuralScore || 0)) / 6,
    );

    return {
      ...parsed,
      overall,
      characterDepth: parsed.characterDepth || 0,
      structuralScore: parsed.structuralScore || 0,
      emotionTags: parsed.emotionTags || [],
    };
  }

  private generateMockScores(): ScoringResult {
    const rand = () => Math.floor(Math.random() * 30) + 35; // 35-64 range centered around 50
    const s = {
      immersion: rand(),
      transformation: rand(),
      virality: rand(),
      worldBuilding: rand(),
      characterDepth: rand(),
      structuralScore: rand(),
    };
    return {
      ...s,
      overall: Math.round(Object.values(s).reduce((a, b) => a + b, 0) / 6),
      analysis: {
        immersion: 'スコアリング用APIキーが未設定のためモックスコアです',
        transformation: 'スコアリング用APIキーが未設定のためモックスコアです',
        virality: 'スコアリング用APIキーが未設定のためモックスコアです',
        worldBuilding: 'スコアリング用APIキーが未設定のためモックスコアです',
        characterDepth: 'スコアリング用APIキーが未設定のためモックスコアです',
        structuralScore: 'スコアリング用APIキーが未設定のためモックスコアです',
      },
      improvementTips: [
        'CLAUDE_API_KEYを設定すると実際のAI分析が利用できます',
        '本番環境ではClaude APIを使った詳細な分析が提供されます',
        '作品を公開後、自動的にスコアリングが実行されます',
      ],
      emotionTags: ['courage', 'excitement', 'healing'],
    };
  }

  async getScore(workId: string) {
    return this.prisma.qualityScore.findUnique({ where: { workId } });
  }

  async getScoreWithAnalysis(workId: string) {
    const [score, importRecord] = await Promise.all([
      this.prisma.qualityScore.findUnique({ where: { workId } }),
      this.prisma.workImport.findFirst({ where: { workId }, select: { source: true } }),
    ]);
    if (!score) return { data: null };
    return {
      data: {
        immersion: score.immersion,
        transformation: score.transformation,
        virality: score.virality,
        worldBuilding: score.worldBuilding,
        characterDepth: score.characterDepth ?? undefined,
        structuralScore: score.structuralScore ?? undefined,
        overall: score.overall,
        analysis: score.analysisJson as Record<string, string> | null,
        tips: (score.improvementTips as string[]) || [],
        scoredAt: score.scoredAt.toISOString(),
        isImported: !!importRecord,
      },
    };
  }

  async scoreEpisode(episodeId: string): Promise<ScoringResult | null> {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: { work: { select: { id: true, title: true } } },
    });

    if (!episode) return null;

    // For single-episode scoring, use the same 2-phase pipeline
    const episodes = [{
      id: episode.id,
      content: episode.content,
      title: episode.title,
      orderIndex: 0,
    }];

    const [metrics, structure] = await Promise.all([
      Promise.resolve(this.textAnalyzer.analyze(episodes)),
      this.structuralDataBuilder.build(episode.work.id, episodes),
    ]);

    const scoringInput: ScoringInput = {
      title: `${episode.work.title} - ${episode.title}`,
      genre: null,
      completionStatus: 'ONGOING',
      isImported: false,
      metrics,
      structure,
    };

    try {
      return await this.callLlmForScoring(scoringInput);
    } catch (e) {
      this.logger.error('Episode scoring failed', e);
      return null;
    }
  }
}

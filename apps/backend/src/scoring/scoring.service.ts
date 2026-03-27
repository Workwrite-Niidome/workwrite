import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { AiTierService, CreditEstimate } from '../ai-settings/ai-tier.service';
import { CreditService } from '../billing/credit.service';
import { TextAnalyzerService } from './text-analyzer.service';
import { StructuralDataBuilderService } from './structural-data-builder.service';
import { SampleExtractorService } from './sample-extractor.service';
import { WorkStructureExtractorService } from './work-structure-extractor.service';
import { SCORING_SYSTEM_PROMPT, buildScoringUserPrompt } from './scoring-prompt';
import { ScoringResult, ScoringInput } from './types';

// Re-export for backward compatibility
export type { ScoringResult } from './types';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-6';
const SCORING_MAX_TOKENS = 8192;
const MAX_SCORING_CHARS = 150_000;

type ScoringModel = 'haiku' | 'sonnet';
const MODEL_MAP: Record<ScoringModel, string> = {
  haiku: HAIKU_MODEL,
  sonnet: SONNET_MODEL,
};
// Approximate size of SCORING_SYSTEM_PROMPT in characters
const SCORING_SYSTEM_PROMPT_CHARS = 11_000;

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
    private aiTier: AiTierService,
    private creditService: CreditService,
    private textAnalyzer: TextAnalyzerService,
    private structuralDataBuilder: StructuralDataBuilderService,
    private sampleExtractor: SampleExtractorService,
    private structureExtractor: WorkStructureExtractorService,
  ) {}

  /** Estimate the credit cost for scoring a work (no LLM call) */
  async estimateScoringCost(workId: string, userId: string, model: ScoringModel = 'haiku'): Promise<{
    estimate: CreditEstimate;
    sonnetEstimate?: CreditEstimate;
    balance: { total: number; monthly: number; purchased: number };
    totalChars: number;
    episodeCount: number;
  }> {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      include: { episodes: { select: { content: true } } },
    });

    if (!work || work.episodes.length === 0) {
      const balance = await this.creditService.getBalance(userId);
      const estimate = this.aiTier.estimateCreditCost({
        model: MODEL_MAP[model],
        inputChars: 0,
        systemPromptChars: SCORING_SYSTEM_PROMPT_CHARS,
        maxOutputTokens: SCORING_MAX_TOKENS,
        minCredits: 1,
      });
      return { estimate, balance, totalChars: 0, episodeCount: 0 };
    }

    const totalChars = work.episodes.reduce((sum, ep) => sum + ep.content.length, 0);
    const cappedChars = Math.min(totalChars, MAX_SCORING_CHARS);

    const estimate = this.aiTier.estimateCreditCost({
      model: MODEL_MAP['haiku'],
      inputChars: cappedChars,
      systemPromptChars: SCORING_SYSTEM_PROMPT_CHARS,
      maxOutputTokens: SCORING_MAX_TOKENS,
      minCredits: 1,
    });

    const sonnetEstimate = this.aiTier.estimateCreditCost({
      model: MODEL_MAP['sonnet'],
      inputChars: cappedChars,
      systemPromptChars: SCORING_SYSTEM_PROMPT_CHARS,
      maxOutputTokens: SCORING_MAX_TOKENS,
      minCredits: 1,
    });

    const balance = await this.creditService.getBalance(userId);

    return {
      estimate,
      sonnetEstimate,
      balance,
      totalChars,
      episodeCount: work.episodes.length,
    };
  }

  async scoreWork(workId: string, userId?: string, model: ScoringModel = 'haiku'): Promise<{
    newScore: ScoringResult;
    historyId: string;
    currentScore: any;
    autoAdopted: boolean;
  } | null> {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      include: {
        episodes: { orderBy: { orderIndex: 'asc' } },
        tags: true,
      },
    });

    if (!work || work.episodes.length === 0) return null;

    // Dynamic credit cost based on content size
    const totalChars = work.episodes.reduce((sum, ep) => sum + ep.content.length, 0);
    const cappedChars = Math.min(totalChars, MAX_SCORING_CHARS);
    const selectedModel = MODEL_MAP[model];
    const { credits: creditCost } = this.aiTier.estimateCreditCost({
      model: selectedModel,
      inputChars: cappedChars,
      systemPromptChars: SCORING_SYSTEM_PROMPT_CHARS,
      maxOutputTokens: SCORING_MAX_TOKENS,
      minCredits: 1,
    });

    // Credit consumption
    let transactionId: string | null = null;
    if (userId && creditCost > 0) {
      try {
        const result = await this.creditService.consumeCredits(
          userId,
          creditCost,
          'scoring',
          selectedModel,
        );
        transactionId = result.transactionId;
      } catch (e) {
        this.logger.warn(`Credit consumption failed for scoring: ${e}`);
        throw e;
      }
    }

    try {
      // ── Phase 1: Structural Analysis (no LLM cost) ──
      const allEpisodes = work.episodes.map((ep) => ({
        id: ep.id,
        content: ep.content,
        title: ep.title,
        orderIndex: ep.orderIndex,
      }));

      // Limit to 150K chars (~小説1冊分) for scoring accuracy
      let episodes = allEpisodes;
      const allTotalChars = allEpisodes.reduce((s, ep) => s + ep.content.length, 0);
      const isLongWork = allTotalChars > MAX_SCORING_CHARS;

      if (isLongWork) {
        // Long work mode: use distributed sampling across the entire work
        // instead of truncating to only the first N episodes.
        // We still limit total chars sent to the LLM, but sample from all parts.
        let charCount = 0;
        const limited: typeof allEpisodes = [];
        for (const ep of allEpisodes) {
          if (charCount + ep.content.length > MAX_SCORING_CHARS && limited.length > 0) break;
          limited.push(ep);
          charCount += ep.content.length;
        }
        this.logger.log(
          `Work ${workId}: ${allTotalChars} chars exceeds ${MAX_SCORING_CHARS} limit. ` +
          `Long work mode: metrics from first ${limited.length}/${allEpisodes.length} episodes, ` +
          `but text samples distributed across all ${allEpisodes.length} episodes.`,
        );
        episodes = limited;
      }

      const importRecord = await this.prisma.workImport.findFirst({
        where: { workId },
        select: { source: true },
      });
      const isImported = !!importRecord;

      // For imported works: auto-extract structure (characters, world, plot) before scoring
      // Use all episodes for structure extraction (characters appear throughout)
      if (isImported) {
        const hasStructure = await this.prisma.storyCharacter.count({ where: { workId } });
        if (hasStructure === 0) {
          this.logger.log(`Auto-extracting structure for imported work ${workId}`);
          await this.structureExtractor.extractAndSave(workId, allEpisodes);
        }
      }

      const [metrics, structure] = await Promise.all([
        Promise.resolve(this.textAnalyzer.analyze(episodes)),
        this.structuralDataBuilder.build(workId, episodes),
      ]);

      // For long works, override text samples with distributed sampling
      if (isLongWork) {
        const distributed = this.sampleExtractor.extractDistributed(allEpisodes);
        // Replace the 4-sample structure with distributed samples in the structure
        // We pack distributed samples into the existing textSamples format for compatibility
        const distSamples = distributed.samples;
        structure.textSamples = {
          opening: distSamples.find((s) => s.label === '冒頭')?.content || structure.textSamples.opening,
          midpoint: distSamples.filter((s) => ['序盤の転換点', '第一四半', '中盤'].includes(s.label))
            .map((s) => `\n--- ${s.label}（${s.episodeTitle}）---\n${s.content}`).join('\n') || structure.textSamples.midpoint,
          climaxRegion: distSamples.filter((s) => ['第三四半', 'クライマックス付近'].includes(s.label))
            .map((s) => `\n--- ${s.label}（${s.episodeTitle}）---\n${s.content}`).join('\n') || structure.textSamples.climaxRegion,
          ending: distSamples.find((s) => s.label === '結末')?.content || structure.textSamples.ending,
        };
      }

      const scoringInput: ScoringInput = {
        title: work.title,
        genre: (work as any).genre || null,
        completionStatus: (work as any).completionStatus || 'ONGOING',
        isImported,
        metrics,
        structure,
        isLongWork,
        totalEpisodeCount: isLongWork ? allEpisodes.length : undefined,
        totalCharCount: isLongWork ? allTotalChars : undefined,
      };

      this.logger.log(
        `Scoring ${work.title}: ${metrics.totalCharCount} chars, ` +
        `${metrics.episodeCount} episodes, ` +
        `analysis coverage: ${Math.round(structure.analysisCoverage * 100)}%`,
      );

      // ── Phase 2: LLM Scoring (single call with structured data) ──
      const result = await this.callLlmForScoring(scoringInput, selectedModel);

      // Save to history (NOT to QualityScore — user decides whether to adopt)
      const currentScore = await this.prisma.qualityScore.findUnique({ where: { workId } });
      const historyEntry = await this.prisma.scoreHistory.create({
        data: {
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
          emotionTags: result.emotionTags as any,
          model,
        },
      });

      // Auto-adopt if no current score exists (first time scoring)
      if (!currentScore) {
        await this.adoptScore(workId, historyEntry.id);
      }

      // Confirm credit transaction
      if (transactionId) {
        await this.creditService.confirmTransaction(transactionId).catch((e) =>
          this.logger.error(`Credit confirm failed: ${transactionId}`, e),
        );
      }

      return { newScore: result, historyId: historyEntry.id, currentScore, autoAdopted: !currentScore };
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

  private async callLlmForScoring(input: ScoringInput, modelId: string = HAIKU_MODEL): Promise<ScoringResult> {
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
        model: modelId,
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

  async adoptScore(workId: string, historyId: string, userId?: string) {
    const entry = await this.prisma.scoreHistory.findUnique({ where: { id: historyId } });
    if (!entry || entry.workId !== workId) return false;

    if (userId) {
      const work = await this.prisma.work.findUnique({ where: { id: workId }, select: { authorId: true } });
      if (!work || work.authorId !== userId) return false;
    }

    await this.prisma.qualityScore.upsert({
      where: { workId },
      update: {
        immersion: entry.immersion,
        transformation: entry.transformation,
        virality: entry.virality,
        worldBuilding: entry.worldBuilding,
        characterDepth: entry.characterDepth,
        structuralScore: entry.structuralScore,
        overall: entry.overall,
        analysisJson: entry.analysisJson as any,
        improvementTips: entry.improvementTips as any,
        scoredAt: entry.scoredAt,
        version: { increment: 1 },
      },
      create: {
        workId,
        immersion: entry.immersion,
        transformation: entry.transformation,
        virality: entry.virality,
        worldBuilding: entry.worldBuilding,
        characterDepth: entry.characterDepth,
        structuralScore: entry.structuralScore,
        overall: entry.overall,
        analysisJson: entry.analysisJson as any,
        improvementTips: entry.improvementTips as any,
        scoredAt: entry.scoredAt,
      },
    });
    return true;
  }

  async getHistory(workId: string, limit = 20) {
    return this.prisma.scoreHistory.findMany({
      where: { workId },
      orderBy: { scoredAt: 'desc' },
      take: limit,
    });
  }
}

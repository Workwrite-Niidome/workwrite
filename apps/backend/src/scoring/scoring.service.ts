import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';

export interface ScoringResult {
  immersion: number;
  transformation: number;
  virality: number;
  worldBuilding: number;
  characterDepth: number;
  structuralScore: number;
  overall: number;
  analysis: {
    immersion: string;
    transformation: string;
    virality: string;
    worldBuilding: string;
    characterDepth?: string;
    structuralScore?: string;
  };
  improvementTips: string[];
  emotionTags: string[];
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
  ) {}

  async scoreWork(workId: string): Promise<ScoringResult | null> {
    const [work, characters, storyArc] = await Promise.all([
      this.prisma.work.findUnique({
        where: { id: workId },
        include: {
          episodes: { orderBy: { orderIndex: 'asc' } },
          tags: true,
        },
      }),
      this.prisma.storyCharacter.findMany({
        where: { workId },
        select: { name: true, role: true, personality: true, arc: true },
        take: 10,
      }),
      this.prisma.storyArc.findUnique({
        where: { workId },
        select: { premise: true, centralConflict: true, themes: true },
      }),
    ]);

    if (!work || work.episodes.length === 0) return null;

    const fullText = work.episodes.map((ep) => ep.content).join('\n\n---\n\n');
    const truncatedText = fullText.slice(0, 15000); // Limit for API

    try {
      const result = await this.callLlmForScoring(work.title, truncatedText, characters, storyArc);

      await this.prisma.qualityScore.upsert({
        where: { workId },
        update: {
          immersion: result.immersion,
          transformation: result.transformation,
          virality: result.virality,
          worldBuilding: result.worldBuilding,
          characterDepth: result.characterDepth || null,
          structuralScore: result.structuralScore || null,
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
          characterDepth: result.characterDepth || null,
          structuralScore: result.structuralScore || null,
          overall: result.overall,
          analysisJson: result.analysis as object,
          improvementTips: result.improvementTips,
        },
      });

      return result;
    } catch (e) {
      this.logger.error('Scoring failed', e);
      return null;
    }
  }

  private async callLlmForScoring(
    title: string,
    text: string,
    characters?: { name: string; role: string; personality: string | null; arc: string | null }[],
    storyArc?: { premise: string | null; centralConflict: string | null; themes: string[] } | null,
  ): Promise<ScoringResult> {
    const apiKey = await this.aiSettings.getApiKey();

    if (!apiKey) {
      this.logger.warn('CLAUDE_API_KEY not set, using mock scores');
      return this.generateMockScores();
    }

    // Use Haiku for scoring (cost-efficient, structured output)
    const scoringSystemPrompt = `あなたは小説の品質を評価する専門家です。6つの軸で0-100点で採点し、改善提案を3つ出してください。

評価軸:
- immersion: 没入力（読者を引き込む力）
- transformation: 変容力（読者に変化を与える力）
- virality: 拡散力（人に薦めたくなる力）
- worldBuilding: 世界構築力
- characterDepth: キャラクター深度（人物の立体感、成長、一貫性）
- structuralScore: 構造スコア（プロット構成、伏線、ペーシング）

キャラクター設計データや物語構造データがある場合は、計画と実際の作品を比較して評価してください。

emotionTagsは以下から3〜5個選んでください: courage, tears, worldview, healing, excitement, thinking, laughter, empathy, awe, nostalgia, suspense, mystery, hope, beauty, growth

以下のJSON形式で回答してください:
{
  "immersion": <0-100>,
  "transformation": <0-100>,
  "virality": <0-100>,
  "worldBuilding": <0-100>,
  "characterDepth": <0-100>,
  "structuralScore": <0-100>,
  "analysis": {
    "immersion": "<分析コメント>",
    "transformation": "<分析コメント>",
    "virality": "<分析コメント>",
    "worldBuilding": "<分析コメント>",
    "characterDepth": "<分析コメント>",
    "structuralScore": "<分析コメント>"
  },
  "improvementTips": ["<提案1>", "<提案2>", "<提案3>"],
  "emotionTags": ["<感情タグ3〜5個>"]
}`;

    // Build enriched user prompt with structured data
    const structuredParts: string[] = [];
    if (characters && characters.length > 0) {
      structuredParts.push(`\n【キャラクター設計】\n${characters.map((c) =>
        `- ${c.name} (${c.role}): 性格=${c.personality || '不明'}, アーク=${c.arc || '不明'}`,
      ).join('\n')}`);
    }
    if (storyArc) {
      const arcLines: string[] = [];
      if (storyArc.premise) arcLines.push(`前提: ${storyArc.premise}`);
      if (storyArc.centralConflict) arcLines.push(`葛藤: ${storyArc.centralConflict}`);
      if (storyArc.themes.length > 0) arcLines.push(`テーマ: ${storyArc.themes.join(', ')}`);
      if (arcLines.length > 0) structuredParts.push(`\n【物語構造】\n${arcLines.join('\n')}`);
    }

    const userPrompt = `タイトル: ${title}${structuredParts.join('')}\n\n本文（抜粋）:\n${text}`;

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
        max_tokens: 2000,
        system: [
          {
            type: 'text',
            text: scoringSystemPrompt,
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

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]);
    const overall = Math.round(
      (parsed.immersion + parsed.transformation + parsed.virality + parsed.worldBuilding) / 4,
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
    const rand = () => Math.floor(Math.random() * 30) + 50;
    const scores = {
      immersion: rand(),
      transformation: rand(),
      virality: rand(),
      worldBuilding: rand(),
    };
    return {
      ...scores,
      characterDepth: rand(),
      structuralScore: rand(),
      overall: Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 4),
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
    const score = await this.prisma.qualityScore.findUnique({ where: { workId } });
    if (!score) return null;
    return {
      ...score,
      analysis: score.analysisJson as Record<string, string> | null,
      tips: (score.improvementTips as string[]) || [],
    };
  }

  async scoreEpisode(episodeId: string): Promise<ScoringResult | null> {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: { work: { select: { title: true } } },
    });

    if (!episode) return null;

    const truncatedText = episode.content.slice(0, 15000);

    try {
      const result = await this.callLlmForScoring(
        `${episode.work.title} - ${episode.title}`,
        truncatedText,
      );
      return result;
    } catch (e) {
      this.logger.error('Episode scoring failed', e);
      return null;
    }
  }
}

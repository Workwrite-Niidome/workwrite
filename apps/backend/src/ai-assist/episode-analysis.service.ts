import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnalysisResult {
  summary: string;
  endState: string;
  handoverContext: string;
  narrativePOV: string;
  emotionalArc: string;
  timelineStart: string;
  timelineEnd: string;
  locations: { name: string; description: string }[];
  characters: { name: string; role: string; action: string; currentState: string }[];
  foreshadowings: { description: string; type: 'plant' | 'develop' | 'resolve' }[];
  dialogueSamples: { character: string; line: string; context: string; emotion: string }[];
  newWorldRules: { category: string; name: string; description: string }[];
  characterConsistency?: { name: string; consistent: boolean; notes: string }[];
}

@Injectable()
export class EpisodeAnalysisService {
  private readonly logger = new Logger(EpisodeAnalysisService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
  ) {}

  async analyzeEpisode(workId: string, episodeId: string): Promise<void> {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: { aiAnalysis: true },
    });

    if (!episode) {
      this.logger.warn(`Episode not found: ${episodeId}`);
      return;
    }

    // Skip if analysis is up to date
    if (
      episode.aiAnalysis &&
      episode.aiAnalysis.version === episode.contentVersion
    ) {
      this.logger.debug(
        `Episode ${episodeId} analysis is up to date (v${episode.contentVersion})`,
      );
      return;
    }

    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) {
      this.logger.error('API key is not configured, skipping analysis');
      return;
    }

    // Get character data for consistency checking
    const storyCharacters = await this.prisma.storyCharacter.findMany({
      where: { workId },
      select: { name: true, role: true, personality: true, speechStyle: true, firstPerson: true },
      take: 20,
    });

    // Get previous episode analysis for continuity context
    let previousContext = '';
    if (episode.orderIndex > 0) {
      const prevEpisode = await this.prisma.episode.findFirst({
        where: {
          workId,
          orderIndex: episode.orderIndex - 1,
        },
        include: { aiAnalysis: true },
      });
      if (prevEpisode?.aiAnalysis) {
        previousContext = `
【前回のエピソードの要約】
${prevEpisode.aiAnalysis.summary}

【前回の終了時の状況】
${prevEpisode.aiAnalysis.endState || '（なし）'}`;
      }
      // Also include raw text ending of previous episode for grounding
      if (prevEpisode?.content) {
        const rawEnding = prevEpisode.content.slice(-1500);
        previousContext += `\n\n【前回のエピソード末尾（原文）】\n${rawEnding}`;
      }
    }

    const analysisSystemPrompt = `あなたは小説分析の専門家です。エピソードを分析し、構造データをJSON形式で抽出してください。

【最重要ルール】
- テキストに書かれている事実のみを抽出してください。推測・補完・行間の解釈は絶対にしないでください
- 「〇〇だろう」「〇〇と思われる」「おそらく〇〇」のような推測表現は禁止です
- 曖昧な場合は「不明」または「明示されていない」と記述してください
- summaryには必ず原文のキーフレーズを「」で引用して含めてください

【指示】
- summaryは200〜400文字で、主要な出来事を時系列で記述してください。原文の重要な台詞やフレーズを「」で引用してください
- endStateは300〜500文字で、エピソード終了時点の詳細な状況を記述してください。場所、時間帯、各キャラの物理的位置と感情状態、進行中の行動を含めてください
- handoverContextは200〜300文字で、次の話を書く人が知るべき引き継ぎ情報を記述してください。保留中の会話、未完了の行動、次に起きるべきこと、キャラの直近の感情を含めてください
- dialogueSamplesは各キャラクターにつき最大3つ、最も代表的なセリフを選んでください
- foreshadowingsのtypeは以下の通り分類してください:
  - "plant": 新しく設置された伏線
  - "develop": 進展した伏線
  - "resolve": 回収された伏線
- characterConsistencyでは、提供されたキャラクター設計との矛盾を厳密にチェックしてください（一人称、口調、性格の逸脱）

以下のJSON形式で出力してください。JSONのみを出力してください。

{
  "summary": "200-400字の要約（原文キーフレーズを「」で引用）",
  "endState": "300-500字のエピソード終了時点の詳細な状況描写",
  "handoverContext": "200-300字の次話への引き継ぎ情報",
  "narrativePOV": "視点（一人称主人公/三人称限定/三人称神視点等）",
  "emotionalArc": "感情の流れ（例: 期待→不安→決意）",
  "timelineStart": "時間軸開始（例: 翌朝/3日後）",
  "timelineEnd": "時間軸終了",
  "locations": [{ "name": "場所名", "description": "簡潔な描写" }],
  "characters": [{ "name": "キャラ名", "role": "この話での役割", "action": "主な行動", "currentState": "終了時の状態（感情・物理的位置を含む）" }],
  "foreshadowings": [{ "description": "伏線の内容", "type": "plant/develop/resolve" }],
  "dialogueSamples": [{ "character": "キャラ名", "line": "代表的なセリフ（原文そのまま）", "context": "状況", "emotion": "感情" }],
  "newWorldRules": [{ "category": "geography/magic/social/technology/culture", "name": "設定名", "description": "詳細" }],
  "characterConsistency": [{ "name": "キャラ名", "consistent": true, "notes": "一貫性に関するメモ（設計との差異を具体的に）" }]
}`;

    // Build character reference for consistency checking
    let characterReference = '';
    if (storyCharacters.length > 0) {
      characterReference = `\n【キャラクター設計（一貫性チェック用）】\n${storyCharacters.map((c) =>
        `- ${c.name} (${c.role}): ${[
          c.personality ? `性格=${c.personality}` : '',
          c.speechStyle ? `口調=${c.speechStyle}` : '',
          c.firstPerson ? `一人称=${c.firstPerson}` : '',
        ].filter(Boolean).join(', ')}`,
      ).join('\n')}\n`;
    }

    // Build open foreshadowing list for resolution detection
    let foreshadowingReference = '';
    const openForeshadowings = await this.prisma.foreshadowing.findMany({
      where: { workId, status: 'open' },
      orderBy: { plantedIn: 'asc' },
    });
    if (openForeshadowings.length > 0) {
      foreshadowingReference = `\n【未回収の伏線リスト（このエピソードで回収されたものがあれば、foreshadowingsにtype:"resolve"で含めてください）】\n${
        openForeshadowings.map((f, i) => `[F${i + 1}] (第${f.plantedIn + 1}話で設置) ${f.description}`).join('\n')
      }\n※ 回収された伏線のdescriptionは、上記リストの記述をそのまま使ってください（マッチング精度のため）\n`;
    }

    const userPrompt = `${previousContext}${characterReference}${foreshadowingReference}
【エピソードタイトル】${episode.title}

【本文】
${episode.content}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-beta': 'prompt-caching-2024-07-31',
        },
        body: JSON.stringify({
          model: HAIKU_MODEL,
          max_tokens: 4000,
          system: [
            {
              type: 'text',
              text: analysisSystemPrompt,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        this.logger.error(
          `Claude API error ${response.status}: ${errorText}`,
        );
        return;
      }

      const data = (await response.json()) as {
        content: { type: string; text?: string }[];
      };
      const text = data.content?.[0]?.text || '';

      const analysis = this.parseAnalysisJson(text);
      if (!analysis) {
        this.logger.error(
          `Failed to parse analysis JSON for episode ${episodeId}`,
        );
        return;
      }

      // Upsert EpisodeAnalysis
      await this.prisma.episodeAnalysis.upsert({
        where: { episodeId },
        update: {
          version: episode.contentVersion,
          summary: analysis.summary,
          endState: analysis.endState || null,
          narrativePOV: analysis.narrativePOV || null,
          emotionalArc: analysis.emotionalArc || null,
          timelineStart: analysis.timelineStart || null,
          timelineEnd: analysis.timelineEnd || null,
          locations: analysis.locations || [],
          characters: analysis.characters || [],
          foreshadowings: analysis.foreshadowings || [],
          dialogueSamples: analysis.dialogueSamples || [],
          newWorldRules: analysis.newWorldRules || [],
        },
        create: {
          episodeId,
          workId,
          version: episode.contentVersion,
          summary: analysis.summary,
          endState: analysis.endState || null,
          narrativePOV: analysis.narrativePOV || null,
          emotionalArc: analysis.emotionalArc || null,
          timelineStart: analysis.timelineStart || null,
          timelineEnd: analysis.timelineEnd || null,
          locations: analysis.locations || [],
          characters: analysis.characters || [],
          foreshadowings: analysis.foreshadowings || [],
          dialogueSamples: analysis.dialogueSamples || [],
          newWorldRules: analysis.newWorldRules || [],
        },
      });

      // Save Foreshadowing entries
      if (analysis.foreshadowings?.length) {
        for (const f of analysis.foreshadowings) {
          if (f.type === 'plant') {
            // Check if similar foreshadowing already exists
            const existing = await this.prisma.foreshadowing.findFirst({
              where: { workId, description: f.description },
            });
            if (!existing) {
              await this.prisma.foreshadowing.create({
                data: {
                  workId,
                  description: f.description,
                  plantedIn: episode.orderIndex,
                  status: 'open',
                },
              });
            }
          } else if (f.type === 'resolve') {
            // Try to find and resolve matching foreshadowing
            // Fetch all open foreshadowings and do bidirectional substring matching
            const openForeshadowings = await this.prisma.foreshadowing.findMany({
              where: { workId, status: 'open' },
            });
            const resolveDesc = f.description.toLowerCase();
            let bestMatch: (typeof openForeshadowings)[0] | null = null;
            let bestScore = 0;
            for (const open of openForeshadowings) {
              const plantDesc = open.description.toLowerCase();
              // Check bidirectional: resolve contains plant keywords, or plant contains resolve keywords
              const plantWords = plantDesc.split(/[\s、。（）「」]/u).filter((w) => w.length >= 3);
              const resolveWords = resolveDesc.split(/[\s、。（）「」]/u).filter((w) => w.length >= 3);
              let score = 0;
              for (const pw of plantWords) {
                if (resolveDesc.includes(pw)) score += pw.length;
              }
              for (const rw of resolveWords) {
                if (plantDesc.includes(rw)) score += rw.length;
              }
              // Also check direct substring (either direction)
              if (resolveDesc.includes(plantDesc.slice(0, 15))) score += 10;
              if (plantDesc.includes(resolveDesc.slice(0, 15))) score += 10;
              if (score > bestScore) {
                bestScore = score;
                bestMatch = open;
              }
            }
            if (bestMatch && bestScore >= 3) {
              await this.prisma.foreshadowing.update({
                where: { id: bestMatch.id },
                data: {
                  resolvedIn: episode.orderIndex,
                  status: 'resolved',
                },
              });
            }
          }
        }
      }

      // Save WorldSetting entries
      if (analysis.newWorldRules?.length) {
        for (const rule of analysis.newWorldRules) {
          await this.prisma.worldSetting.upsert({
            where: {
              workId_category_name: {
                workId,
                category: rule.category,
                name: rule.name,
              },
            },
            update: {
              description: rule.description,
              lastEpisode: episode.orderIndex,
            },
            create: {
              workId,
              category: rule.category,
              name: rule.name,
              description: rule.description,
              firstEpisode: episode.orderIndex,
              lastEpisode: episode.orderIndex,
            },
          });
        }
      }

      // Save CharacterDialogueSample entries
      if (analysis.dialogueSamples?.length) {
        // Delete existing samples for this episode to avoid duplicates
        await this.prisma.characterDialogueSample.deleteMany({
          where: { workId, episodeOrder: episode.orderIndex },
        });

        for (const sample of analysis.dialogueSamples) {
          // Try to find matching StoryCharacter
          const character = await this.prisma.storyCharacter.findFirst({
            where: { workId, name: sample.character },
          });

          await this.prisma.characterDialogueSample.create({
            data: {
              workId,
              characterId: character?.id || null,
              characterName: sample.character,
              episodeOrder: episode.orderIndex,
              line: sample.line,
              context: sample.context || null,
              emotion: sample.emotion || null,
            },
          });
        }
      }

      // Update StoryCharacter.currentState from analysis
      if (analysis.characters?.length) {
        for (const char of analysis.characters) {
          if (!char.currentState) continue;
          const storyChar = await this.prisma.storyCharacter.findFirst({
            where: { workId, name: char.name },
          });
          if (storyChar) {
            await this.prisma.storyCharacter.update({
              where: { id: storyChar.id },
              data: { currentState: char.currentState },
            });
          }
        }
      }

      this.logger.log(
        `Analyzed episode "${episode.title}" (${episodeId}) v${episode.contentVersion}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to analyze episode ${episodeId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async analyzeAllEpisodes(
    workId: string,
    force = false,
  ): Promise<{ analyzed: number; skipped: number }> {
    const episodes = await this.prisma.episode.findMany({
      where: { workId },
      orderBy: { orderIndex: 'asc' },
      select: { id: true },
    });

    // Force mode: delete all existing analyses to bypass version check
    if (force) {
      await this.prisma.episodeAnalysis.deleteMany({ where: { workId } });
      this.logger.log(`Force mode: deleted all existing analyses for work ${workId}`);
    }

    let analyzed = 0;
    let skipped = 0;

    for (const ep of episodes) {
      if (!force) {
        const needs = await this.needsAnalysis(ep.id);
        if (!needs) {
          skipped++;
          continue;
        }
      }
      await this.analyzeEpisode(workId, ep.id);
      analyzed++;
    }

    this.logger.log(
      `analyzeAllEpisodes for work ${workId}: analyzed=${analyzed}, skipped=${skipped}, force=${force}`,
    );
    return { analyzed, skipped };
  }

  async getAnalysisForWork(workId: string) {
    return this.prisma.episodeAnalysis.findMany({
      where: { workId },
      orderBy: { episode: { orderIndex: 'asc' } },
    });
  }

  async needsAnalysis(episodeId: string): Promise<boolean> {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: { aiAnalysis: true },
    });
    if (!episode) return false;
    if (!episode.aiAnalysis) return true;
    return episode.aiAnalysis.version !== episode.contentVersion;
  }

  private parseAnalysisJson(text: string): AnalysisResult | null {
    const cleaned = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) return null;

    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as AnalysisResult;
    } catch (e) {
      this.logger.error(
        `JSON parse error: ${e instanceof Error ? e.message : e}`,
      );
      return null;
    }
  }
}

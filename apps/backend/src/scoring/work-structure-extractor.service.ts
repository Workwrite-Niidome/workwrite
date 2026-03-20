import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { SampleExtractorService } from './sample-extractor.service';

interface EpisodeInput {
  id: string;
  content: string;
  title: string;
  orderIndex: number;
}

interface ExtractedStructure {
  characters: {
    name: string;
    role: string;
    gender?: string;
    personality?: string;
    speechStyle?: string;
    firstPerson?: string;
    description?: string;
  }[];
  worldSettings: {
    category: string;
    name: string;
    description: string;
  }[];
  storyArc: {
    premise: string;
    centralConflict: string;
    themes: string[];
  } | null;
  episodeSummaries: {
    orderIndex: number;
    summary: string;
    emotionalArc: string;
  }[];
  narrativePOV: string;
  foreshadowings: {
    description: string;
    plantedIn: number;
    status: string;
  }[];
  dialogueSamples: {
    character: string;
    line: string;
    episodeOrder: number;
  }[];
}

const EXTRACTION_PROMPT = `あなたは小説の構造分析の専門家です。与えられた小説のテキストサンプルとエピソード一覧から、作品の構造データを抽出してください。

以下のJSON形式で回答してください（JSON以外の文章は不要）:
{
  "characters": [
    {
      "name": "キャラクター名",
      "role": "主人公/ヒロイン/ライバル/敵役/仲間/メンター等",
      "gender": "男性/女性/その他/不明",
      "personality": "性格の要約（1-2文）",
      "speechStyle": "口調の特徴（例: 丁寧語、ぶっきらぼう）",
      "firstPerson": "一人称（僕/俺/私/あたし等）",
      "description": "外見や特徴の要約（1文）"
    }
  ],
  "worldSettings": [
    {
      "category": "geography/magic/social/technology/culture のいずれか",
      "name": "設定名",
      "description": "設定の説明（1-2文）"
    }
  ],
  "storyArc": {
    "premise": "物語の前提（1-2文）",
    "centralConflict": "中心的な葛藤（1文）",
    "themes": ["テーマ1", "テーマ2"]
  },
  "episodeSummaries": [
    {
      "orderIndex": 0,
      "summary": "その話の要約（2-3文。固有名詞を使用）",
      "emotionalArc": "感情の流れ（例: 期待→不安→決意）"
    }
  ],
  "narrativePOV": "一人称/三人称限定/三人称全知/二人称 のいずれか",
  "foreshadowings": [
    {
      "description": "伏線の内容",
      "plantedIn": 0,
      "status": "open/resolved"
    }
  ],
  "dialogueSamples": [
    {
      "character": "キャラクター名",
      "line": "印象的なセリフ（「」内の台詞）",
      "episodeOrder": 0
    }
  ]
}

注意:
- キャラクターは主要なもの（台詞があるキャラ）を最大10人まで抽出
- 世界設定は現代日常系なら少なくてOK。ファンタジー/SFなら多めに
- 各話の要約は全エピソード分必要。各話2-3文で簡潔に
- 伏線は明確なものだけ。推測は不要
- セリフサンプルは各キャラクターから2-3個ずつ、個性が出ているものを選ぶ`;

@Injectable()
export class WorkStructureExtractorService {
  private readonly logger = new Logger(WorkStructureExtractorService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
    private sampleExtractor: SampleExtractorService,
  ) {}

  /**
   * Extract structure from work text and save to DB.
   * Single LLM call to extract characters, world settings, plot, etc.
   */
  async extractAndSave(workId: string, episodes: EpisodeInput[]): Promise<void> {
    if (episodes.length === 0) return;

    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) {
      this.logger.warn('No API key, skipping structure extraction');
      return;
    }

    // Build input text: episode titles + strategic samples
    const sorted = [...episodes].sort((a, b) => a.orderIndex - b.orderIndex);
    const samples = this.sampleExtractor.extract(sorted);

    // Also provide episode titles and short excerpts for summaries
    const episodeList = sorted.map((ep) => {
      const excerpt = ep.content.slice(0, 500).replace(/\n+/g, ' ');
      return `第${ep.orderIndex + 1}話「${ep.title}」: ${excerpt}...`;
    }).join('\n');

    // For longer works, provide more content from each episode
    const episodeDetails = sorted.map((ep) => {
      const content = ep.content.length > 1500
        ? ep.content.slice(0, 750) + '\n...\n' + ep.content.slice(-750)
        : ep.content;
      return `=== 第${ep.orderIndex + 1}話「${ep.title}」===\n${content}`;
    }).join('\n\n');

    // Limit total text to ~30K chars to stay within token limits
    const fullText = episodeDetails.length > 30000
      ? episodeDetails.slice(0, 30000) + '\n\n（以降省略）'
      : episodeDetails;

    const userPrompt = `以下の小説を分析して、構造データを抽出してください。

【エピソード一覧】
${episodeList}

【テキストサンプル: 冒頭】
${samples.opening}

【テキストサンプル: 結末】
${samples.ending}

【全文（抜粋）】
${fullText}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8192,
          system: EXTRACTION_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.content[0]?.text || '';

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in extraction response');

      const extracted: ExtractedStructure = JSON.parse(jsonMatch[0]);
      await this.saveToDb(workId, episodes, extracted);

      this.logger.log(
        `Extracted structure for work ${workId}: ` +
        `${extracted.characters.length} chars, ` +
        `${extracted.worldSettings.length} world settings, ` +
        `${extracted.episodeSummaries.length} summaries, ` +
        `${extracted.foreshadowings.length} foreshadowings`,
      );
    } catch (err: any) {
      this.logger.error(`Structure extraction failed for work ${workId}: ${err.message}`);
      // Don't throw — extraction failure shouldn't block scoring
    }
  }

  private async saveToDb(
    workId: string,
    episodes: EpisodeInput[],
    data: ExtractedStructure,
  ): Promise<void> {
    // Save characters
    if (data.characters?.length > 0) {
      const existingChars = await this.prisma.storyCharacter.findMany({
        where: { workId },
        select: { name: true },
      });
      const existingNames = new Set(existingChars.map((c) => c.name));

      const newChars = data.characters.filter((c) => !existingNames.has(c.name));
      if (newChars.length > 0) {
        await this.prisma.storyCharacter.createMany({
          data: newChars.map((c) => ({
            workId,
            name: c.name,
            role: c.role || '',
            gender: c.gender,
            personality: c.personality,
            speechStyle: c.speechStyle,
            firstPerson: c.firstPerson,
            description: c.description,
            aiSuggested: true,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Save world settings
    if (data.worldSettings?.length > 0) {
      const existing = await this.prisma.worldSetting.findMany({
        where: { workId },
        select: { name: true },
      });
      const existingNames = new Set(existing.map((w) => w.name));

      const newSettings = data.worldSettings.filter((w) => !existingNames.has(w.name));
      if (newSettings.length > 0) {
        await this.prisma.worldSetting.createMany({
          data: newSettings.map((w) => ({
            workId,
            category: w.category,
            name: w.name,
            description: w.description,
            isActive: true,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Save story arc
    if (data.storyArc) {
      const existing = await this.prisma.storyArc.findUnique({ where: { workId } });
      if (!existing) {
        await this.prisma.storyArc.create({
          data: {
            workId,
            premise: data.storyArc.premise,
            centralConflict: data.storyArc.centralConflict,
            themes: data.storyArc.themes,
          },
        });
      }
    }

    // Save episode analyses (summaries + emotional arcs)
    if (data.episodeSummaries?.length > 0) {
      for (const summary of data.episodeSummaries) {
        const episode = episodes.find((e) => e.orderIndex === summary.orderIndex);
        if (!episode) continue;

        const existing = await this.prisma.episodeAnalysis.findUnique({
          where: { episodeId: episode.id },
        });
        if (existing) continue;

        const endState = episode.content.slice(-300);
        await this.prisma.episodeAnalysis.create({
          data: {
            episodeId: episode.id,
            workId,
            summary: summary.summary,
            emotionalArc: summary.emotionalArc,
            narrativePOV: data.narrativePOV || null,
            endState,
            version: 1,
          },
        });
      }
    }

    // Save foreshadowings
    if (data.foreshadowings?.length > 0) {
      const existing = await this.prisma.foreshadowing.findMany({
        where: { workId },
        select: { description: true },
      });
      const existingDescs = new Set(existing.map((f) => f.description));

      const newForeshadowings = data.foreshadowings.filter(
        (f) => !existingDescs.has(f.description),
      );
      if (newForeshadowings.length > 0) {
        await this.prisma.foreshadowing.createMany({
          data: newForeshadowings.map((f) => ({
            workId,
            description: f.description,
            plantedIn: f.plantedIn,
            status: f.status || 'open',
          })),
          skipDuplicates: true,
        });
      }
    }

    // Save dialogue samples
    if (data.dialogueSamples?.length > 0) {
      const existing = await this.prisma.characterDialogueSample.findMany({
        where: { workId },
        select: { line: true },
      });
      const existingLines = new Set(existing.map((d) => d.line));

      const newSamples = data.dialogueSamples.filter(
        (d) => !existingLines.has(d.line),
      );
      if (newSamples.length > 0) {
        await this.prisma.characterDialogueSample.createMany({
          data: newSamples.map((d) => ({
            workId,
            characterName: d.character,
            line: d.line,
            episodeOrder: d.episodeOrder,
          })),
          skipDuplicates: true,
        });
      }
    }

    // A1: Programmatic dialogue extraction using regex for 「」patterns
    await this.extractDialogueProgrammatically(workId, episodes);
  }

  private async extractDialogueProgrammatically(
    workId: string,
    episodes: EpisodeInput[],
  ): Promise<void> {
    const existing = await this.prisma.characterDialogueSample.findMany({
      where: { workId },
      select: { line: true },
    });
    const existingLines = new Set(existing.map((d) => d.line));

    const newSamples: { workId: string; characterName: string; line: string; episodeOrder: number }[] = [];

    for (const episode of episodes) {
      const dialogueRegex = /「([^」]{5,100})」/g;
      let match: RegExpExecArray | null;
      while ((match = dialogueRegex.exec(episode.content)) !== null) {
        const line = match[1];
        if (existingLines.has(line)) continue;

        // Try to find speaker: look up to 50 chars before the 「
        const before = episode.content.slice(Math.max(0, match.index - 50), match.index);
        // Match a character name pattern: 2-8 Japanese characters followed by optional punctuation/whitespace
        const speakerMatch = before.match(/([^\s、。！？「」\n]{2,8})(?:は|が|の|も|、|\s)*$/);
        const characterName = speakerMatch ? speakerMatch[1] : '不明';

        existingLines.add(line);
        newSamples.push({
          workId,
          characterName,
          line,
          episodeOrder: episode.orderIndex,
        });

        // Limit to avoid storing too many samples
        if (newSamples.length >= 50) break;
      }
      if (newSamples.length >= 50) break;
    }

    if (newSamples.length > 0) {
      await this.prisma.characterDialogueSample.createMany({
        data: newSamples,
        skipDuplicates: true,
      });
      this.logger.log(`Programmatically extracted ${newSamples.length} dialogue samples for work ${workId}`);
    }
  }

  /**
   * B1: Batch analyze episodes in groups of 5 using Haiku.
   * Runs after extractAndSave so characters/world are already in DB.
   */
  async batchAnalyzeEpisodes(workId: string, episodes: EpisodeInput[]): Promise<void> {
    if (episodes.length === 0) return;

    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) {
      this.logger.warn('No API key, skipping batch episode analysis');
      return;
    }

    const sorted = [...episodes].sort((a, b) => a.orderIndex - b.orderIndex);
    const batchSize = 5;

    for (let i = 0; i < sorted.length; i += batchSize) {
      const batch = sorted.slice(i, i + batchSize);

      try {
        await this.analyzeBatch(workId, batch, apiKey);
      } catch (err: any) {
        this.logger.error(`Batch episode analysis failed for work ${workId}, batch starting at index ${i}: ${err.message}`);
        // Log and continue — don't throw
      }

      // B3: 1-second delay between batch calls to avoid rate limiting
      if (i + batchSize < sorted.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async analyzeBatch(
    workId: string,
    batch: EpisodeInput[],
    apiKey: string,
  ): Promise<void> {
    const batchSystemPrompt = `あなたは小説分析の専門家です。複数のエピソードを分析し、各エピソードのデータをJSON配列で返してください。

【最重要ルール】
- テキストに書かれている事実のみを抽出してください。推測・補完・行間の解釈は絶対にしないでください
- 「〇〇だろう」「〇〇と思われる」「おそらく〇〇」のような推測表現は禁止です
- 曖昧な場合は「不明」または「明示されていない」と記述してください
- summaryには必ず原文のキーフレーズを「」で引用して含めてください

以下のJSON配列形式で回答してください（JSON以外の文章は不要）:
[
  {
    "orderIndex": 0,
    "summary": "200-300文字の要約。原文のキーフレーズを「」で引用",
    "endState": "200-300文字のエピソード終了時点の状況",
    "emotionalArc": "感情の流れ（例: 期待→不安→決意）",
    "foreshadowings": [
      { "description": "伏線の内容", "status": "open/resolved" }
    ],
    "dialogueSamples": [
      { "character": "キャラクター名", "line": "印象的なセリフ（「」なしで記入）" }
    ]
  }
]`;

    const episodesText = batch.map((ep) => {
      const content = ep.content.slice(0, 2000);
      return `=== 第${ep.orderIndex + 1}話「${ep.title}」===\n${content}`;
    }).join('\n\n');

    const userPrompt = `以下のエピソードを分析してください:\n\n${episodesText}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: batchSystemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      this.logger.warn(`No JSON array in batch analysis response for work ${workId}`);
      return;
    }

    let batchResults: any[];
    try {
      batchResults = JSON.parse(jsonMatch[0]);
    } catch (err: any) {
      this.logger.error(`Failed to parse batch analysis JSON for work ${workId}: ${err.message}`);
      return;
    }

    if (!Array.isArray(batchResults)) return;

    // Save results
    for (const result of batchResults) {
      const episode = batch.find((ep) => ep.orderIndex === result.orderIndex);
      if (!episode) continue;

      try {
        // Upsert EpisodeAnalysis
        await this.prisma.episodeAnalysis.upsert({
          where: { episodeId: episode.id },
          update: {
            summary: result.summary || '',
            endState: result.endState || episode.content.slice(-300),
            emotionalArc: result.emotionalArc || '',
          },
          create: {
            episodeId: episode.id,
            workId,
            summary: result.summary || '',
            endState: result.endState || episode.content.slice(-300),
            emotionalArc: result.emotionalArc || '',
            narrativePOV: null,
            version: 1,
          },
        });

        // Save foreshadowings
        if (Array.isArray(result.foreshadowings) && result.foreshadowings.length > 0) {
          const existingFore = await this.prisma.foreshadowing.findMany({
            where: { workId },
            select: { description: true },
          });
          const existingDescs = new Set(existingFore.map((f) => f.description));

          const newFore = result.foreshadowings.filter(
            (f: any) => f.description && !existingDescs.has(f.description),
          );
          if (newFore.length > 0) {
            await this.prisma.foreshadowing.createMany({
              data: newFore.map((f: any) => ({
                workId,
                description: f.description,
                plantedIn: episode.orderIndex,
                status: f.status || 'open',
              })),
              skipDuplicates: true,
            });
          }
        }

        // Save dialogue samples
        if (Array.isArray(result.dialogueSamples) && result.dialogueSamples.length > 0) {
          const existingDlg = await this.prisma.characterDialogueSample.findMany({
            where: { workId },
            select: { line: true },
          });
          const existingLines = new Set(existingDlg.map((d) => d.line));

          const newSamples = result.dialogueSamples.filter(
            (d: any) => d.line && !existingLines.has(d.line),
          );
          if (newSamples.length > 0) {
            await this.prisma.characterDialogueSample.createMany({
              data: newSamples.map((d: any) => ({
                workId,
                characterName: d.character || '不明',
                line: d.line,
                episodeOrder: episode.orderIndex,
              })),
              skipDuplicates: true,
            });
          }
        }
      } catch (err: any) {
        this.logger.error(`Failed to save batch analysis for episode ${episode.id}: ${err.message}`);
        // Continue to next episode
      }
    }

    this.logger.log(`Batch analysis saved for work ${workId}, ${batchResults.length} episodes`);
  }
}

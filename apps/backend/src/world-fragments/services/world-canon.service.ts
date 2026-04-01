import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiSettingsService } from '../../ai-settings/ai-settings.service';

const SONNET = 'claude-sonnet-4-6';

@Injectable()
export class WorldCanonService {
  private readonly logger = new Logger(WorldCanonService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
  ) {}

  /**
   * 作品のWorldCanonを構築・更新する
   * 既存のEpisodeAnalysis, StoryCharacter, WorldSetting, StoryEventから集約
   */
  async buildCanon(workId: string, upToEpisode?: number) {
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
      select: {
        id: true,
        title: true,
        synopsis: true,
        settingEra: true,
        genre: true,
        completionStatus: true,
      },
    });
    if (!work) throw new NotFoundException('Work not found');

    // 対象エピソード数を決定
    const episodeCount = await this.prisma.episode.count({
      where: { workId, publishedAt: { not: null } },
    });
    const targetEpisode = upToEpisode ?? episodeCount;

    // 既存データを収集
    const [characters, worldSettings, episodeAnalyses, storyEvents, dialogueSamples] =
      await Promise.all([
        this.prisma.storyCharacter.findMany({
          where: { workId },
          include: {
            relationsFrom: true,
            relationsTo: true,
            dialogueSamples: { take: 5 },
          },
        }),
        this.prisma.worldSetting.findMany({
          where: { workId },
        }),
        this.prisma.episodeAnalysis.findMany({
          where: { workId },
          orderBy: { episode: { orderIndex: 'asc' } },
        }),
        this.prisma.storyEvent.findMany({
          where: { workId },
          orderBy: { timelinePosition: 'asc' },
        }),
        this.prisma.characterDialogueSample.findMany({
          where: { workId },
          orderBy: { episodeOrder: 'asc' },
        }),
      ]);

    // AIでCanonを構築
    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    const canonData = await this.generateCanonWithAI(apiKey, {
      work,
      characters,
      worldSettings,
      episodeAnalyses,
      storyEvents,
      dialogueSamples,
      targetEpisode,
    });

    // 既存Canonがあればバージョンアップ、なければ新規作成
    const existing = await this.prisma.worldCanon.findUnique({
      where: { workId },
    });

    if (existing) {
      return this.prisma.worldCanon.update({
        where: { workId },
        data: {
          canonVersion: existing.canonVersion + 1,
          upToEpisode: targetEpisode,
          ...canonData,
        },
      });
    }

    return this.prisma.worldCanon.create({
      data: {
        workId,
        upToEpisode: targetEpisode,
        ...canonData,
      },
    });
  }

  async getCanon(workId: string) {
    const canon = await this.prisma.worldCanon.findUnique({
      where: { workId },
    });
    if (!canon) throw new NotFoundException('WorldCanon not found. Build it first.');
    return canon;
  }

  private async generateCanonWithAI(
    apiKey: string,
    context: {
      work: any;
      characters: any[];
      worldSettings: any[];
      episodeAnalyses: any[];
      storyEvents: any[];
      dialogueSamples: any[];
      targetEpisode: number;
    },
  ) {
    const prompt = this.buildCanonPrompt(context);

    this.logger.log(`Building canon for work. Prompt length: ${prompt.length} chars`);

    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: SONNET,
          max_tokens: 16384,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(120_000), // 2分タイムアウト
      });
    } catch (fetchError: any) {
      this.logger.error(`Fetch to Anthropic failed: ${fetchError.message}`);
      throw new ServiceUnavailableException(`AI API connection failed: ${fetchError.message}`);
    }

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Canon generation failed (${response.status}): ${error}`);
      throw new ServiceUnavailableException('Failed to generate WorldCanon');
    }

    const result = await response.json() as any;
    const text = result.content?.[0]?.text;
    if (!text) throw new ServiceUnavailableException('Empty response from AI');

    // JSONブロックを抽出（複数のパターンに対応）
    let canonJson: string | null = null;

    // Pattern 1: ```json ... ```
    const jsonFenced = text.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
    if (jsonFenced) {
      canonJson = jsonFenced[1];
    }

    // Pattern 2: ``` ... ``` (言語指定なし)
    if (!canonJson) {
      const fenced = text.match(/```\s*\n?([\s\S]*?)\n?\s*```/);
      if (fenced) canonJson = fenced[1];
    }

    // Pattern 3: JSONが直接返された場合
    if (!canonJson) {
      const directJson = text.match(/\{[\s\S]*\}/);
      if (directJson) canonJson = directJson[0];
    }

    if (!canonJson) {
      this.logger.error(`Failed to extract JSON from response. Response text: ${text.slice(0, 500)}`);
      throw new ServiceUnavailableException('Failed to parse WorldCanon');
    }

    let canon: any;
    try {
      canon = JSON.parse(canonJson);
    } catch (e) {
      // トークン切れで途中で切れたJSONの場合、stop_reasonを確認
      const stopReason = result.stop_reason;
      this.logger.error(`JSON parse failed (stop_reason: ${stopReason}). JSON length: ${canonJson.length}. Last 200 chars: ${canonJson.slice(-200)}`);
      throw new ServiceUnavailableException(`Failed to parse WorldCanon JSON (stop_reason: ${stopReason})`);
    }

    return {
      characterProfiles: canon.characterProfiles,
      worldRules: canon.worldRules,
      timeline: canon.timeline,
      relationships: canon.relationships,
      establishedFacts: canon.establishedFacts,
      ambiguities: canon.ambiguities,
      narrativeStyle: canon.narrativeStyle ?? null,
    };
  }

  private buildCanonPrompt(context: {
    work: any;
    characters: any[];
    worldSettings: any[];
    episodeAnalyses: any[];
    storyEvents: any[];
    dialogueSamples: any[];
    targetEpisode: number;
  }): string {
    const { work, characters, worldSettings, episodeAnalyses, storyEvents, dialogueSamples, targetEpisode } = context;

    return `あなたは小説世界の「正典（Canon）」を構築する専門家です。
以下の作品データから、この小説世界の正典を構築してください。

## 作品情報
- タイトル: ${work.title}
- ジャンル: ${work.genre || '不明'}
- あらすじ: ${work.synopsis || 'なし'}
- 時代設定: ${work.settingEra || '不明'}
- 状態: ${work.completionStatus}
- 対象範囲: 第${targetEpisode}話まで

## 登場人物（${characters.length}名）
${characters.map((c) => `### ${c.name}
- 役割: ${c.role}
- 性格: ${c.personality || '不明'}
- 口調: ${c.speechStyle || '不明'}
- 一人称: ${c.firstPerson || '不明'}
- 動機: ${c.motivation || '不明'}
- 背景: ${c.background || '不明'}
- 現在の状態: ${c.currentState || '不明'}
- 台詞例: ${c.dialogueSamples?.map((d: any) => `「${d.line}」(${d.emotion || ''})`).join(' / ') || 'なし'}
`).join('\n')}

## 世界設定（${worldSettings.length}件）
${worldSettings.map((w) => `- [${w.category}] ${w.name}: ${w.description}`).join('\n')}

## エピソード分析（${episodeAnalyses.length}話分）
${episodeAnalyses.slice(0, 30).map((ea) => `- ${ea.summary || '(分析なし)'}`).join('\n')}

## 主要イベント（${storyEvents.length}件）
${storyEvents.slice(0, 50).map((e) => `- [${e.significance}] ${e.summary} (位置: ${e.timelinePosition})`).join('\n')}

## 指示
以下のJSON形式で正典を構築してください。

\`\`\`json
{
  "characterProfiles": [
    {
      "id": "キャラクターID",
      "name": "名前",
      "role": "主人公/ヒロイン/敵役/etc",
      "personality": "性格の詳細な記述",
      "speechStyle": "口調の特徴と一人称",
      "motivation": "根本的な動機",
      "beliefs": "信念・価値観",
      "secrets": "隠している事実（あれば）",
      "arc": "物語を通じた変化",
      "constraints": "このキャラが絶対にしないこと・言わないこと"
    }
  ],
  "worldRules": {
    "physics": "物理法則・魔法体系など",
    "society": "社会構造・政治体制",
    "geography": "地理・舞台",
    "technology": "技術水準",
    "culture": "文化・習慣",
    "constraints": "この世界で起こりえないこと"
  },
  "timeline": [
    {
      "position": 0.0,
      "event": "イベント概要",
      "significance": "key/normal/ambient",
      "characters": ["関与キャラ"],
      "consequences": "このイベントの結果・影響"
    }
  ],
  "relationships": [
    {
      "from": "キャラA",
      "to": "キャラB",
      "type": "関係の種類",
      "description": "関係の詳細",
      "evolution": "関係の変化の経緯"
    }
  ],
  "establishedFacts": [
    "変更不可能な確定事実（箇条書き）"
  ],
  "ambiguities": [
    "原作が意図的に曖昧にしている領域・まだ明かされていない謎"
  ],
  "narrativeStyle": {
    "pov": "視点（一人称/三人称限定/三人称神視点）",
    "tone": "全体的なトーン",
    "prose": "文体の特徴",
    "pacing": "テンポ感"
  }
}
\`\`\`

重要:
- 原作に書かれていることだけを正典とする。推測は ambiguities に入れる
- characterProfiles.constraints は最も重要。キャラが壊れることを防ぐ
- worldRules.constraints も同様。世界が壊れることを防ぐ
- 第${targetEpisode}話までの情報のみを使う`;
  }
}

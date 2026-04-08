import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiSettingsService } from '../../ai-settings/ai-settings.service';
import { EpisodeTextAnalyzerService } from './episode-text-analyzer.service';

const SONNET = 'claude-sonnet-4-6';

@Injectable()
export class WorldCanonService {
  private readonly logger = new Logger(WorldCanonService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
    private textAnalyzer: EpisodeTextAnalyzerService,
  ) {}

  /**
   * 作品のWorldCanonを構築・更新する
   * 既存のEpisodeAnalysis, StoryCharacter, WorldSetting, StoryEventから集約
   * 全ステップ: 1=per-episode analysis, 2=aggregation, 3=character synthesis, 4=world synthesis
   * Step 0（旧・大規模AI呼び出し）は廃止。全てが小さなステップで構築される。
   */
  async buildCanon(workId: string, upToEpisode?: number, steps?: number[]) {
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

    const episodeCount = await this.prisma.episode.count({
      where: { workId, publishedAt: { not: null } },
    });
    const targetEpisode = upToEpisode ?? episodeCount;

    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    const runSteps = steps ?? [1, 2, 3, 4];

    // Canonが存在しない場合は空のCanonを作成（Step 2以降で埋める）
    let existing = await this.prisma.worldCanon.findUnique({ where: { workId } });
    if (!existing) {
      existing = await this.prisma.worldCanon.create({
        data: {
          workId,
          upToEpisode: targetEpisode,
          characterProfiles: [],
          worldRules: {},
          timeline: [],
          relationships: [],
          establishedFacts: [],
          ambiguities: [],
        },
      });
      this.logger.log(`Created empty Canon for work ${workId}`);
    } else if (existing.upToEpisode < targetEpisode) {
      await this.prisma.worldCanon.update({
        where: { workId },
        data: { upToEpisode: targetEpisode },
      });
    }

    let canon = existing;

    try {
      // Step 1: Per-episode analysis（小さいAI呼び出し x N話）
      if (runSteps.includes(1)) {
        await this.updateBuildProgress(workId, 'Step 1: エピソード分析を開始...');
        await this.runStep1(workId);
      }

      // Step 2: Code aggregation（AI呼び出しなし）
      let timelines: Map<string, any> | null = null;
      if (runSteps.includes(2) || runSteps.includes(3) || runSteps.includes(4)) {
        await this.updateBuildProgress(workId, 'Step 2: データを集約中...');
        timelines = await this.runStep2(workId);
      }

      // Step 3: Per-character synthesis（小さいAI呼び出し x Nキャラ）
      if (runSteps.includes(3) && timelines) {
        await this.updateBuildProgress(workId, 'Step 3: キャラクター分析中...');
        canon = await this.runStep3(workId, timelines);
      }

      // Step 4: World synthesis（小さいAI呼び出し x 1回）
      if (runSteps.includes(4) && timelines) {
        await this.updateBuildProgress(workId, 'Step 4: 世界構造を合成中...');
        canon = await this.runStep4(workId, work, timelines);
      }

      // 完了
      await this.prisma.worldCanon.update({
        where: { workId },
        data: { buildStatus: 'completed', buildProgress: '構築完了', buildError: null },
      });

      return canon;
    } catch (error: any) {
      await this.prisma.worldCanon.update({
        where: { workId },
        data: { buildStatus: 'failed', buildError: error.message },
      }).catch(() => {});
      throw error;
    }
  }

  /** 構築進捗をDBに保存 */
  private async updateBuildProgress(workId: string, progress: string) {
    await this.prisma.worldCanon.update({
      where: { workId },
      data: { buildProgress: progress },
    }).catch(() => {});
    this.logger.log(`Build progress: ${progress}`);
  }

  async getCanon(workId: string) {
    const canon = await this.prisma.worldCanon.findUnique({
      where: { workId },
    });
    if (!canon) throw new NotFoundException('WorldCanon not found. Build it first.');
    return canon;
  }

  // ===== Step 1: Per-episode analysis =====

  /**
   * Step 1: 全公開エピソードのfragmentAnalysisを生成（キャッシュ済みはスキップ）
   */
  async runStep1(workId: string): Promise<{ analyzed: number; cached: number; total: number }> {
    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    // Get all published episodes
    const episodes = await this.prisma.episode.findMany({
      where: { workId, publishedAt: { not: null } },
      select: { id: true, title: true, content: true, orderIndex: true },
      orderBy: { orderIndex: 'asc' },
    });

    if (episodes.length === 0) {
      return { analyzed: 0, cached: 0, total: 0 };
    }

    // Get existing analyses with fragmentAnalysis
    const existingAnalyses = await this.prisma.episodeAnalysis.findMany({
      where: {
        workId,
        fragmentAnalysis: { not: Prisma.DbNull },
      },
      select: { episodeId: true },
    });
    const cachedSet = new Set(existingAnalyses.map((a) => a.episodeId));

    // Get character names from Canon (if available) or StoryCharacter table
    const canon = await this.prisma.worldCanon.findUnique({ where: { workId } });
    let characterNames: string[] = [];
    if (canon && canon.characterProfiles) {
      characterNames = (canon.characterProfiles as any[]).map((c: any) => c.name);
    } else {
      const chars = await this.prisma.storyCharacter.findMany({
        where: { workId },
        select: { name: true },
      });
      characterNames = chars.map((c) => c.name);
    }

    let analyzed = 0;
    const total = episodes.length;
    const cached = cachedSet.size;

    // Sequential processing to avoid rate limits
    for (const ep of episodes) {
      if (cachedSet.has(ep.id)) continue;

      const progressText = `Step 1: エピソード分析 ${analyzed + cached + 1}/${total}（${ep.title}）`;
      this.logger.log(progressText);
      await this.updateBuildProgress(workId, progressText);

      try {
        await this.analyzeEpisodeForFragments(
          ep.id,
          ep.content || '',
          ep.title || '',
          ep.orderIndex,
          characterNames,
        );
        analyzed++;
      } catch (e: any) {
        this.logger.warn(`Step 1: skipping episode ${ep.orderIndex} (${ep.title}): ${e.message}`);
      }
    }

    this.logger.log(`Step 1 complete: ${analyzed} analyzed, ${cached} cached, ${total} total`);
    return { analyzed, cached, total };
  }

  /**
   * Step 1 for a single episode (called from publish hook)
   */
  async runStep1ForEpisode(workId: string, episodeId: string): Promise<void> {
    // Only run if WorldCanon exists for this work
    const canon = await this.prisma.worldCanon.findUnique({ where: { workId } });
    if (!canon) return;

    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      select: { id: true, title: true, content: true, orderIndex: true },
    });
    if (!episode) return;

    // Check if already analyzed
    const existing = await this.prisma.episodeAnalysis.findFirst({
      where: { episodeId, fragmentAnalysis: { not: Prisma.DbNull } },
    });
    if (existing) return;

    const characterNames = (canon.characterProfiles as any[]).map((c: any) => c.name);

    this.logger.log(`Step 1 (single): analyzing episode ${episode.orderIndex} "${episode.title}" for work ${workId}`);

    await this.analyzeEpisodeForFragments(
      episode.id,
      episode.content || '',
      episode.title || '',
      episode.orderIndex,
      characterNames,
    );
  }

  /**
   * 単一エピソードをWorld Fragments用に分析し、fragmentAnalysisをEpisodeAnalysisに保存
   */
  async analyzeEpisodeForFragments(
    episodeId: string,
    content: string,
    title: string,
    orderIndex: number,
    characterNames: string[],
  ): Promise<void> {
    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    const prompt = `あなたは小説のエピソードを分析する専門家です。World Fragments（読了者向けの二次的な物語断片）生成のために、このエピソードの詳細な分析を行ってください。

## エピソード情報
- 第${orderIndex}話「${title}」

## 既知のキャラクター名
${characterNames.map((n) => `- ${n}`).join('\n')}

## エピソード本文
${content.length > 8000 ? content.slice(0, 8000) + '\n\n[...以下省略...]' : content}

## 分析指示
以下のJSON形式で分析結果を返してください。

\`\`\`json
{
  "characters": [
    {
      "name": "キャラクター名",
      "dialogueQuotes": ["このエピソードでの重要な台詞（原文のまま）"],
      "learns": ["このエピソードで新たに知ったこと・気づいたこと"],
      "reveals": ["このエピソードで他者に明かしたこと"],
      "hides": ["このエピソードで隠したこと・言わなかったこと"],
      "emotionalState": "このエピソード時点での感情状態",
      "definingMoments": ["このキャラクターを理解する上で重要な瞬間"]
    }
  ],
  "events": [
    {
      "description": "イベントの概要",
      "characters": ["関与キャラクター"],
      "significance": "key/normal/ambient"
    }
  ],
  "worldBuilding": [
    {
      "category": "カテゴリ（地理/社会/技術/文化等）",
      "detail": "明かされた世界設定の詳細"
    }
  ],
  "narrativeNotes": "語りの特徴、視点、伏線、雰囲気に関するメモ"
}
\`\`\`

重要:
- キャラクター名は既知のリストと一致させること（表記揺れに注意）
- dialogueQuotesは原文そのままを引用すること
- 登場しないキャラクターは含めないこと
- hides は「意図的に隠している」ものだけ。単に話題に出なかっただけのものは含めない`;

    // リトライ付きAPI呼び出し（最大2回）
    const maxAttempts = 2;
    let parsed: any = null;
    let lastError = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: SONNET,
            max_tokens: 8192,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: AbortSignal.timeout(180_000),
        });

        if (!response.ok) {
          const error = await response.text();
          lastError = `HTTP ${response.status}: ${error.slice(0, 200)}`;
          this.logger.warn(`Step 1 attempt ${attempt}/${maxAttempts} failed for episode ${episodeId}: ${lastError}`);
          continue;
        }

        const result = await response.json() as any;
        const text = result.content?.[0]?.text;
        if (!text) {
          lastError = 'Empty response from AI';
          this.logger.warn(`Step 1 attempt ${attempt}/${maxAttempts}: empty response for episode ${episodeId}`);
          continue;
        }

        parsed = this.extractJson(text);
        if (!parsed) {
          lastError = `JSON parse failed. stop_reason: ${result.stop_reason}. Last 300 chars: ${text.slice(-300)}`;
          this.logger.warn(`Step 1 attempt ${attempt}/${maxAttempts}: JSON parse failed for episode ${episodeId}. Response (first 300): ${text.slice(0, 300)}`);
          continue;
        }

        if (attempt > 1) {
          this.logger.log(`Step 1: episode ${episodeId} succeeded on attempt ${attempt}`);
        }
        break;
      } catch (fetchError: any) {
        lastError = fetchError.message;
        this.logger.warn(`Step 1 attempt ${attempt}/${maxAttempts} fetch error for episode ${episodeId}: ${fetchError.message}`);
        continue;
      }
    }

    if (!parsed) {
      this.logger.error(`Step 1: all ${maxAttempts} attempts failed for episode ${episodeId}. Last error: ${lastError}`);
      throw new ServiceUnavailableException('Failed to parse episode fragment analysis');
    }

    // Save to EpisodeAnalysis.fragmentAnalysis (upsert in case analysis row exists)
    const existingAnalysis = await this.prisma.episodeAnalysis.findFirst({
      where: { episodeId },
    });

    if (existingAnalysis) {
      await this.prisma.episodeAnalysis.update({
        where: { id: existingAnalysis.id },
        data: { fragmentAnalysis: parsed },
      });
    } else {
      // If no EpisodeAnalysis exists yet, we need workId
      const episode = await this.prisma.episode.findUnique({
        where: { id: episodeId },
        select: { workId: true },
      });
      if (episode) {
        await this.prisma.episodeAnalysis.create({
          data: {
            episodeId,
            workId: episode.workId,
            summary: '',
            fragmentAnalysis: parsed,
          },
        });
      }
    }
  }

  // ===== Step 2: Aggregation (no AI) =====

  /**
   * Step 2: 全エピソードのfragmentAnalysisからキャラクタータイムラインを集約
   */
  async runStep2(workId: string): Promise<Map<string, any>> {
    const analyses = await this.prisma.episodeAnalysis.findMany({
      where: {
        workId,
        fragmentAnalysis: { not: Prisma.DbNull },
      },
      include: {
        episode: { select: { orderIndex: true, title: true } },
      },
      orderBy: { episode: { orderIndex: 'asc' } },
    });

    const timelines = new Map<string, any>();

    for (const analysis of analyses) {
      const fa = analysis.fragmentAnalysis as any;
      if (!fa || !fa.characters) continue;

      const episodeInfo = {
        orderIndex: analysis.episode.orderIndex,
        title: analysis.episode.title,
      };

      for (const charData of fa.characters) {
        const name = charData.name;
        if (!timelines.has(name)) {
          timelines.set(name, {
            name,
            episodes: [],
          });
        }

        timelines.get(name).episodes.push({
          ...episodeInfo,
          dialogueQuotes: charData.dialogueQuotes || [],
          learns: charData.learns || [],
          reveals: charData.reveals || [],
          hides: charData.hides || [],
          emotionalState: charData.emotionalState || '',
          definingMoments: charData.definingMoments || [],
        });
      }
    }

    // canonicalDialogueを構築: 各キャラの全話にわたる台詞一覧
    for (const [name, timeline] of timelines.entries()) {
      const canonicalDialogue: { episode: number; line: string; context: string }[] = [];
      for (const ep of timeline.episodes) {
        for (const quote of ep.dialogueQuotes || []) {
          canonicalDialogue.push({
            episode: ep.orderIndex,
            line: typeof quote === 'string' ? quote : quote.line || quote,
            context: typeof quote === 'string' ? `第${ep.orderIndex}話「${ep.title}」` : (quote.context || `第${ep.orderIndex}話「${ep.title}」`),
          });
        }
      }
      timeline.canonicalDialogue = canonicalDialogue;
    }

    // Replace fragmentAnalysis-based canonicalDialogue with code-extracted version
    await this.buildCanonicalDialogueFromText(workId, timelines);

    this.logger.log(`Step 2 complete: ${timelines.size} character timelines built from ${analyses.length} episodes`);
    return timelines;
  }

  /**
   * Build canonical dialogue from episode text using code-only extraction.
   * Replaces AI-extracted dialogue with complete code-extracted dialogue.
   * Writes the result into the timelines map (modifying in place) so Step 3 picks it up.
   */
  async buildCanonicalDialogueFromText(
    workId: string,
    timelines: Map<string, any>,
  ): Promise<void> {
    // Fetch all published episodes
    const episodes = await this.prisma.episode.findMany({
      where: { workId, publishedAt: { not: null } },
      select: { id: true, title: true, content: true, orderIndex: true },
      orderBy: { orderIndex: 'asc' },
    });

    if (episodes.length === 0) return;

    // Get character names from Canon (if available) or StoryCharacter table
    const canon = await this.prisma.worldCanon.findUnique({ where: { workId } });
    let characterNames: string[] = [];
    if (canon && canon.characterProfiles) {
      characterNames = (canon.characterProfiles as any[]).map((c: any) => c.name);
    } else {
      const chars = await this.prisma.storyCharacter.findMany({
        where: { workId },
        select: { name: true },
      });
      characterNames = chars.map((c) => c.name);
    }

    if (characterNames.length === 0) return;

    // Extract dialogue from all episodes using code-only analysis
    const codeExtractedDialogue = new Map<string, Array<{ episode: number; line: string; context: string }>>();

    for (const ep of episodes) {
      if (!ep.content) continue;

      const dialogueByChar = this.textAnalyzer.extractDialogueByCharacter(ep.content, characterNames);

      for (const [charName, dialogues] of dialogueByChar) {
        if (!codeExtractedDialogue.has(charName)) {
          codeExtractedDialogue.set(charName, []);
        }
        for (const d of dialogues) {
          codeExtractedDialogue.get(charName)!.push({
            episode: ep.orderIndex,
            line: d.line,
            context: d.context,
          });
        }
      }
    }

    // Replace canonicalDialogue in each timeline entry with code-extracted version
    for (const [name, timeline] of timelines.entries()) {
      const extracted = codeExtractedDialogue.get(name);
      if (extracted && extracted.length > 0) {
        timeline.canonicalDialogue = extracted;
        timeline.codeExtractedDialogue = extracted;
      }
    }

    // Also store code-extracted dialogue for characters that appear in text
    // but may not have been picked up by AI analysis (not in timelines yet)
    for (const [name, dialogues] of codeExtractedDialogue) {
      if (!timelines.has(name) && dialogues.length > 0) {
        timelines.set(name, {
          name,
          episodes: [],
          canonicalDialogue: dialogues,
          codeExtractedDialogue: dialogues,
        });
      }
    }

    this.logger.log(
      `buildCanonicalDialogueFromText: extracted dialogue for ${codeExtractedDialogue.size} characters from ${episodes.length} episodes`,
    );
  }

  // ===== Step 3: Per-character synthesis =====

  /**
   * Step 3: 各キャラクターのタイムラインから深層プロファイルを合成
   */
  async runStep3(workId: string, timelines: Map<string, any>) {
    const canon = await this.getCanon(workId);
    let profiles = canon.characterProfiles as any[];

    // characterProfilesが空の場合、StoryCharacterから初期プロファイルを構築
    if (!profiles || profiles.length === 0) {
      const storyChars = await this.prisma.storyCharacter.findMany({
        where: { workId },
        select: {
          id: true, name: true, role: true, personality: true,
          speechStyle: true, firstPerson: true, motivation: true,
          background: true, arc: true, currentState: true,
        },
      });
      profiles = storyChars.map((c: any) => ({
        id: c.id,
        name: c.name,
        role: c.role || '',
        personality: c.personality || '',
        speechStyle: c.speechStyle || '',
        motivation: c.motivation || '',
        constraints: '',
      }));
      this.logger.log(`Step 3: initialized ${profiles.length} character profiles from StoryCharacter`);
    }

    const enrichedProfiles = [...profiles];

    for (let i = 0; i < enrichedProfiles.length; i++) {
      const profile = enrichedProfiles[i];
      // キャラクター名のマッチング（完全一致 → 部分一致）
      let timeline = timelines.get(profile.name);
      if (!timeline) {
        // 部分一致を試みる（「先生（せんせい）」→「先生」等）
        for (const [key, value] of timelines.entries()) {
          if (profile.name.includes(key) || key.includes(profile.name)) {
            timeline = value;
            break;
          }
        }
      }
      if (!timeline || timeline.episodes.length === 0) continue;

      this.logger.log(`Step 3: synthesizing character ${i + 1}/${enrichedProfiles.length} (${profile.name})`);

      const enrichment = await this.synthesizeCharacterProfile(profile, timeline);
      if (enrichment) {
        enrichedProfiles[i] = {
          ...profile,
          trueNature: enrichment.trueNature,
          knowledge: enrichment.knowledge,
          keyMoments: enrichment.keyMoments,
          voiceNotes: enrichment.voiceNotes,
          constraints: enrichment.updatedConstraints || profile.constraints,
          canonicalDialogue: timeline.canonicalDialogue || [],
        };
      } else {
        // enrichmentが失敗しても、canonicalDialogueは追加する
        enrichedProfiles[i] = {
          ...profile,
          canonicalDialogue: timeline.canonicalDialogue || [],
        };
      }
    }

    // Update Canon with enriched profiles
    const updated = await this.prisma.worldCanon.update({
      where: { workId },
      data: {
        characterProfiles: enrichedProfiles,
        canonVersion: canon.canonVersion + 1,
      },
    });

    this.logger.log(`Step 3 complete: enriched ${enrichedProfiles.length} character profiles (Canon v${updated.canonVersion})`);
    return updated;
  }

  // ===== Step 4: World synthesis =====

  /**
   * Step 4: タイムラインデータから世界の構造を合成（小さいAI呼び出し1回）
   * worldRules, timeline, relationships, establishedFacts, ambiguities, narrativeStyle, layers
   */
  async runStep4(workId: string, work: any, timelines: Map<string, any>) {
    const canon = await this.getCanon(workId);
    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    // Step 2で集約されたデータからサマリーを構築
    const characterSummaries = [...timelines.entries()].map(([name, tl]) => {
      const episodeCount = tl.episodes?.length || 0;
      const keyDialogue = (tl.canonicalDialogue || []).slice(0, 5).map((d: any) => d.line).join(' / ');
      return `${name}（${episodeCount}話に登場）: ${keyDialogue}`;
    }).join('\n');

    // StoryCharacterの基本情報
    const storyChars = await this.prisma.storyCharacter.findMany({
      where: { workId },
      select: { name: true, role: true, personality: true, motivation: true, background: true },
    });

    // WorldSettingデータ
    const worldSettings = await this.prisma.worldSetting.findMany({
      where: { workId },
    });

    // fragmentAnalysisからイベントとworldBuildingを集約
    const analyses = await this.prisma.episodeAnalysis.findMany({
      where: { workId, fragmentAnalysis: { not: Prisma.DbNull } },
      include: { episode: { select: { orderIndex: true, title: true } } },
      orderBy: { episode: { orderIndex: 'asc' } },
    });

    const events: string[] = [];
    const worldBuilding: string[] = [];
    for (const a of analyses) {
      const fa = a.fragmentAnalysis as any;
      if (fa?.events) {
        for (const e of fa.events) {
          events.push(`第${a.episode.orderIndex}話: ${e.description || e} (${e.significance || 'normal'})`);
        }
      }
      if (fa?.worldBuilding) {
        for (const wb of fa.worldBuilding) {
          worldBuilding.push(typeof wb === 'string' ? wb : wb.detail || JSON.stringify(wb));
        }
      }
    }

    const prompt = `あなたは小説世界の構造を分析する専門家です。
以下の作品データから、世界の構造を構築してください。

## 作品情報
- タイトル: ${work.title}
- ジャンル: ${work.genre || '不明'}
- あらすじ: ${work.synopsis || 'なし'}
- 時代設定: ${work.settingEra || '不明'}
- 状態: ${work.completionStatus}

## 登場人物
${storyChars.map((c: any) => `- ${c.name}（${c.role || ''}）: ${c.personality || ''}`).join('\n')}

## 世界設定
${worldSettings.map((w: any) => `- [${w.category}] ${w.name}: ${w.description}`).join('\n') || 'なし'}

## 主要イベント（エピソードごと）
${events.slice(0, 40).join('\n') || 'なし'}

## 世界構築の詳細
${worldBuilding.slice(0, 20).join('\n') || 'なし'}

## キャラクター出演サマリー
${characterSummaries}

## 出力（JSON）
\`\`\`json
{
  "worldRules": {
    "physics": "物理法則・魔法体系",
    "society": "社会構造",
    "geography": "地理・舞台",
    "technology": "技術水準",
    "culture": "文化・習慣",
    "constraints": "この世界で起こりえないこと"
  },
  "timeline": [
    { "position": 0.0, "event": "概要", "significance": "key/normal", "characters": ["名前"], "consequences": "影響" }
  ],
  "relationships": [
    { "from": "A", "to": "B", "type": "関係", "description": "詳細", "evolution": "変化" }
  ],
  "establishedFacts": ["確定事実"],
  "ambiguities": ["意図的に曖昧な領域"],
  "narrativeStyle": {
    "pov": "視点",
    "tone": "トーン",
    "prose": "文体",
    "pacing": "テンポ"
  },
  "worldLayers": [
    { "id": "層ID", "name": "名前", "description": "説明", "locations": [], "characters": [], "rules": "ルール", "certainty": "real/presented_as_real/fictional_within_story/dream/ambiguous" }
  ],
  "layerInteractions": [
    { "from": "層ID", "to": "層ID", "method": "方法", "constraints": "制約" }
  ],
  "layerAmbiguities": ["層に関する曖昧さ"]
}
\`\`\`

重要:
- 原作に書かれていることだけを正典とする。推測はambiguitiesに入れる
- 層が1つしかない作品ではworldLayersに1つだけ入れる（certainty: "real"）
- timelineのpositionは0.0〜1.0で正規化する`;

    this.logger.log(`Step 4: synthesizing world structure for ${work.title}`);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: SONNET,
          max_tokens: 8192,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(180_000),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Step 4 failed (${response.status}): ${error}`);
        return canon;
      }

      const result = await response.json() as any;
      const text = result.content?.[0]?.text;
      if (!text) {
        this.logger.error('Step 4: empty response');
        return canon;
      }

      const parsed = this.extractJson(text);
      if (!parsed) {
        this.logger.error(`Step 4: JSON parse failed. Response: ${text.slice(0, 500)}`);
        return canon;
      }

      const updated = await this.prisma.worldCanon.update({
        where: { workId },
        data: {
          worldRules: parsed.worldRules || canon.worldRules,
          timeline: parsed.timeline || canon.timeline,
          relationships: parsed.relationships || canon.relationships,
          establishedFacts: parsed.establishedFacts || canon.establishedFacts,
          ambiguities: parsed.ambiguities || canon.ambiguities,
          narrativeStyle: parsed.narrativeStyle || canon.narrativeStyle,
          worldLayers: parsed.worldLayers || canon.worldLayers,
          layerInteractions: parsed.layerInteractions || canon.layerInteractions,
          layerAmbiguities: parsed.layerAmbiguities || canon.layerAmbiguities,
          canonVersion: canon.canonVersion + 1,
        },
      });

      this.logger.log(`Step 4 complete: world structure synthesized (Canon v${updated.canonVersion})`);
      return updated;
    } catch (e: any) {
      this.logger.error(`Step 4 failed: ${e.message}`);
      return canon;
    }
  }

  /**
   * 単一キャラクターの基本プロファイル+タイムラインから深層プロファイルを合成
   */
  async synthesizeCharacterProfile(
    basicProfile: any,
    timeline: any,
  ): Promise<any | null> {
    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    const prompt = `あなたは小説を読了した読者として、キャラクターの「真の姿」を分析する専門家です。
以下のキャラクターの基本プロファイルと、全エピソードを通じたタイムラインデータから、深層プロファイルを構築してください。

## 基本プロファイル
${JSON.stringify({
  name: basicProfile.name,
  role: basicProfile.role,
  personality: basicProfile.personality,
  speechStyle: basicProfile.speechStyle,
  motivation: basicProfile.motivation,
  secrets: basicProfile.secrets,
  constraints: basicProfile.constraints,
}, null, 2)}

## エピソードごとのタイムライン
${JSON.stringify(timeline.episodes, null, 2)}

## 指示
このキャラクターについて、物語全体を通読した上で以下を分析してください。
特に「初回読了時には気づかないが、読み返すと見えてくること」を重視してください。

\`\`\`json
{
  "trueNature": "物語全体を通じて明らかになるこのキャラクターの真の姿。表面的な設定ではなく、読了後に見える本質",
  "knowledge": {
    "knows": ["このキャラクターが知っていること（他のキャラクターが知らないことを含む）"],
    "doesNotKnow": ["このキャラクターが知らないこと・気づいていないこと"],
    "hidesFromOthers": ["知っているが意図的に隠していること、言わないこと"],
    "sensesButCannotArticulate": ["言語化できないが感じていること"]
  },
  "keyMoments": [
    {
      "episode": "第N話",
      "moment": "このキャラクターを理解する上で最も重要な瞬間の描写",
      "significance": "なぜこの瞬間が重要か（読了者視点）"
    }
  ],
  "voiceNotes": "このキャラクターの視点でFragmentを書くとき、絶対に守るべき内面の真実",
  "updatedConstraints": "現在のconstraintsを読了者視点で補強・修正したもの"
}
\`\`\`

重要:
- 各情報は物語のテキストに基づく。推測ではなく、テキストから読み取れる根拠を持つこと
- dialogueQuotesの台詞の真意を分析すること
- 物語が意図的に曖昧にしていることは、曖昧なまま記述すること（断定しない）`;

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
          max_tokens: 8192,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(180_000),
      });
    } catch (fetchError: any) {
      this.logger.error(`Step 3 synthesis failed for ${basicProfile.name}: ${fetchError.message}`);
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Step 3 synthesis failed for ${basicProfile.name} (${response.status}): ${error}`);
      return null;
    }

    const result = await response.json() as any;
    const text = result.content?.[0]?.text;
    if (!text) return null;

    // stop_reasonがend_turnでない場合（トークン切れ）はログ出力
    if (result.stop_reason !== 'end_turn') {
      this.logger.warn(`Step 3: response for ${basicProfile.name} may be truncated (stop_reason: ${result.stop_reason})`);
    }

    const parsed = this.extractJson(text);
    if (!parsed) {
      this.logger.error(`Step 3: failed to parse JSON for ${basicProfile.name}. stop_reason: ${result.stop_reason}. Response (last 300): ${text.slice(-300)}`);
      return null;
    }

    return parsed;
  }

  /**
   * Canonのキャラクタープロファイルをエピソード本文から深化させる
   * 3-step pipeline に委譲
   */
  async enrichCharacterProfiles(workId: string) {
    const step1Result = await this.runStep1(workId);
    this.logger.log(`enrichCharacterProfiles Step 1: ${JSON.stringify(step1Result)}`);

    const timelines = await this.runStep2(workId);
    const updated = await this.runStep3(workId, timelines);
    return updated;
  }

  /** 願いの種をランダムに取得（プールから） */
  async getWishSeeds(workId: string, count = 5) {
    const canon = await this.getCanon(workId);
    const seeds = (canon.wishSeeds as any[]) || [];
    if (seeds.length === 0) return [];

    // シャッフルしてcount個返す
    const shuffled = [...seeds].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /** 願いの種プールを生成してCanonに保存 */
  async generateWishSeeds(workId: string) {
    const canon = await this.getCanon(workId);
    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    const existingSeeds = (canon.wishSeeds as any[]) || [];

    const prompt = `あなたは小説の読者体験の設計者です。
以下の作品の正典（Canon）から、読者が「見たい」と思うであろう世界の断片を50個提案してください。

## 作品の正典
### キャラクター
${JSON.stringify((canon.characterProfiles as any[]).map((c: any) => ({ name: c.name, role: c.role, personality: c.personality, motivation: c.motivation, secrets: c.secrets })), null, 2)}

### タイムライン（主要イベント）
${JSON.stringify((canon.timeline as any[]).filter((t: any) => t.significance === 'key').map((t: any) => ({ event: t.event, characters: t.characters })), null, 2)}

### 関係性
${JSON.stringify(canon.relationships, null, 2)}

### 確定事実（これらに矛盾する種を生成しないこと）
${JSON.stringify(canon.establishedFacts, null, 2)}

### 曖昧な領域
${JSON.stringify(canon.ambiguities, null, 2)}

## 種類（wishType）
- PERSPECTIVE: 既存シーンを別のキャラクターの視点で
- SIDE_STORY: 本編の裏で起きていたこと
- MOMENT: 本編に描かれなかった一瞬
- WHAT_IF: もし違う選択をしていたら（結果は変わらない範囲）

## ルール
- 読者が思わずタップしたくなる、具体的で魅力的な一文にする
- 長すぎない（15〜30文字程度）
- キャラクター名を含める
- 4種類をバランスよく混ぜる（各wishTypeに最低10個）
- 全てのメインキャラクターを最低3回は扱う
- 同じシーン・同じ切り口を2回以上扱わない
- タイムラインの前半・中盤・後半から均等に選ぶ
- ネタバレを含まない表現にする（読了者向けだが、直接的すぎる表現は避ける）
- 確定事実と矛盾する種を絶対に生成しない（キャラクターの役割・関係性を正確に反映する）
${existingSeeds.length > 0 ? `\n## 既存の種（これらと重複しない新しい種を生成すること）\n${existingSeeds.map((s: any) => `- ${s.wish}`).join('\n')}` : ''}

## 出力形式（JSON）
\`\`\`json
[
  { "wish": "願いの一文", "wishType": "PERSPECTIVE", "label": "別の視点" },
  ...
]
\`\`\``;

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
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(180_000),
      });
    } catch (fetchError: any) {
      this.logger.error(`Wish seeds generation fetch failed: ${fetchError.message}`);
      throw new ServiceUnavailableException('Failed to generate wish seeds');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException('Failed to generate wish seeds');
    }

    const result = await response.json() as any;
    const text = result.content?.[0]?.text || '';

    // JSONを抽出
    let seeds: any[] = [];
    const jsonFenced = text.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
    if (jsonFenced) {
      try { seeds = JSON.parse(jsonFenced[1]); } catch {}
    }
    if (seeds.length === 0) {
      const directJson = text.match(/\[[\s\S]*\]/);
      if (directJson) {
        try { seeds = JSON.parse(directJson[0]); } catch {}
      }
    }

    if (seeds.length === 0) {
      throw new ServiceUnavailableException('Failed to parse wish seeds');
    }

    // 既存の種に追加（補充モード）
    const allSeeds = [...existingSeeds, ...seeds];
    await this.prisma.worldCanon.update({
      where: { workId },
      data: { wishSeeds: allSeeds },
    });

    this.logger.log(`Generated ${seeds.length} wish seeds (total: ${allSeeds.length}) for work ${workId}`);
    return seeds;
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
        signal: AbortSignal.timeout(180_000), // 2分タイムアウト
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
      worldLayers: canon.worldLayers ?? null,
      layerInteractions: canon.layerInteractions ?? null,
      layerAmbiguities: canon.layerAmbiguities ?? null,
    };
  }

  /** AIレスポンスからJSONを抽出（複数パターン対応） */
  /** JSONテキストをクリーンアップしてからパース */
  private cleanAndParseJson(raw: string): any | null {
    // まず直接パース
    try { return JSON.parse(raw); } catch {}

    // クリーンアップして再試行
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1'); // 末尾カンマ除去
    cleaned = cleaned.replace(/\/\/[^\n]*/g, ''); // 単行コメント除去
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ''); // 複数行コメント除去
    try { return JSON.parse(cleaned); } catch {}

    return null;
  }

  private extractJson(text: string): any | null {
    // Pattern 1: ```json ... ```
    const jsonFenced = text.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
    if (jsonFenced) {
      const result = this.cleanAndParseJson(jsonFenced[1]);
      if (result) return result;
    }

    // Pattern 2: ``` ... ```
    const fenced = text.match(/```\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenced) {
      const result = this.cleanAndParseJson(fenced[1]);
      if (result) return result;
    }

    // Pattern 3: 直接JSON（オブジェクト）
    const directObj = text.match(/\{[\s\S]*\}/);
    if (directObj) {
      const result = this.cleanAndParseJson(directObj[0]);
      if (result) return result;
    }

    // Pattern 4: 直接JSON（配列）
    const directArr = text.match(/\[[\s\S]*\]/);
    if (directArr) {
      const result = this.cleanAndParseJson(directArr[0]);
      if (result) return result;
    }

    return null;
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
  },
  "worldLayers": [
    {
      "id": "層の識別子",
      "name": "層の名前",
      "description": "この層がどういう世界か",
      "locations": ["この層に属する場所"],
      "characters": ["この層に属するキャラクター名"],
      "rules": "この層固有のルール",
      "certainty": "real / presented_as_real / fictional_within_story / dream / memory / ambiguous"
    }
  ],
  "layerInteractions": [
    {
      "from": "層ID",
      "to": "層ID",
      "method": "層間の移動・交流手段",
      "constraints": "層をまたぐ際の制約"
    }
  ],
  "layerAmbiguities": [
    "層構造に関して原作が意図的に曖昧にしていること"
  ]
}
\`\`\`

重要:
- 原作に書かれていることだけを正典とする。推測は ambiguities に入れる
- characterProfiles.constraints は最も重要。キャラが壊れることを防ぐ
- worldRules.constraints も同様。世界が壊れることを防ぐ
- 第${targetEpisode}話までの情報のみを使う

層構造の分析について:
- 物語に複数の世界・現実・時間軸・虚構内虚構がある場合、それぞれをworldLayersとして定義する
- 層が1つしかない作品ではworldLayersに1つだけ入れる（"certainty": "real"）
- キャラクターがどの層に属するか不明な場合、certaintyを"ambiguous"とし、layerAmbiguitiesに記載する
- 劇中劇、夢、回想、異世界、メタフィクションなど、原作に現れる全ての層を検出する
- 層の存在自体が曖昧な場合（現実だと思っていた世界が実は虚構かもしれない等）、その曖昧さをlayerAmbiguitiesに明記する`;
  }
}

import { Injectable, Logger, NotFoundException, BadRequestException, ServiceUnavailableException, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiSettingsService } from '../../ai-settings/ai-settings.service';
import { CreditService } from '../../billing/credit.service';
import { WorldCanonService } from './world-canon.service';
import { WishTypeDto } from '../dto/create-wish.dto';

const OPUS = 'claude-opus-4-6';
const SONNET = 'claude-sonnet-4-6';

// wishTypeごとのクレジットコスト（全Opus生成、粗利率50%以上）
const CREDIT_COSTS: Record<WishTypeDto, number> = {
  [WishTypeDto.MOMENT]: 25,
  [WishTypeDto.PERSPECTIVE]: 30,
  [WishTypeDto.SIDE_STORY]: 35,
  [WishTypeDto.WHAT_IF]: 40,
};

const CONSTRAINT_CHECK_COST = 1; // 制約チェック分（リジェクトでも返金しない）
const RATE_LIMIT_PER_HOUR = 5;

@Injectable()
export class FragmentGeneratorService {
  private readonly logger = new Logger(FragmentGeneratorService.name);
  private lastTokenUsage: {
    constraintCheck?: { input_tokens: number; output_tokens: number };
    generation?: { input_tokens: number; output_tokens: number };
    evaluation?: { input_tokens: number; output_tokens: number };
  } = {};

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
    private creditService: CreditService,
    private canonService: WorldCanonService,
  ) {}

  /**
   * wishを受け付けてPENDINGのFragmentを即座に返す。
   * 実際の生成処理(processFragment)は非同期で実行される。
   */
  async initiateFragment(
    userId: string,
    workId: string,
    wish: string,
    wishType: WishTypeDto,
    upToEpisode: number,
    options: {
      anchorEpisodeId?: string;
      anchorEventId?: string;
      timelinePosition?: number;
    } = {},
  ) {
    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) throw new ServiceUnavailableException('AI API key is not configured');

    // レートリミット: 1時間あたりの願い回数チェック
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.prisma.worldFragment.count({
      where: {
        requesterId: userId,
        createdAt: { gte: oneHourAgo },
      },
    });
    if (recentCount >= RATE_LIMIT_PER_HOUR) {
      throw new HttpException(
        '願いの回数が上限に達しました。しばらく時間をおいてからお試しください。',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // WorldCanonの存在確認
    const canon = await this.canonService.getCanon(workId);

    // scope内チェック
    if (upToEpisode > canon.upToEpisode) {
      throw new BadRequestException(
        `Canon is built up to episode ${canon.upToEpisode}. Requested scope: ${upToEpisode}`,
      );
    }

    const cost = CREDIT_COSTS[wishType];

    // Fragment作成（PENDING）
    const fragment = await this.prisma.worldFragment.create({
      data: {
        workId,
        requesterId: userId,
        wish,
        wishType,
        scope: { upToEpisode },
        anchorEpisodeId: options.anchorEpisodeId,
        anchorEventId: options.anchorEventId,
        timelinePosition: options.timelinePosition,
        creditCost: cost,
        status: 'PENDING',
      },
    });

    // 非同期で生成処理を開始（awaitしない）
    setImmediate(() => {
      this.processFragment(fragment.id).catch((err) => {
        this.logger.error(`Async processFragment failed for ${fragment.id}: ${err}`);
      });
    });

    return fragment;
  }

  /**
   * Fragment生成の全パイプライン（非同期実行）
   * 制約チェック → クレジット消費 → 生成 → 自己評価 → 保存
   * エラー時はステータスをFAILEDに設定する
   */
  async processFragment(fragmentId: string) {
    this.lastTokenUsage = {};
    const fragment = await this.prisma.worldFragment.findUnique({
      where: { id: fragmentId },
    });
    if (!fragment) {
      this.logger.error(`processFragment: fragment ${fragmentId} not found`);
      return;
    }

    const apiKey = await this.aiSettings.getApiKey();
    if (!apiKey) {
      await this.prisma.worldFragment.update({
        where: { id: fragmentId },
        data: { status: 'FAILED' },
      });
      this.logger.error(`processFragment: AI API key is not configured`);
      return;
    }

    const userId = fragment.requesterId;
    const workId = fragment.workId;
    const wish = fragment.wish;
    const wishType = fragment.wishType as WishTypeDto;
    const scope = fragment.scope as { upToEpisode: number };
    const cost = fragment.creditCost;

    try {
      // WorldCanonを取得
      const canon = await this.canonService.getCanon(workId);

      // Phase 1: 制約チェック分のクレジットを先に消費（返金しない）
      await this.creditService.consumeCredits(
        userId,
        CONSTRAINT_CHECK_COST,
        'world_fragment_check',
        SONNET,
      );

      // 制約チェック（Sonnet — 高速）
      await this.prisma.worldFragment.update({
        where: { id: fragmentId },
        data: { status: 'CHECKING' },
      });

      const constraintResult = await this.checkConstraints(apiKey, canon, wish, wishType);

      if (!constraintResult.allowed) {
        await this.prisma.worldFragment.update({
          where: { id: fragmentId },
          data: {
            status: 'REJECTED',
            rejectionReason: constraintResult.reason,
            creditCost: CONSTRAINT_CHECK_COST,
          },
        });
        return;
      }

      // Phase 2: 残りのクレジットを消費（生成分）
      await this.creditService.consumeCredits(
        userId,
        cost - CONSTRAINT_CHECK_COST,
        'world_fragment',
        OPUS,
      );

      // Phase 2: Fragment生成（Opus — 高品質）
      await this.prisma.worldFragment.update({
        where: { id: fragmentId },
        data: { status: 'GENERATING' },
      });

      const work = await this.prisma.work.findUnique({
        where: { id: workId },
        select: { title: true, genre: true, settingEra: true },
      });

      // 原作テキスト参照: wishの内容から関連エピソードを自動特定・取得（DB-only）
      const anchorContext = await this.resolveAnchorContext(
        workId, wish, wishType, canon, fragment.anchorEpisodeId, scope.upToEpisode,
      );

      const generatedContent = await this.generateContent(
        apiKey,
        canon,
        work,
        wish,
        wishType,
        anchorContext,
        constraintResult.guidelines,
      );

      // Phase 3: 自己評価（Sonnet）
      await this.prisma.worldFragment.update({
        where: { id: fragmentId },
        data: { status: 'EVALUATING' },
      });

      const qualityScore = await this.evaluateFragment(
        apiKey,
        canon,
        wish,
        wishType,
        generatedContent,
      );

      // 最終更新
      const wordCount = generatedContent.length;
      const estimatedReadTime = Math.ceil(wordCount / 500); // 500文字/分

      await this.prisma.worldFragment.update({
        where: { id: fragmentId },
        data: {
          content: generatedContent,
          contentMeta: { wordCount, estimatedReadTime },
          qualityScore,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          generationLog: {
            model: OPUS,
            constraintModel: SONNET,
            evaluationModel: SONNET,
            timestamp: new Date().toISOString(),
            tokenUsage: this.lastTokenUsage,
          },
        },
      });

      this.logger.log(`Fragment ${fragmentId} published successfully`);

      // Phase 6.1: Auto-replenishment of consumed wish seeds
      this.replenishSeedsIfNeeded(workId, wish).catch((err) => {
        this.logger.error(`Seed replenishment check failed for work ${workId}: ${err}`);
      });

      // Phase 6.2: Author revenue share from Fragment generation
      // TODO: Implement WorldFragmentRevenue model and service.
      // Approach:
      //   1. Add a WorldFragmentRevenue model in schema.prisma (mirroring CharacterTalkRevenue)
      //   2. Create a WorldFragmentRevenueService (mirroring CharacterTalkRevenueService)
      //   3. Here, after PUBLISHED, capture purchasedDeducted from BOTH consumeCredits calls
      //      (constraint check + generation) and call revenueService.recordRevenue()
      //   4. Revenue calculation: purchasedDeducted * 9.8 * 0.4 yen (40% of purchased credits)
      //   5. The work's authorId can be fetched via: this.prisma.work.findUnique({ where: { id: workId }, select: { authorId: true } })
      // Skipped for now because it requires a new Prisma model + migration.
    } catch (error) {
      this.logger.error(`Fragment generation failed for ${fragmentId}: ${error}`);

      await this.prisma.worldFragment.update({
        where: { id: fragmentId },
        data: { status: 'FAILED' },
      }).catch((e) => {
        this.logger.error(`Failed to update fragment ${fragmentId} to FAILED: ${e}`);
      });
    }
  }

  /**
   * 制約チェック: wishが原作の正典と矛盾しないかを検証
   */
  private async checkConstraints(
    apiKey: string,
    canon: any,
    wish: string,
    wishType: WishTypeDto,
  ): Promise<{ allowed: boolean; reason?: string; guidelines?: string }> {
    const prompt = `あなたは小説世界の「守護者」です。読者の願い（wish）が、原作の正典（Canon）と矛盾しないかを厳密に検証してください。

## 正典（Canon）
### 確定事実
${JSON.stringify(canon.establishedFacts, null, 2)}

### キャラクター制約
${JSON.stringify(
  (canon.characterProfiles as any[]).map((c: any) => ({
    name: c.name,
    constraints: c.constraints,
    personality: c.personality,
  })),
  null,
  2,
)}

### 世界の制約
${JSON.stringify(canon.worldRules, null, 2)}

### タイムライン
${JSON.stringify(canon.timeline, null, 2)}

### 関係性
${JSON.stringify(canon.relationships, null, 2)}

${canon.worldLayers ? `### 世界の層構造
${JSON.stringify(canon.worldLayers, null, 2)}

### 層間の相互作用
${JSON.stringify(canon.layerInteractions ?? [], null, 2)}

### 層に関する曖昧さ
${JSON.stringify(canon.layerAmbiguities ?? [], null, 2)}` : ''}

## 読者の願い
- 種類: ${wishType}
- 内容: ${wish}

## 核心原則
- 「結果は変わらないが過程が変わる」: 原作の確定事実は絶対に変更できない
- キャラクターの人格・信念・constraints は壊せない
- 世界の物理法則・社会構造は壊せない
- WHAT_IF でも、最終的な結果は原作と同じになる必要がある
- 層構造がある場合、Fragmentは原則として単一の層内で完結させる。層をまたぐ場合は原作で描かれた越境方法のみ使用可能
- layerAmbiguitiesに記載された曖昧さを解決する内容を生成してはならない。曖昧なものは曖昧なまま保つ

## 回答形式（JSON）
\`\`\`json
{
  "allowed": true/false,
  "reason": "却下理由（allowedがfalseの場合。読者向けのやさしい日本語で書く。「正典」「Canon」「WHAT_IF」「constraints」などの内部用語は使わない。原作の世界観を壊さないための理由を、物語の言葉で伝える）",
  "guidelines": "生成時に守るべきガイドライン（allowedがtrueの場合）"
}
\`\`\``;

    this.logger.log(`checkConstraints prompt length: ${prompt.length} chars`);
    if (prompt.length > 50000) {
      this.logger.warn(`checkConstraints prompt exceeds 50,000 chars (${prompt.length}). Consider reducing Canon size.`);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: SONNET,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException('Constraint check failed');
    }

    const result = await response.json() as any;
    if (result.usage) {
      this.lastTokenUsage.constraintCheck = {
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
      };
      this.logger.log(`Constraint check tokens: in=${result.usage.input_tokens}, out=${result.usage.output_tokens}`);
    }
    const text = result.content?.[0]?.text || '';
    const parsed = this.extractJson(text);

    if (!parsed) {
      this.logger.warn('Could not parse constraint check result, allowing by default');
      return { allowed: true, guidelines: 'Parse failed — apply standard constraints' };
    }

    return parsed;
  }

  /**
   * Fragment本文を生成（Opus）
   */
  private async generateContent(
    apiKey: string,
    canon: any,
    work: any,
    wish: string,
    wishType: WishTypeDto,
    anchorContext: string,
    guidelines?: string,
  ): Promise<string> {
    const wishTypeLabels: Record<WishTypeDto, string> = {
      [WishTypeDto.PERSPECTIVE]: '既存シーンを別のキャラクターの視点から描く',
      [WishTypeDto.SIDE_STORY]: '本編の裏側で起きていた出来事を描く',
      [WishTypeDto.MOMENT]: '本編に描かれなかった一瞬を描く',
      [WishTypeDto.WHAT_IF]: 'もし〜だったら、を描く（ただし最終結果は原作と同じ）',
    };

    const prompt = `あなたは「${work.title}」の世界に忠実な語り部です。
読者がこの世界の断片（World Fragment）を願いました。原作の正典を厳守しながら、この世界の一片を描いてください。

## 作品
- タイトル: ${work.title}
- ジャンル: ${work.genre || '不明'}
- 時代設定: ${work.settingEra || '不明'}

## 読者の願い
- 種類: ${wishTypeLabels[wishType]}
- 内容: ${wish}

## 正典（厳守）
### キャラクター
${JSON.stringify(canon.characterProfiles, null, 2)}

### 世界の規則
${JSON.stringify(canon.worldRules, null, 2)}

### 関係性
${JSON.stringify(canon.relationships, null, 2)}

### 文体
${JSON.stringify(canon.narrativeStyle, null, 2)}

${canon.worldLayers ? `### 世界の層構造
${JSON.stringify(canon.worldLayers, null, 2)}

### 層間の相互作用
${JSON.stringify(canon.layerInteractions ?? [], null, 2)}

### 層に関する曖昧さ（これらを解決してはならない）
${JSON.stringify(canon.layerAmbiguities ?? [], null, 2)}` : ''}
${anchorContext}

${guidelines ? `## 制約チェッカーからのガイドライン\n${guidelines}` : ''}

## 執筆ルール
1. 原作の文体・トーン・語り口を完全に再現する
2. キャラクターの人格・口調・一人称を正確に再現する
3. constraints に記載された「絶対にしないこと」を絶対にしない
4. 世界の物理法則・社会規範を逸脱しない
5. 確定事実と矛盾する内容を書かない
6. 1500〜3000文字程度で、一つの完結した断片として描く
7. 読者が原作の世界にいるような没入感を最優先する
8. 説明的にならず、シーンとして描写する

## キャラクターの内面を描くとき
- 各キャラクターのknowledge（知っていること/知らないこと/隠していること）を厳守する
- voiceNotesに記載された「このキャラクターの視点で描くときの真実」に必ず従う
- 「知っていて言わない」と「知らない」は全く異なる内面になる。混同しない
- trueNature（読了者視点の本質）を踏まえて内面を描く
- keyMomentsの描写と矛盾しないこと

## 台詞の引用ルール
- canonicalDialogueに記載された台詞を引用・参照する場合、原文を正確に使うこと
- 台詞を「だいたいこんな感じ」で書き換えない。原文がある場合はそのまま使う
- canonicalDialogueにない台詞を新たに創作する場合は、そのキャラクターのspeechStyleとconstraintsに厳密に従う

## 厳禁事項
- タイトル・見出し・Markdownヘッダー（#）をつけない。冒頭から本文を始める
- Canonに記載されていない身体的特徴や外見描写を創作しない。既存の描写のみ使う
- Canonに記載されていない場所・建物を創作しない。既存の場所のみ使う
- キャラクターの認識・知識を原作の該当時点を超えて進めない。scopeの範囲内で描く
- キャラクターが感情の核心を安易に認めない。各キャラのconstraintsに従い、その人物らしい表現を使う
- キャラクターが「わからない」と思う場面と「知っているが言わない」場面を正確に区別する

本文のみを出力してください。メタ情報や説明は不要です。`;

    this.logger.log(`generateContent prompt length: ${prompt.length} chars`);
    if (prompt.length > 50000) {
      this.logger.warn(`generateContent prompt exceeds 50,000 chars (${prompt.length}). Consider reducing Canon size.`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

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
          model: OPUS,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e.name === 'AbortError') {
        this.logger.error('Fragment generation timed out after 120s');
        throw new ServiceUnavailableException('Fragment generation timed out');
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Fragment generation failed: ${error}`);
      throw new ServiceUnavailableException('Fragment generation failed');
    }

    const result = await response.json() as any;
    if (result.usage) {
      this.lastTokenUsage.generation = {
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
      };
      this.logger.log(`Generation tokens: in=${result.usage.input_tokens}, out=${result.usage.output_tokens}`);
    }
    const text = result.content?.[0]?.text;
    if (!text) throw new ServiceUnavailableException('Empty response from AI');

    return this.postProcessContent(text);
  }

  /** 生成テキストの後処理 */
  private postProcessContent(text: string): string {
    let cleaned = text.trim();

    // Markdownヘッダーを除去（冒頭の # 行）
    cleaned = cleaned.replace(/^#{1,3}\s+.+\n+/, '');

    // コードブロックで囲まれていた場合に除去
    cleaned = cleaned.replace(/^```\w*\n/, '').replace(/\n```$/, '');

    return cleaned.trim();
  }

  /**
   * 生成されたFragmentの品質を自己評価
   */
  private async evaluateFragment(
    apiKey: string,
    canon: any,
    wish: string,
    wishType: WishTypeDto,
    content: string,
  ): Promise<object> {
    const prompt = `あなたは小説の品質審査官です。以下の「World Fragment」（読者の願いに基づいてAIが生成した小説の断片）を評価してください。

## 読者の願い
- 種類: ${wishType}
- 内容: ${wish}

## 生成されたFragment
${content}

## 正典のキャラクター制約
${JSON.stringify(
  (canon.characterProfiles as any[]).map((c: any) => ({
    name: c.name,
    constraints: c.constraints,
    speechStyle: c.speechStyle,
  })),
  null,
  2,
)}

## 評価基準（各0-100）
1. **characterConsistency**: キャラクターの人格・口調・行動が正典と一致しているか
2. **worldCoherence**: 世界観・物理法則・社会構造が正典と整合しているか
3. **literaryQuality**: 文学的品質（文体、描写力、没入感）
4. **wishFulfillment**: 読者の願いに応えているか
5. **overall**: 総合評価

\`\`\`json
{
  "characterConsistency": 0,
  "worldCoherence": 0,
  "literaryQuality": 0,
  "wishFulfillment": 0,
  "overall": 0,
  "notes": "評価コメント"
}
\`\`\``;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: SONNET,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      this.logger.warn('Quality evaluation failed, using default score');
      return { characterConsistency: 0, worldCoherence: 0, literaryQuality: 0, wishFulfillment: 0, overall: 0, notes: 'Evaluation failed' };
    }

    const result = await response.json() as any;
    if (result.usage) {
      this.lastTokenUsage.evaluation = {
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
      };
      this.logger.log(`Evaluation tokens: in=${result.usage.input_tokens}, out=${result.usage.output_tokens}`);
    }
    const text = result.content?.[0]?.text || '';

    this.logger.debug(`evaluateFragment raw response (first 500 chars): ${text.slice(0, 500)}`);

    const parsed = this.extractJson(text);

    if (!parsed) {
      this.logger.warn(`evaluateFragment JSON parse failed. Full response: ${text}`);
      return { characterConsistency: 0, worldCoherence: 0, literaryQuality: 0, wishFulfillment: 0, overall: 0, notes: 'Parse failed' };
    }

    return parsed;
  }

  /**
   * Phase 6.1: Check if a wish matches any seed in the Canon's wishSeeds pool.
   * If seeds with usedCount >= 3 exceed 30% of the pool, trigger replenishment (fire-and-forget).
   */
  private async replenishSeedsIfNeeded(workId: string, wish: string): Promise<void> {
    const canon = await this.prisma.worldCanon.findUnique({
      where: { workId },
      select: { wishSeeds: true },
    });
    if (!canon || !canon.wishSeeds) return;

    const seeds = canon.wishSeeds as any[];
    if (seeds.length === 0) return;

    // Find matching seed by normalized text comparison
    const normalizedWish = wish.trim().toLowerCase();
    let matched = false;
    for (const seed of seeds) {
      if (seed.wish && seed.wish.trim().toLowerCase() === normalizedWish) {
        seed.usedCount = (seed.usedCount || 0) + 1;
        matched = true;
        break;
      }
    }

    if (!matched) return;

    // Persist the updated usedCount
    await this.prisma.worldCanon.update({
      where: { workId },
      data: { wishSeeds: seeds },
    });

    // Check if replenishment is needed: seeds with usedCount >= 3 exceed 30% of pool
    const exhaustedCount = seeds.filter((s: any) => (s.usedCount || 0) >= 3).length;
    const threshold = Math.ceil(seeds.length * 0.3);

    if (exhaustedCount > threshold) {
      this.logger.log(
        `Seed replenishment triggered for work ${workId}: ${exhaustedCount}/${seeds.length} seeds exhausted (threshold: ${threshold})`,
      );
      // Fire-and-forget replenishment
      this.canonService.generateWishSeeds(workId).catch((err) => {
        this.logger.error(`Seed replenishment failed for work ${workId}: ${err}`);
      });
    }
  }

  /** JSONテキストをクリーンアップしてからパースを試みる */
  private cleanAndParseJson(raw: string): any | null {
    let cleaned = raw.trim();
    // 末尾カンマを除去（配列・オブジェクトの最後の要素の後ろ）
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
    // 単行コメントを除去
    cleaned = cleaned.replace(/\/\/[^\n]*/g, '');
    // 複数行コメントを除去
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }

  /** AIレスポンスからJSONを抽出（複数パターン対応） */
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

    // Pattern 3: 直接JSON
    const directJson = text.match(/\{[\s\S]*\}/);
    if (directJson) {
      const result = this.cleanAndParseJson(directJson[0]);
      if (result) return result;
    }

    return null;
  }

  /**
   * wishの内容から関連するエピソードを特定し、原作テキストを取得する
   * DB-only: fragmentAnalysisのキャラクター情報からマッチング（API呼び出しなし）
   */
  private async resolveAnchorContext(
    workId: string,
    wish: string,
    wishType: WishTypeDto,
    canon: any,
    explicitAnchorEpisodeId: string | null,
    upToEpisode: number,
  ): Promise<string> {
    // 明示的なアンカーがあればそれを使う
    if (explicitAnchorEpisodeId) {
      const episode = await this.prisma.episode.findUnique({
        where: { id: explicitAnchorEpisodeId },
        select: { title: true, content: true, orderIndex: true },
      });
      if (episode) {
        return `\n## 原作テキスト（第${episode.orderIndex}話「${episode.title}」）\n${episode.content || ''}`;
      }
    }

    try {
      // Get all EpisodeAnalysis with fragmentAnalysis for this work
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

      if (analyses.length === 0) return '';

      // Extract character names from the wish text by matching against Canon characterProfiles
      const characterProfiles = (canon.characterProfiles as any[]) || [];
      const matchedCharNames: string[] = [];
      for (const profile of characterProfiles) {
        if (wish.includes(profile.name)) {
          matchedCharNames.push(profile.name);
        }
      }

      // Filter episodes where fragmentAnalysis.characters contains matching character names
      type ScoredAnalysis = { analysis: typeof analyses[number]; score: number };
      const scored: ScoredAnalysis[] = [];

      for (const analysis of analyses) {
        // Only include episodes within scope
        if (analysis.episode.orderIndex > upToEpisode) continue;

        const fa = analysis.fragmentAnalysis as any;
        if (!fa || !fa.characters) continue;

        const faCharNames = (fa.characters as any[]).map((c: any) => c.name);

        // Score: number of matching characters found in this episode
        let score = 0;
        for (const name of matchedCharNames) {
          if (faCharNames.includes(name)) {
            score++;
          }
        }

        // If no character match found but we have analyses, give a base score of 0
        // so we can still fall back to picking some episodes
        if (score > 0 || matchedCharNames.length === 0) {
          scored.push({ analysis, score: score > 0 ? score : 0 });
        }
      }

      // If no matches at all, take the last 3 episodes as fallback
      let selectedAnalyses: typeof analyses;
      if (scored.length === 0) {
        selectedAnalyses = analyses
          .filter((a) => a.episode.orderIndex <= upToEpisode)
          .slice(-3);
      } else {
        // Sort by score descending, take top 3
        scored.sort((a, b) => b.score - a.score);
        selectedAnalyses = scored.slice(0, 3).map((s) => s.analysis);
      }

      if (selectedAnalyses.length === 0) return '';

      // Fetch actual episode content for the selected episodes
      const episodeIds = selectedAnalyses.map((a) => a.episodeId);
      const relevantEpisodes = await this.prisma.episode.findMany({
        where: { id: { in: episodeIds } },
        select: { title: true, content: true, orderIndex: true },
        orderBy: { orderIndex: 'asc' },
      });

      if (relevantEpisodes.length === 0) return '';

      // Format with truncation
      const maxCharsPerEpisode = Math.floor(12000 / relevantEpisodes.length);
      const contextParts = relevantEpisodes.map((ep) => {
        const content = ep.content || '';
        const truncated = content.length > maxCharsPerEpisode
          ? content.slice(0, maxCharsPerEpisode) + '\n\n[...以下省略...]'
          : content;
        return `### 第${ep.orderIndex}話「${ep.title}」\n${truncated}`;
      });

      this.logger.log(`Resolved ${relevantEpisodes.length} anchor episodes (DB-only) for wish: ${wish.slice(0, 50)}`);

      return `\n## 原作テキスト（関連エピソード）\n以下は原作の実際のテキストです。台詞、描写、固有名詞は必ずこの原文に従ってください。\n\n${contextParts.join('\n\n')}`;
    } catch (e: any) {
      this.logger.warn(`Anchor context resolution failed: ${e.message}`);
      return '';
    }
  }
}

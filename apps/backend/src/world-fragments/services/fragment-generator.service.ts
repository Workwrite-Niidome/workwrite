import { Injectable, Logger, NotFoundException, BadRequestException, ServiceUnavailableException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiSettingsService } from '../../ai-settings/ai-settings.service';
import { CreditService } from '../../billing/credit.service';
import { WorldCanonService } from './world-canon.service';
import { WishTypeDto } from '../dto/create-wish.dto';

const OPUS = 'claude-opus-4-6';
const SONNET = 'claude-sonnet-4-6';

// wishTypeごとのクレジットコスト
const CREDIT_COSTS: Record<WishTypeDto, number> = {
  [WishTypeDto.PERSPECTIVE]: 15,
  [WishTypeDto.SIDE_STORY]: 20,
  [WishTypeDto.MOMENT]: 10,
  [WishTypeDto.WHAT_IF]: 25,
};

const CONSTRAINT_CHECK_COST = 1; // 制約チェック分（リジェクトでも返金しない）
const RATE_LIMIT_PER_HOUR = 5;

@Injectable()
export class FragmentGeneratorService {
  private readonly logger = new Logger(FragmentGeneratorService.name);

  constructor(
    private prisma: PrismaService,
    private aiSettings: AiSettingsService,
    private creditService: CreditService,
    private canonService: WorldCanonService,
  ) {}

  /**
   * wishからFragmentを生成する全パイプライン
   * wish → 制約チェック → 生成 → 自己評価 → 保存
   */
  async generateFragment(
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

    try {
      // Phase 1: 制約チェック分のクレジットを先に消費（返金しない）
      await this.creditService.consumeCredits(
        userId,
        CONSTRAINT_CHECK_COST,
        'world_fragment_check',
        SONNET,
      );

      // 制約チェック（Sonnet — 高速）
      await this.prisma.worldFragment.update({
        where: { id: fragment.id },
        data: { status: 'CHECKING' },
      });

      const constraintResult = await this.checkConstraints(apiKey, canon, wish, wishType);

      if (!constraintResult.allowed) {
        await this.prisma.worldFragment.update({
          where: { id: fragment.id },
          data: {
            status: 'REJECTED',
            rejectionReason: constraintResult.reason,
            creditCost: CONSTRAINT_CHECK_COST,
          },
        });

        return this.prisma.worldFragment.findUnique({ where: { id: fragment.id } });
      }

      // Phase 2: 残りのクレジットを消費（生成分）
      const { transactionId } = await this.creditService.consumeCredits(
        userId,
        cost - CONSTRAINT_CHECK_COST,
        'world_fragment',
        OPUS,
      );

      // Phase 2: Fragment生成（Opus — 高品質）
      await this.prisma.worldFragment.update({
        where: { id: fragment.id },
        data: { status: 'GENERATING' },
      });

      const work = await this.prisma.work.findUnique({
        where: { id: workId },
        select: { title: true, genre: true, settingEra: true },
      });

      // アンカーエピソードのコンテキストを取得
      let anchorContext = '';
      if (options.anchorEpisodeId) {
        const episode = await this.prisma.episode.findUnique({
          where: { id: options.anchorEpisodeId },
          select: { title: true, content: true, orderIndex: true },
        });
        if (episode) {
          anchorContext = `\n## アンカーエピソード（第${episode.orderIndex}話「${episode.title}」）\n${episode.content?.slice(0, 3000) || ''}`;
        }
      }

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
        where: { id: fragment.id },
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

      return this.prisma.worldFragment.update({
        where: { id: fragment.id },
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
          },
        },
      });
    } catch (error) {
      this.logger.error(`Fragment generation failed: ${error}`);

      await this.prisma.worldFragment.update({
        where: { id: fragment.id },
        data: { status: 'FAILED' },
      });

      throw error;
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

## 読者の願い
- 種類: ${wishType}
- 内容: ${wish}

## 核心原則
- 「結果は変わらないが過程が変わる」: 原作の確定事実は絶対に変更できない
- キャラクターの人格・信念・constraints は壊せない
- 世界の物理法則・社会構造は壊せない
- WHAT_IF でも、最終的な結果は原作と同じになる必要がある

## 回答形式（JSON）
\`\`\`json
{
  "allowed": true/false,
  "reason": "却下理由（allowedがfalseの場合。読者向けのやさしい日本語で書く。「正典」「Canon」「WHAT_IF」「constraints」などの内部用語は使わない。原作の世界観を壊さないための理由を、物語の言葉で伝える）",
  "guidelines": "生成時に守るべきガイドライン（allowedがtrueの場合）"
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
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException('Constraint check failed');
    }

    const result = await response.json() as any;
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

## 厳禁事項
- タイトル・見出し・Markdownヘッダー（#）をつけない。冒頭から本文を始める
- Canonに記載されていない身体的特徴や外見描写を創作しない。既存の描写のみ使う
- Canonに記載されていない場所・建物を創作しない。既存の場所のみ使う
- キャラクターの認識・知識を原作の該当時点を超えて進めない。scopeの範囲内で描く
- キャラクターが感情の核心を安易に認めない。各キャラのconstraintsに従い、その人物らしい表現を使う

本文のみを出力してください。メタ情報や説明は不要です。`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Fragment generation failed: ${error}`);
      throw new ServiceUnavailableException('Fragment generation failed');
    }

    const result = await response.json() as any;
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
    const text = result.content?.[0]?.text || '';
    const parsed = this.extractJson(text);

    if (!parsed) {
      return { characterConsistency: 0, worldCoherence: 0, literaryQuality: 0, wishFulfillment: 0, overall: 0, notes: 'Parse failed' };
    }

    return parsed;
  }

  /** AIレスポンスからJSONを抽出（複数パターン対応） */
  private extractJson(text: string): any | null {
    // Pattern 1: ```json ... ```
    const jsonFenced = text.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
    if (jsonFenced) {
      try { return JSON.parse(jsonFenced[1]); } catch {}
    }

    // Pattern 2: ``` ... ```
    const fenced = text.match(/```\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenced) {
      try { return JSON.parse(fenced[1]); } catch {}
    }

    // Pattern 3: 直接JSON
    const directJson = text.match(/\{[\s\S]*\}/);
    if (directJson) {
      try { return JSON.parse(directJson[0]); } catch {}
    }

    return null;
  }
}

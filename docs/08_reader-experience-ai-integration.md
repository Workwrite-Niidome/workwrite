# 読者体験の刷新 + AI統合 実装計画書

## 1. 概要

### 目的
Workwriteの読者体験を機能面・UIUX面から徹底的にアップデートし、AIを読書体験のあらゆる場面に自然に統合する。「AIと人間の境界が存在しない」読書プラットフォームを実現する。

### 前提条件
- 別セッションで執筆体験の刷新（AI設定モジュール、プロンプトテンプレート、SSEストリーミング基盤）を同時進行中
- AI設定基盤（`AiSettingsService`, `SystemSetting`, `PromptTemplate`, `AiUsageLog`モデル）はそちらで実装される
- 本計画ではそれを前提として読者向け機能を設計する

### 新規依存パッケージ
なし。既存のfetch + SSE + `AiSettingsService`（執筆体験プランで実装済み前提）を利用。

---

## 2. 現状分析

### 2.1 実装済み機能（75+バックエンドエンドポイント、50+フロントエンドAPIメソッド）

| カテゴリ | 機能 |
|----------|------|
| リーダー | スクロール進捗、3テーマ(light/dark/sepia)、4フォントサイズ、コメントサイドバー |
| 発見 | トップページ(人気/埋もれた名作/新着)、検索(ジャンルフィルタ)、感情タグ発見 |
| 読後 | 5ステップ余韻フロー(余韻→感情タグ→状態変化→次の本→レビュー) |
| 本棚 | 3タブ(読書中/読みたい/読了) |
| タイムライン | 自己変容トラッキング、成長サマリー |
| スコアリング | Claude API統合 (claude-sonnet-4-6) 4軸品質分析 |
| ソーシャル | エピソードコメント、レビュー+参考投票、感情タグ |
| ハイライト | バックエンド完全実装(startPos/endPos/color/memo)、フロントエンド未統合 |
| 通知 | バックエンド完全実装、フロントエンドはベルアイコンのみ(ドロップダウンなし) |

### 2.2 致命的な欠落

1. **読者向けAI機能がゼロ**（スコアリングは作家向け）
2. **「続きを読む」セクションなし**（ログインユーザーの離脱原因）
3. **読書時間表示なし**（wordCountはDBにあるが未表示）
4. **ハイライトUIなし**（バックエンドは完備なのにフロントエンドで使えない）
5. **通知ドロップダウンなし**（ベルアイコンが飾り）
6. **トークンリフレッシュ未実装**（セッション切れで無言失敗）

---

## 3. 新規データモデル

### 3.1 Prismaスキーマ追加

`apps/backend/prisma/schema.prisma` に3モデル追加:

```prisma
model AiInsight {
  id        String   @id @default(cuid())
  workId    String
  userId    String?            // null=汎用, non-null=個人化
  type      String             // "completion", "theme", "character"
  content   Json               // 構造化されたインサイトデータ
  createdAt DateTime @default(now())
  work      Work     @relation(fields: [workId], references: [id], onDelete: Cascade)
  @@unique([workId, userId, type])
  @@index([workId])
  @@index([userId])
}

model WorkEmbedding {
  id        String   @id @default(cuid())
  workId    String   @unique
  summary   String   @db.Text   // AI生成の要約
  themes    Json                 // ["テーマ1", "テーマ2", ...]
  tone      String?              // "dark", "hopeful", "whimsical"
  audience  String?              // 対象読者層
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  work      Work     @relation(fields: [workId], references: [id], onDelete: Cascade)
}

model AiConversation {
  id        String   @id @default(cuid())
  userId    String
  workId    String
  messages  Json                 // [{role, content, timestamp}]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([userId, workId])
  @@index([userId])
}
```

Workモデルにリレーション追加:
```prisma
aiInsights    AiInsight[]
embedding     WorkEmbedding?
```

---

## 4. 実装フェーズ

### Phase R1: 読者向けAI基盤 + 即効改善

#### R1-1. Prismaモデル追加
- 上記3モデル + Workリレーション追加
- `prisma db push` で反映

#### R1-2. 「続きを読む」セクション（ホームページ）

**バックエンド:**
| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/discover/discover.service.ts` | `getContinueReading(userId)`: BookshelfEntry(status=READING) + 最新ReadingProgress結合、現在のエピソードと進捗%を返却 |
| `src/discover/discover.controller.ts` | `GET /discover/continue-reading` (認証必須) |

**フロントエンド:**
| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/app/page.tsx` | ヒーローセクション直下に「続きを読む」カード表示（ログイン時のみ）。各カードに作品名、現在エピソード名、進捗バー、「続きを読む」ボタン |
| `src/lib/api.ts` | `getContinueReading()` メソッド追加 |

**複雑度:** S

#### R1-3. 読書時間表示

| 対象ファイル | 変更内容 |
|-------------|---------|
| `packages/shared/src/constants.ts` | `JAPANESE_CHARS_PER_MINUTE = 500` 追加 |
| `src/lib/utils.ts` | `estimateReadingTime(charCount: number): string` 追加（日本語: 約500文字/分） |
| `src/app/works/[id]/page.tsx` | エピソード一覧の各行に「約X分」を表示、作品全体の推定読書時間をメタデータに追加 |
| `src/app/read/[episodeId]/page.tsx` | ヘッダーに残り読書時間を表示（進捗に連動） |

**複雑度:** S

#### R1-4. 通知ドロップダウン

バックエンドは実装済み。フロントエンドのみ。

| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/components/layout/notification-dropdown.tsx` | **新規作成** - ベルアイコンクリックでドロップダウン表示、未読バッジ（赤丸+数字）、最新5件表示、既読/未読の視覚区別、「すべて既読にする」ボタン、「すべて見る」リンク、ドロップダウン外クリックで閉じる |
| `src/components/layout/header.tsx` | ベルアイコンのLink → NotificationDropdownコンポーネントに置換 |

**複雑度:** S

#### R1-5. トークンリフレッシュ

| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/lib/api.ts` | `fetch`ラッパーに401レスポンスインターセプター追加。401時に`refreshToken()`を呼び出し、新トークンで再試行。リフレッシュも失敗したらログアウト |
| `src/lib/auth-context.tsx` | リフレッシュトークンをlocalStorageに保存（現在は保存していない） |

**複雑度:** S

---

### Phase R2: AI読書インサイト

#### R2-1. AIインサイトモジュール

**バックエンド新規ファイル:**
- `src/ai-insights/ai-insights.module.ts`
- `src/ai-insights/ai-insights.service.ts`
- `src/ai-insights/ai-insights.controller.ts`

**エンドポイント:**
| Method | Path | 機能 | Auth |
|--------|------|------|------|
| GET | `/ai/insights/:workId` | 作品の汎用インサイト取得（キャッシュ、なければ生成） | 任意 |
| GET | `/ai/insights/:workId/personal` | 個人化インサイト（ユーザーの感情タグ+状態変化を考慮） | 必須 |

**AIプロンプト戦略:**

汎用インサイト（作品テキスト先頭15,000文字を入力）:
```
あなたは文学評論家です。以下の小説を分析し、JSON形式で回答してください。
{
  "themes": [{ "name": "テーマ名", "explanation": "説明" }],  // 3-5件
  "emotionalJourney": "作品の感情的な軌道の説明",
  "characterInsights": [{ "name": "人物名", "arc": "成長や変化" }],
  "symbolism": [{ "element": "象徴", "meaning": "意味" }],  // 2-3件
  "discussionQuestions": ["問い1", "問い2", "問い3"]
}
```

個人化インサイト（+ ユーザーの感情タグ・状態変化データ）:
```
読者は以下の感情を報告しました: {{emotions}}
読む前後の変化: {{stateChanges}}
この読者にとってこの作品がどのような意味を持ったか、個人的な共鳴ポイントを分析してください。
```

**フロントエンド:**
| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/app/works/[id]/afterword/page.tsx` | 「余韻」ステップ後に「AIインサイト」ステップ追加（5→6ステップ）。テーマ、キャラクター分析、議論の問い等をカード形式で表示 |
| `src/components/ai/insight-card.tsx` | **新規作成** - 1インサイトの展開/折りたたみカード |
| `src/lib/api.ts` | `getAiInsights(workId)` / `getPersonalAiInsights(workId)` 追加 |

**複雑度:** L

#### R2-2. AI搭載レコメンデーション

**バックエンド新規ファイル:**
- `src/ai-recommendations/ai-recommendations.module.ts`
- `src/ai-recommendations/ai-recommendations.service.ts`
- `src/ai-recommendations/ai-recommendations.controller.ts`

**エンドポイント:**
| Method | Path | 機能 | Auth |
|--------|------|------|------|
| GET | `/ai/recommendations/for-me` | 読書履歴+感情タグベースのAIレコメンド | 必須 |
| GET | `/ai/recommendations/because-you-read/:workId` | 特定作品ベースのレコメンド | 任意 |
| POST | `/ai/embeddings/generate/:workId` | 作品の意味的埋め込み生成 | ADMIN |

**レコメンドロジック:**
1. ユーザーの読了作品リスト + 感情タグ + 状態変化サマリーを収集
2. プラットフォーム上の未読作品のWorkEmbedding（要約+テーマ+トーン）を取得
3. Claudeに「この読者に最適な3作品を選び、理由を説明して」と依頼
4. 結果をキャッシュ（24時間）

**WorkEmbedding生成（作品公開時 or スコアリング時に自動実行）:**
- 作品テキスト → Claude → 要約(200字) + テーマ配列 + トーン + 対象読者
- `WorkEmbedding` にupsert

**フロントエンド:**
| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/app/page.tsx` | 「続きを読む」の次に「AIのおすすめ」セクション追加（ログイン時のみ） |
| `src/app/works/[id]/afterword/page.tsx` | 「次の本」ステップをAIレコメンドに置換（推薦理由付き） |
| `src/components/ai/recommendation-card.tsx` | **新規作成** - 作品情報 + AI推薦理由のカード |
| `src/lib/api.ts` | `getAiRecommendations()` / `getAiRecommendationsBecauseYouRead(workId)` 追加 |

**複雑度:** L

---

### Phase R3: リーダー体験の深化

#### R3-1. ハイライト機能のフロントエンド統合

バックエンドは完全実装済み（`POST/GET/DELETE /reading/highlights`）。

**新規ファイル:**
| ファイル | 概要 |
|---------|------|
| `src/components/reader/highlighted-text.tsx` | テキストをハイライト位置で分割し、`<mark>`タグでレンダリング。ハイライトクリックでメモ表示ポップオーバー |
| `src/components/reader/highlight-toolbar.tsx` | テキスト選択時にフローティングツールバー表示。色選択（4色: 黄/緑/青/ピンク）、メモ入力欄、「保存」「AI解説」ボタン |

**修正ファイル:**
| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/app/read/[episodeId]/page.tsx` | ページロード時にハイライト取得、テキスト表示を`HighlightedText`に置換、`window.getSelection()`でテキスト選択検出→`HighlightToolbar`表示、選択範囲のstartPos/endPosを計算し保存。モバイル: 長押しで選択→ツールバーは選択上部に固定表示 |

**複雑度:** M

#### R3-2. AIハイライト解説

**バックエンド:**
| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/highlights/highlights.service.ts` | `explainHighlight(highlightId, userId)` メソッド追加。ハイライトされたテキスト + 前後2000文字のコンテキストを取得し、Claudeに文学的解説を依頼 |
| `src/highlights/highlights.controller.ts` | `POST /reading/highlights/:id/ai-explain` (認証必須) |

**AIプロンプト:**
```
あなたは文学アナリストです。読者が以下の一節をハイライトしました。
作品: {{workTitle}}
ハイライト箇所: 「{{highlightedText}}」
前後のコンテキスト: {{context}}

この箇所の意義、象徴性、物語における役割を簡潔に解説してください（200-400文字）。
```

**フロントエンド:**
| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/components/reader/highlight-toolbar.tsx` | 「AI解説」ボタンからAPIを呼び出し、ポップオーバーにストリーミングで解説表示 |
| `src/lib/api.ts` | `explainHighlight(highlightId)` 追加 |

**複雑度:** M

#### R3-3. AIブックコンパニオン（対話型）

読んでいる/読んだ作品についてAIと会話できるチャットインターフェース。

**バックエンド新規ファイル:**
- `src/ai-companion/ai-companion.module.ts`
- `src/ai-companion/ai-companion.service.ts`
- `src/ai-companion/ai-companion.controller.ts`

**エンドポイント:**
| Method | Path | 機能 | Auth |
|--------|------|------|------|
| POST | `/ai/companion/:workId/chat` | メッセージ送信、AI応答（SSE） | 必須 |
| GET | `/ai/companion/:workId/history` | 会話履歴 | 必須 |
| DELETE | `/ai/companion/:workId` | 会話クリア | 必須 |

**AIプロンプト戦略:**
```
あなたは「{{workTitle}}」の読書コンパニオンです。
作品の全文: {{workText (先頭30,000文字)}}

ルール:
- 読者の読書進捗は {{progressPct}}% です。未読部分のネタバレは絶対にしないでください
- 質問に対して作品の内容に基づいて回答してください
- 読者の考察を深める質問で返すことも歓迎です
- 日本語で応答してください
```

会話履歴は `AiConversation.messages` (JSON配列) に蓄積。

**フロントエンド:**
| ファイル | 種別 | 概要 |
|---------|------|------|
| `src/app/works/[id]/companion/page.tsx` | 新規 | フルページチャットUI（吹き出し形式）、メッセージ入力+送信ボタン、会話クリアボタン、「ネタバレなし」の安心表示 |
| `src/components/ai/companion-chat.tsx` | 新規 | チャットバブルUI（ユーザー: 右寄せ, AI: 左寄せ）、ストリーミング表示（タイプライター風）、ローディングドットアニメーション |
| `src/app/read/[episodeId]/page.tsx` | 修正 | ヘッダーに「AI」ボタン追加（コメントサイドバーと同パターンでコンパニオンパネル表示） |
| `src/app/works/[id]/page.tsx` | 修正 | 「AIと語る」ボタン追加 |
| `src/lib/api.ts` | 修正 | `chatWithCompanion(workId, message)` / `getCompanionHistory(workId)` / `clearCompanionHistory(workId)` 追加 |

**複雑度:** L

---

### Phase R4: 発見体験の強化

#### R4-1. AIオンボーディング個人化

現在のオンボーディング: 5問の静的質問 → 感情ベクトル計算 → import-historyへリダイレクト。
改善: AI分析による「読書パーソナリティ」プロフィールと初期レコメンドを生成。

**バックエンド:**
| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/onboarding/onboarding.service.ts` | `submitOnboarding()` 後にClaude呼び出し: 5問の回答→「読書パーソナリティ」テキスト+推奨ジャンル/テーマを生成。`OnboardingResult`に`aiProfile Json?`フィールド追加（マイグレーション） |

**AIプロンプト:**
```
以下の読書に関する5つの質問への回答を分析し、読書パーソナリティプロフィールを生成してください。
{{answers}}
JSON形式: { "personality": "200文字の人物像", "recommendedGenres": ["ジャンル"], "recommendedThemes": ["テーマ"] }
```

**フロントエンド:**
| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/app/onboarding/page.tsx` | 最終ステップ後に「AI分析中...」ローディング→パーソナリティカード表示、推奨作品リスト、「読書を始める」ボタン→ホームページ |

**複雑度:** M

#### R4-2. AIタイムラインナラティブ

タイムラインページの冒頭に、AIが読書旅路を要約するナラティブカードを追加。

**バックエンド:**
| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/reflection/reflection.service.ts` | `generateTimelineNarrative(userId)` メソッド追加。ユーザーのタイムラインデータをClaude APIに送信し「あなたの読書の旅」ナラティブを生成 |
| `src/reflection/reflection.controller.ts` | `GET /reflection/narrative` (認証必須) |

**AIプロンプト:**
```
以下はある読者の読書記録です。読んだ作品、感じた感情、自己変化を分析し、
300-500文字の「読書の旅」ナラティブを書いてください。
温かみのある2人称で、読者の成長を讃えてください。
{{timelineData}}
```

**フロントエンド:**
| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/app/timeline/page.tsx` | サマリーカードの上に「あなたの読書の旅」ナラティブカード追加。AI生成中はスケルトン表示 |
| `src/lib/api.ts` | `getTimelineNarrative()` 追加 |

**複雑度:** M

#### R4-3. 検索オートコンプリート

**バックエンド:**
| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/discover/discover.service.ts` | `autocomplete(query)`: 作品タイトルと著者名で前方一致検索、上位5件返却 |
| `src/discover/discover.controller.ts` | `GET /discover/autocomplete?q=...` (認証不要) |

**フロントエンド:**
| 対象ファイル | 変更内容 |
|-------------|---------|
| `src/app/page.tsx` / `src/app/search/page.tsx` | 検索入力にデバウンス(300ms)オートコンプリートドロップダウン追加。候補クリックで作品詳細ページへ遷移 |

**複雑度:** S

---

## 5. 新規APIエンドポイント一覧

| Method | Path | 機能 | Auth |
|--------|------|------|------|
| GET | `/discover/continue-reading` | 続きを読む | 必須 |
| GET | `/discover/autocomplete?q=` | 検索オートコンプリート | 不要 |
| GET | `/ai/insights/:workId` | 汎用AIインサイト | 任意 |
| GET | `/ai/insights/:workId/personal` | 個人化インサイト | 必須 |
| GET | `/ai/recommendations/for-me` | AIレコメンド | 必須 |
| GET | `/ai/recommendations/because-you-read/:workId` | 関連レコメンド | 任意 |
| POST | `/ai/companion/:workId/chat` | AIコンパニオン会話 (SSE) | 必須 |
| GET | `/ai/companion/:workId/history` | 会話履歴 | 必須 |
| DELETE | `/ai/companion/:workId` | 会話クリア | 必須 |
| POST | `/reading/highlights/:id/ai-explain` | ハイライトAI解説 | 必須 |
| POST | `/ai/embeddings/generate/:workId` | 作品埋め込み生成 | ADMIN |
| GET | `/reflection/narrative` | タイムラインナラティブ | 必須 |

---

## 6. 新規フロントエンドコンポーネント一覧

| コンポーネント | ファイルパス | 用途 |
|-------------|-----------|------|
| NotificationDropdown | `components/layout/notification-dropdown.tsx` | ベル通知ドロップダウン |
| InsightCard | `components/ai/insight-card.tsx` | AIインサイト表示カード |
| RecommendationCard | `components/ai/recommendation-card.tsx` | AI推薦カード(理由付き) |
| CompanionChat | `components/ai/companion-chat.tsx` | AIチャットバブルUI |
| HighlightedText | `components/reader/highlighted-text.tsx` | ハイライト付きテキスト表示 |
| HighlightToolbar | `components/reader/highlight-toolbar.tsx` | テキスト選択フローティングバー |

---

## 7. 修正・作成ファイル一覧

### 7.1 バックエンド新規（9ファイル）

| ファイル | モジュール |
|---------|----------|
| `src/ai-insights/ai-insights.module.ts` | AIインサイト |
| `src/ai-insights/ai-insights.service.ts` | AIインサイト |
| `src/ai-insights/ai-insights.controller.ts` | AIインサイト |
| `src/ai-recommendations/ai-recommendations.module.ts` | AIレコメンド |
| `src/ai-recommendations/ai-recommendations.service.ts` | AIレコメンド |
| `src/ai-recommendations/ai-recommendations.controller.ts` | AIレコメンド |
| `src/ai-companion/ai-companion.module.ts` | AIコンパニオン |
| `src/ai-companion/ai-companion.service.ts` | AIコンパニオン |
| `src/ai-companion/ai-companion.controller.ts` | AIコンパニオン |

### 7.2 バックエンド修正（9ファイル）

| ファイル | 変更概要 |
|---------|---------|
| `prisma/schema.prisma` | AiInsight, WorkEmbedding, AiConversation追加 + Workリレーション |
| `src/app.module.ts` | 3モジュール登録 |
| `src/discover/discover.service.ts` | getContinueReading, autocomplete追加 |
| `src/discover/discover.controller.ts` | 2エンドポイント追加 |
| `src/highlights/highlights.service.ts` | explainHighlight追加 |
| `src/highlights/highlights.controller.ts` | AI解説エンドポイント追加 |
| `src/reflection/reflection.service.ts` | generateTimelineNarrative追加 |
| `src/reflection/reflection.controller.ts` | narrativeエンドポイント追加 |
| `src/onboarding/onboarding.service.ts` | AIプロフィール生成追加 |

### 7.3 フロントエンド新規（7ファイル）

| ファイル | 用途 |
|---------|------|
| `src/components/layout/notification-dropdown.tsx` | 通知ドロップダウン |
| `src/components/ai/insight-card.tsx` | AIインサイトカード |
| `src/components/ai/recommendation-card.tsx` | AIレコメンドカード |
| `src/components/ai/companion-chat.tsx` | AIチャットUI |
| `src/components/reader/highlighted-text.tsx` | ハイライト表示 |
| `src/components/reader/highlight-toolbar.tsx` | ハイライトツールバー |
| `src/app/works/[id]/companion/page.tsx` | AIコンパニオンページ |

### 7.4 フロントエンド修正（11ファイル）

| ファイル | 変更概要 |
|---------|---------|
| `src/app/page.tsx` | 続きを読む + AIおすすめ + オートコンプリート |
| `src/app/works/[id]/page.tsx` | 読書時間 + AIと語るボタン |
| `src/app/works/[id]/afterword/page.tsx` | AIインサイトステップ + AIレコメンド |
| `src/app/read/[episodeId]/page.tsx` | ハイライト + AIコンパニオンボタン + 残り時間 |
| `src/app/timeline/page.tsx` | AIナラティブカード |
| `src/app/onboarding/page.tsx` | AIパーソナリティ結果 |
| `src/app/search/page.tsx` | オートコンプリート |
| `src/components/layout/header.tsx` | NotificationDropdown統合 |
| `src/lib/api.ts` | 12メソッド追加 |
| `src/lib/auth-context.tsx` | リフレッシュトークン保存 |
| `src/lib/utils.ts` | estimateReadingTime追加 |

### 7.5 共有パッケージ修正（1ファイル）

| ファイル | 変更概要 |
|---------|---------|
| `packages/shared/src/constants.ts` | `JAPANESE_CHARS_PER_MINUTE = 500` 追加 |

---

## 8. リスクと対策

| リスク | 対策 |
|--------|------|
| Claude APIコスト | AiInsight/WorkEmbeddingテーブルで積極的キャッシュ。汎用インサイトは作品単位で1回生成 |
| APIレイテンシ(2-10秒) | スケルトンローダー + SSEストリーミング。コンパニオンはタイプライター表示 |
| APIキー未設定 | 全AI機能がグレースフルデグラデーション（`AiSettingsService.isAiEnabled()`チェック→UI非表示 or 「AI準備中」表示） |
| コンテンツサイズ上限 | スコアリングと同じパターン: 先頭15,000文字に切り詰め。コンパニオンは30,000文字 |
| Railway 2GBメモリ | AI応答はJSON/Textとしてpostgresに保存。ベクトルDB不要（Claudeで意味的マッチング） |

---

## 9. 実装スケジュール

```
Phase R1 (3日): 即効改善
  Day 1: スキーマ追加 + 続きを読む + 読書時間
  Day 2: 通知ドロップダウン + トークンリフレッシュ
  Day 3: テスト・ビルド確認

Phase R2 (5日): AI読書インサイト + レコメンド
  Day 4-5: AIインサイトモジュール（バックエンド + フロントエンド）
  Day 6-7: AIレコメンデーション（WorkEmbedding生成 + レコメンドロジック + UI）
  Day 8: テスト・統合確認

Phase R3 (5日): リーダー体験深化
  Day 9-10: ハイライトUI統合 + AI解説
  Day 11-13: AIブックコンパニオン（チャットUI + SSE + 会話管理）

Phase R4 (3日): 発見体験強化
  Day 14: AIオンボーディング個人化
  Day 15: AIタイムラインナラティブ + 検索オートコンプリート
  Day 16: 全体ポリッシュ + デプロイ
```

---

## 10. 検証チェックリスト

- [ ] `prisma db push` が成功する（AiInsight, WorkEmbedding, AiConversation）
- [ ] ホームページに「続きを読む」セクションが表示される（reading状態の本棚がある場合）
- [ ] 作品詳細・エピソード一覧に読書時間が表示される
- [ ] ヘッダーの通知ベルがドロップダウンで動作する
- [ ] 401エラー時にトークンリフレッシュが自動実行される
- [ ] 読了後のafterwordフローにAIインサイトステップが追加される
- [ ] AIレコメンドが推薦理由付きで表示される
- [ ] リーダー内でテキスト選択→ハイライト保存が動作する
- [ ] ハイライト箇所の「AI解説」が応答を返す
- [ ] AIコンパニオンで作品について会話できる（ネタバレなし）
- [ ] タイムラインに「読書の旅」ナラティブが表示される
- [ ] オンボーディング完了時にAIパーソナリティプロフィールが表示される
- [ ] 検索入力でオートコンプリート候補が表示される
- [ ] AI未設定時に全AI機能がグレースフルに無効化される
- [ ] `npm run build` (frontend + backend) が成功する
- [ ] 本番デプロイ（Railway + Vercel）が成功する

---

## 付録: 執筆体験プランとの依存関係

本計画は別セッションで並行実装される執筆体験の刷新計画の基盤（特に以下）を前提とする:
- `AiSettingsService` — AI有効/無効の判定、APIキー管理
- `AiUsageLog` — AI利用量の追跡
- `PromptTemplate` — プロンプトテンプレート管理
- SSEストリーミング基盤 — コンパニオンチャット等のリアルタイム応答

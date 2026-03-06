# 08. 執筆体験の刷新 + AI統合

## 概要

Workwriteの執筆体験を根本から改善する。現在はプレーンtextareaのみで、自動保存なし、書式なし、AIアシストなし。
Claude APIは用意済みだが、APIキー管理はenv変数のみで管理画面から設定不可。

**目的:** 最高の執筆環境を提供し、AIを活用した執筆支援を統合する。管理画面からAPIキーとプロンプトテンプレートを管理可能にする。

---

## 新規依存パッケージ

なし。既存のfetch + SSE（Server-Sent Events）で実装。Anthropic SDKは使わず、直接API呼び出し（既存のscoring.serviceと同パターン）。

---

## Phase 1: DB スキーマ + 基盤

### 1-1. Prisma モデル追加

`apps/backend/prisma/schema.prisma` に4モデル追加:

```prisma
model SystemSetting {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String   @db.Text
  encrypted Boolean  @default(false)
  updatedAt DateTime @updatedAt
  updatedBy String?
  @@index([key])
}

model PromptTemplate {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  description String?
  category    String            // "writing" | "editing" | "generation"
  prompt      String   @db.Text // {{content}}, {{character_name}} 等のプレースホルダ
  variables   Json?             // ["content", "genre"] 等
  isBuiltIn   Boolean  @default(false)
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  usageLogs   AiUsageLog[]
  @@index([category])
  @@index([isActive])
}

model AiUsageLog {
  id           String          @id @default(cuid())
  userId       String
  templateId   String?
  feature      String          // "writing_assist" | "scoring" | "synopsis_gen"
  inputTokens  Int             @default(0)
  outputTokens Int             @default(0)
  model        String
  durationMs   Int             @default(0)
  createdAt    DateTime        @default(now())
  template     PromptTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)
  @@index([userId])
  @@index([createdAt])
  @@index([feature])
}

model EpisodeDraft {
  id        String   @id @default(cuid())
  episodeId String?
  workId    String
  userId    String
  title     String
  content   String   @db.Text
  savedAt   DateTime @default(now())
  @@unique([userId, workId, episodeId])
  @@index([userId])
}
```

### 1-2. 暗号化ユーティリティ

**作成:** `apps/backend/src/common/crypto.util.ts`
- AES-256-GCM で暗号化/復号
- `ENCRYPTION_KEY` 環境変数（32バイト）を使用
- SystemSetting の `encrypted=true` レコードに適用

### 1-3. AI設定モジュール

**作成ファイル:**
- `apps/backend/src/ai-settings/ai-settings.module.ts`
- `apps/backend/src/ai-settings/ai-settings.service.ts`
- `apps/backend/src/ai-settings/ai-settings.controller.ts`

**Service メソッド:**

| メソッド | 説明 |
|---------|------|
| `getApiKey()` | DB設定を優先、なければ `process.env.CLAUDE_API_KEY` にフォールバック |
| `isAiEnabled()` | `ai.enabled` 設定チェック |
| `getModel()` | 設定されたモデル名（デフォルト: `claude-sonnet-4-6`） |
| `setSetting(key, value, encrypted, adminId)` | upsert |

**Controller エンドポイント（ADMIN専用）:**

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/admin/ai/settings` | 全設定一覧（APIキーはマスク表示） |
| PUT | `/admin/ai/settings/:key` | 設定更新 |
| GET | `/admin/ai/usage` | 利用統計（合計トークン、リクエスト数） |
| GET | `/admin/ai/usage/daily` | 日次統計 |

---

## Phase 2: プロンプトテンプレート

### 2-1. テンプレートモジュール

**作成ファイル:**
- `apps/backend/src/prompt-templates/prompt-templates.module.ts`
- `apps/backend/src/prompt-templates/prompt-templates.service.ts`
- `apps/backend/src/prompt-templates/prompt-templates.controller.ts`

**エンドポイント:**

| メソッド | パス | 権限 | 説明 |
|---------|------|------|------|
| GET | `/prompt-templates` | 認証済みユーザー | アクティブなテンプレート一覧 |
| GET | `/admin/prompt-templates` | ADMIN | 全テンプレート一覧 |
| POST | `/admin/prompt-templates` | ADMIN | 新規作成 |
| PATCH | `/admin/prompt-templates/:id` | ADMIN | 更新 |
| DELETE | `/admin/prompt-templates/:id` | ADMIN | 削除 |

### 2-2. ビルトインテンプレート（seed.tsに追加）

| slug | 名前 | category | variables | 用途 |
|------|------|----------|-----------|------|
| `continue-writing` | 続きを書く | writing | `[content]` | 文体を維持して続きを生成 |
| `character-dev` | キャラクター深掘り | writing | `[content, character_name]` | キャラの内面・背景を深掘り |
| `scene-enhance` | シーン描写の強化 | editing | `[content]` | 五感を活用した描写の強化 |
| `dialogue-improve` | 会話の改善 | editing | `[content]` | 自然で個性的な会話に改善 |
| `plot-ideas` | プロット展開のアイデア | writing | `[content, genre]` | 3つの展開アイデアを提案 |
| `style-adjust` | 文体の調整 | editing | `[content, target_style]` | 指定の文体に調整 |
| `proofread` | 校正・推敲 | editing | `[content]` | 誤字脱字・文法・表現の改善 |
| `synopsis-gen` | あらすじ生成 | generation | `[content]` | 200-400字のあらすじ生成 |

各テンプレートのプロンプトは日本語で、`{{content}}` 等のプレースホルダ付き。
テンプレート内のcontentは10,000文字に切り詰めてトークン制限に対応。

---

## Phase 3: AI アシストバックエンド

### 3-1. AIアシストモジュール

**作成ファイル:**
- `apps/backend/src/ai-assist/ai-assist.module.ts`
- `apps/backend/src/ai-assist/ai-assist.service.ts`
- `apps/backend/src/ai-assist/ai-assist.controller.ts`

**Service ロジック:**
1. `ai-settings.service.isAiEnabled()` チェック → 無効なら503
2. `ai-settings.service.getApiKey()` 取得
3. テンプレートをDBから取得
4. `{{placeholder}}` をユーザー入力で置換
5. Anthropic API を `stream: true` で呼び出し
6. `AiUsageLog` に記録
7. ストリームを返却

**Controller エンドポイント:**

| メソッド | パス | 権限 | 説明 |
|---------|------|------|------|
| POST | `/ai/assist` | 認証済み | SSEストリーミング応答 |
| GET | `/ai/status` | 認証済み | AI利用可否チェック |

- Body: `{ templateSlug: string, variables: Record<string, string> }`
- Response: `text/event-stream`
- ヘッダー: `X-Accel-Buffering: no`, `Cache-Control: no-cache`

**注意:** グローバル `TransformInterceptor` がSSEを壊す可能性 → SSEエンドポイントではインターセプター除外

### 3-2. scoring.service.ts の更新

**修正:** `apps/backend/src/scoring/scoring.service.ts`
- `this.config.get('CLAUDE_API_KEY')` → `this.aiSettings.getApiKey()` に変更
- `AiSettingsService` をDI

---

## Phase 4: 執筆エディタ刷新（フロントエンド）

### 4-1. エディタコンポーネント群

**作成ファイル:**

| ファイル | 説明 |
|---------|------|
| `src/components/editor/writing-editor.tsx` | メインエディタ |
| `src/components/editor/ai-assist-panel.tsx` | AIサイドパネル |
| `src/components/editor/template-selector.tsx` | テンプレート選択 |
| `src/lib/use-autosave.ts` | 自動保存フック |
| `src/lib/use-ai-stream.ts` | SSEストリーミングフック |

### 4-2. エディタレイアウト

```
+--------------------------------------------------+
| [タイトル入力]        [保存] [集中モード] [投稿]  |
+----------------------------+---------------------+
|                            | AI アシスト          |
|  <textarea>                | +------------------+|
|  (フルハイト、セリフ体)     | | テンプレート      ||
|                            | | - 続きを書く     ||
|                            | | - 校正・推敲     ||
|                            | | - シーン強化     ||
|                            | +------------------+|
|                            | | AI 応答          ||
|                            | | (ストリーミング)  ||
|                            | |                  ||
|                            | | [挿入] [コピー]  ||
|                            | +------------------+|
+----------------------------+---------------------+
| 3,456文字 | 保存済み 14:32 | 予約: [日時選択]     |
+--------------------------------------------------+
```

### 4-3. 主要機能

#### 自動保存 (use-autosave.ts)
- 最終入力から2秒後にデバウンス保存
- `PUT /episodes/draft` エンドポイント呼び出し
- 状態表示: 「保存中...」→「保存済み HH:MM」→「未保存」
- ページロード時にドラフトがあれば復元提案
- エピソード投稿成功後にドラフト削除

#### 集中モード
- ヘッダー・サイドバー・AIパネルを非表示
- テキストエリアを画面中央に配置、max-width制限
- Tailwindクラスのみで実装

#### 文字カウント
- `content.length` でカウント（日本語では文字数 = 実質的な語数）
- `Intl.Segmenter` があれば正確なグラフェム数、なければfallback

#### 予約公開
- チェックボックス「予約公開」+ `<input type="datetime-local">`
- `scheduledAt` をISO文字列でAPIに送信（バックエンド既対応）

#### AIストリーミング (use-ai-stream.ts)
- `fetch` + `ReadableStream` でSSE受信
- `{ isStreaming, result, error, abort }` を返却
- 中断ボタンで `AbortController.abort()`

### 4-4. AIアシストパネル (ai-assist-panel.tsx)

- カテゴリ別テンプレート表示（執筆 / 編集 / 生成）
- テンプレート選択時に必要な変数入力フォーム表示
- 「生成」ボタン → ストリーミング表示
- 「挿入」ボタン → テキストエリアの選択範囲 or 末尾に挿入
- 「コピー」ボタン → クリップボードにコピー
- AI未設定時: 「AI機能は現在利用できません」表示
- モバイル: 下部シートとして表示

### 4-5. ページ修正

**修正:** `apps/frontend/src/app/works/[id]/episodes/new/page.tsx`
- 現在のプレーンtextareaを `WritingEditor` コンポーネントに置換

**新規:** `apps/frontend/src/app/works/[id]/episodes/[episodeId]/edit/page.tsx`
- 既存エピソード編集ページ（現在存在しない）

### 4-6. ドラフトエンドポイント追加

**修正:** `apps/backend/src/episodes/episodes.controller.ts`

| メソッド | パス | 説明 |
|---------|------|------|
| PUT | `/episodes/draft` | upsert |
| GET | `/episodes/draft/:workId` | 取得 |
| DELETE | `/episodes/draft/:workId` | 削除 |

---

## Phase 5: 管理画面 AI設定UI

### 5-1. 管理画面ナビ追加

**修正:** `apps/frontend/src/app/admin/layout.tsx`

NAV_ITEMS に追加:
- `{ href: '/admin/ai', label: 'AI Settings', icon: Sparkles }`
- `{ href: '/admin/ai/templates', label: 'Templates', icon: FileText }`

### 5-2. AI設定ページ

**作成:** `apps/frontend/src/app/admin/ai/page.tsx`

- APIキー入力（パスワードフィールド、現在値マスク表示）
- AI有効/無効トグル
- モデル選択ドロップダウン
- 利用統計カード（総リクエスト、総トークン、推定コスト）
- 日次利用グラフ（CSSのみの棒グラフ）

### 5-3. テンプレート管理ページ

**作成:** `apps/frontend/src/app/admin/ai/templates/page.tsx`

- テンプレート一覧テーブル（名前、カテゴリ、ステータス、操作）
- 新規作成/編集フォーム（インライン or モーダル）
- フィールド: 名前、slug、カテゴリ、プロンプト本文、変数、有効/無効
- 「デフォルト再生成」ボタン

### 5-4. API クライアント追加

**修正:** `apps/frontend/src/lib/api.ts`

```typescript
// AI
getAiStatus(): Promise<{ data: { available: boolean; model: string } }>
getPromptTemplates(): Promise<{ data: PromptTemplate[] }>
aiAssistStream(slug: string, vars: Record<string, string>): fetch+SSE

// Drafts
saveDraft(data): Promise<...>
getDraft(workId, episodeId?): Promise<...>
deleteDraft(workId, episodeId?): Promise<...>

// Admin AI
getAiSettings(): Promise<...>
updateAiSetting(key, value): Promise<...>
getAiUsage(): Promise<...>
getAiUsageDaily(): Promise<...>

// Admin Templates
getAdminTemplates(): Promise<...>
createTemplate(data): Promise<...>
updateTemplate(id, data): Promise<...>
deleteTemplate(id): Promise<...>
seedTemplates(): Promise<...>
```

---

## Phase 6: ポリッシュ

- AI未設定時のグレースフルデグラデーション（パネル非表示 or 無効表示）
- レート制限（ユーザーあたり20回/時間、インメモリカウンター）
- 長文コンテンツ送信時のトークン制限警告
- ページ離脱時のリクエスト中断（AbortController）
- モバイルでのAIパネル表示（ボトムシート化）
- scoring.serviceのDB APIキー連携

---

## 修正・作成ファイル一覧

### バックエンド新規（12ファイル）

| # | ファイルパス | 説明 |
|---|------------|------|
| 1 | `src/common/crypto.util.ts` | AES-256-GCM 暗号化ユーティリティ |
| 2 | `src/ai-settings/ai-settings.module.ts` | AI設定モジュール |
| 3 | `src/ai-settings/ai-settings.service.ts` | AI設定サービス |
| 4 | `src/ai-settings/ai-settings.controller.ts` | AI設定コントローラ（管理者用） |
| 5 | `src/prompt-templates/prompt-templates.module.ts` | テンプレートモジュール |
| 6 | `src/prompt-templates/prompt-templates.service.ts` | テンプレートサービス |
| 7 | `src/prompt-templates/prompt-templates.controller.ts` | テンプレートコントローラ |
| 8 | `src/prompt-templates/dto/prompt-template.dto.ts` | テンプレートDTO |
| 9 | `src/ai-assist/ai-assist.module.ts` | AIアシストモジュール |
| 10 | `src/ai-assist/ai-assist.service.ts` | AIアシストサービス（SSEストリーミング） |
| 11 | `src/ai-assist/ai-assist.controller.ts` | AIアシストコントローラ |
| 12 | `src/ai-assist/dto/ai-assist.dto.ts` | AIアシストDTO |

### バックエンド修正（5ファイル）

| # | ファイルパス | 変更内容 |
|---|------------|---------|
| 1 | `prisma/schema.prisma` | 4モデル追加（SystemSetting, PromptTemplate, AiUsageLog, EpisodeDraft） |
| 2 | `prisma/seed.ts` | 8テンプレートシード追加 |
| 3 | `src/app.module.ts` | 3モジュール登録 |
| 4 | `src/scoring/scoring.service.ts` | AiSettingsService経由のAPIキー取得 |
| 5 | `src/episodes/episodes.controller.ts` | ドラフトエンドポイント追加 |

### フロントエンド新規（8ファイル）

| # | ファイルパス | 説明 |
|---|------------|------|
| 1 | `src/components/editor/writing-editor.tsx` | メインエディタコンポーネント |
| 2 | `src/components/editor/ai-assist-panel.tsx` | AIサイドパネル |
| 3 | `src/components/editor/template-selector.tsx` | テンプレート選択UI |
| 4 | `src/lib/use-autosave.ts` | 自動保存カスタムフック |
| 5 | `src/lib/use-ai-stream.ts` | SSEストリーミングカスタムフック |
| 6 | `src/app/admin/ai/page.tsx` | 管理画面 AI設定ページ |
| 7 | `src/app/admin/ai/templates/page.tsx` | 管理画面 テンプレート管理ページ |
| 8 | `src/app/works/[id]/episodes/[episodeId]/edit/page.tsx` | エピソード編集ページ |

### フロントエンド修正（3ファイル）

| # | ファイルパス | 変更内容 |
|---|------------|---------|
| 1 | `src/app/works/[id]/episodes/new/page.tsx` | WritingEditorに置換 |
| 2 | `src/app/admin/layout.tsx` | AI設定ナビ追加 |
| 3 | `src/lib/api.ts` | AI/ドラフト/テンプレートAPI追加 |

---

## 検証チェックリスト

- [ ] `prisma db push` が成功する
- [ ] ビルトインテンプレート8件がseedされる
- [ ] `GET /ai/status` がAPIキー未設定時 `{ available: false }` を返す
- [ ] 管理画面でAPIキーを設定 → `{ available: true }` に変わる
- [ ] テンプレート選択 → AIアシストがSSEでストリーミング応答
- [ ] 自動保存が2秒デバウンスで動作する
- [ ] ドラフト復元が正しく動作する
- [ ] 集中モードでヘッダー/サイドバーが非表示になる
- [ ] 予約公開で `scheduledAt` が設定される
- [ ] 管理画面でテンプレートCRUDが動作する
- [ ] 管理画面でAI利用統計が表示される
- [ ] `npm run build` (frontend + backend) が成功する
- [ ] 本番デプロイが成功する

# Workwrite システム仕様書（2026-03-15 時点）

> 執筆側・読者側・AI側の全機能と連動性を網羅した技術仕様書

---

## 目次

1. [執筆側（Author）機能](#1-執筆側author機能)
2. [読者側（Reader）機能](#2-読者側reader機能)
3. [AI側（AI System）機能](#3-ai側ai-system機能)
4. [データフロー全体図](#4-データフロー全体図)
5. [改善点・課題一覧](#5-改善点課題一覧)

---

## 1. 執筆側（Author）機能

### 1.1 作品管理

| 機能 | ルート | エンドポイント | モデル |
|------|--------|---------------|--------|
| 作品作成 | `/works/new` | `POST /works` | Work |
| 作品編集 | `/works/[id]/edit` | `PATCH /works/:id` | Work, WorkTag |
| 作品削除 | 同上 | `DELETE /works/:id` | Work |
| 公開/非公開 | 同上 | `PATCH /works/:id` (status) | Work |
| プレビュー | `/works/[id]/preview` | `GET /works/:id` | Work |
| 作品インポート | `/works/import` | `POST /works/import/analyze`, `POST /works/import/text` | WorkImport |

**作品ステータス**: `DRAFT → PUBLISHED ↔ UNPUBLISHED`

**公開時の自動処理**:
- エピソード分析（AI）
- 品質スコア計算（AI）
- SNS自動投稿（Post.AUTO_WORK）
- 検索インデックス更新

### 1.2 エピソード管理

| 機能 | ルート | エンドポイント |
|------|--------|---------------|
| 新規作成 | `/works/[id]/episodes/new` | `POST /works/:workId/episodes` |
| 編集 | `/works/[id]/episodes/[episodeId]/edit` | `PATCH /episodes/:id` |
| 削除 | 作品編集ページ内 | `DELETE /episodes/:id` |
| 公開 | 同上 | `POST /episodes/:id/publish` |
| 非公開 | 同上 | `POST /episodes/:id/unpublish` |
| 予約公開 | エディター内 | `POST /episodes/:id/schedule` |
| 並び替え | 作品編集ページ（DnD） | `PATCH /works/:workId/episodes/reorder` |
| 序章 | `/works/[id]/prologue/edit` | `PATCH /works/:id` (prologue) |

**エピソード公開時の自動処理**:
- エピソード分析（AI: EpisodeAnalysis生成）
- ストーリーサマリー更新（AI）
- SNS自動投稿（Post.AUTO_EPISODE）
- 品質スコア再計算トリガー

### 1.3 Creation Wizard（作品設計ウィザード）

7ステップのAI支援型作品設計フロー。ローカルストレージにドラフト自動保存。

| ステップ | コンポーネント | AI生成 |
|---------|---------------|--------|
| 0. ジャンル・タグ | `step-genre-tags.tsx` | — |
| 1. 想いを込める | `step-emotion-blueprint.tsx` | `POST /creation/emotions` (SSE) |
| 2. キャラクター | `step-character-designer.tsx` | `POST /creation/characters` (SSE) |
| 3. 世界観 | `step-world-building.tsx` | `POST /creation/world-building` (SSE) |
| 4. プロット構成 | `step-plot-structure.tsx` | `POST /creation/episodes-for-act` (SSE) |
| 5. タイトル・あらすじ | `step-title-synopsis.tsx` | `POST /creation/synopsis` (SSE) |
| 6. 確認 | `step-review.tsx` | — |

#### 想いを込める（3モード）

| モード | フィールド |
|--------|-----------|
| 推奨（recommended） | coreMessage, targetEmotions, readerJourney |
| 別の角度（alternative） | inspiration, readerOneLiner |
| スキップ（skip） | なし |

#### キャラクター設計

**標準フィールド**: name, role, gender, age, firstPerson, personality, speechStyle, appearance, background, motivation, relationships, uniqueTrait, arc

**カスタムフィールド** (`CustomFieldDef`):
- ジャンル別テンプレート自動適用
  - fantasy: 種族, 職業, 武器, 魔力・スキル
  - sf: 所属組織, 搭乗機体/装備, 出身惑星・地域
  - horror: 異能の名称と詳細, 人間かどうか, 秘密
  - romance/drama: 家族構成, 職業, 趣味
- inputType: text / textarea / select
- WorkCreationPlan.customFieldDefinitions に定義保存
- StoryCharacter.customFields に値保存

#### 世界観設計 (`WorldBuildingData`)

```
basics: { era, setting, civilizationLevel }
rules: [{ id, name, description, constraints }]
terminology: [{ id, term, reading, definition }]
history: string
infoAsymmetry: { commonKnowledge, hiddenTruths }
items: [{ id, name, appearance, ability, constraints, owner, narrativeMeaning }]
```

保存先: `WorkCreationPlan.worldBuildingData` (JSON) + `WorldSetting`テーブルへ自動同期

#### プロット構成（5テンプレート）

| テンプレート | グループ数 | 初期構造 |
|-------------|----------|---------|
| 起承転結 | 4 | 起, 承, 転, 結 |
| 序破急 | 3 | 序, 破, 急 |
| 三幕構成 | 3 | 第一幕, 第二幕, 第三幕 |
| ビートシート | 15 | Opening Image〜Final Image |
| 自由 | 1 | 空グループ |

**データ構造**: `ActGroup[] → EpisodeCard[]`
- @dnd-kit でドラッグ&ドロップ並び替え
- グループ間カード移動対応
- 各グループ単位でAIエピソード提案

**保存形式**: `plotOutline: { type: 'structured', structureTemplate, actGroups }`
旧形式 `{ text, aiData }` も後方互換

### 1.4 執筆エディター

**コンポーネント**: `writing-editor.tsx`

| 機能 | 実装 |
|------|------|
| オートセーブ | `use-autosave.ts` (2秒デバウンス → EpisodeDraft) |
| Ctrl+S 手動保存 | サーバーにドラフト保存 |
| beforeunload警告 | 未保存変更あり時 |
| 集中モード | フルスクリーン、パネル非表示 |
| 文字数カウント | リアルタイム表示 |
| テキスト選択追跡 | AI置換用に選択テキスト保持 |
| 下書き復元 | マウント時に既存ドラフトチェック → 復元ダイアログ |

#### サイドパネル群

| パネル | コンポーネント | 位置 |
|--------|-------------|------|
| 参照パネル | `reference-panel.tsx` | 左サイドバー (w-72) |
| AIアシスト | `ai-assist-panel.tsx` | 右サイドバー (w-80) |
| バージョン履歴 | `version-history-panel.tsx` | 右サイドバー (w-72) |
| AI整合性チェック | `ai-consistency-check.tsx` | エディター下部 |
| モバイルAI | ボトムシート | 画面下70vh |

#### 参照パネル表示内容

- **キャラクター**: 名前, 役割, 性格, 口調, 一人称, 動機
- **プロット**: 構造化→ActGroup/Episode表示、レガシー→テキスト表示
- **世界観**: 時代, 舞台, ルール, 用語集

#### バージョン履歴

- `POST /episodes/:id/snapshots` — スナップショット作成
- `GET /episodes/:id/snapshots` — 一覧取得
- `POST /episodes/snapshots/:id/restore` — 復元

### 1.5 キャラクター設定パネル

**コンポーネント**: `character-registry-panel.tsx`
作品編集画面とエディター両方から利用可能。

| 機能 | 実装 |
|------|------|
| キャラ一覧 | 折りたたみリスト |
| 展開フォーム | 全フィールド編集 + カスタムフィールド |
| AI提案 | SSEストリーミングでキャラ生成 |
| 本文抽出 | エピソード本文からAIキャラ検出 |
| 設定移行 | WorkCreationPlan JSON → StoryCharacterテーブル |
| 公開/非公開 | 読者への表示切替 |
| 関係設定 | キャラ間の関係タイプ定義 |

### 1.6 設計メモ（CreationPlanCard）

作品編集ページ (`/works/[id]/edit`) に表示。

**表示セクション**:
- テーマ・想い（emotionBlueprint）
- キャラクター概要（人数表示→パネル誘導）
- プロット（構造化: ActGroup表示 / レガシー: テキスト表示）
- 章立て（chapterOutline）
- 世界観（basics, rules, terminology, items）

**編集モード**: 想い・プロット(テキスト)・章立ての直接編集可能

### 1.7 品質スコア

**エンドポイント**: `POST /scoring/works/:workId`
**表示**: ダッシュボード + 作品編集ページ

**4軸（各0-100）**:
- 没入力（Immersion）
- 変容力（Transformation）
- 拡散力（Virality）
- 世界構築力（World Building）

### 1.8 ダッシュボード & アナリティクス

| ルート | 機能 |
|--------|------|
| `/dashboard` | 作品一覧, ウィザードドラフト, 統計概要 |
| `/dashboard/works/[id]` | 品質スコア, エピソードヒートマップ, 感情タグワードクラウド |

---

## 2. 読者側（Reader）機能

### 2.1 作品発見

| ルート | 機能 | エンドポイント |
|--------|------|---------------|
| `/` | トップページ: 人気作品, 隠れた名作, 新着, ムード検索, 続きを読む | `GET /discover/top` |
| `/search` | 全文検索 + ジャンルフィルター + ソート | `GET /discover/search` |
| `/discover/emotion/[tag]` | 感情タグ別閲覧（15タグ） | `GET /discover/emotion/:tag` |

**感情タグ（15種）**: courage, tears, worldview, healing, excitement, laughter, awe, nostalgia, empathy, mystery, growth, catharsis, beauty, thrill, warmth

**検索ソート**: relevance / newest / score

### 2.2 作品詳細

**ルート**: `/works/[id]`

表示内容:
- タイトル, 著者, あらすじ, ジャンル, タグ
- 品質スコアバッジ
- エピソード一覧（文字数・読了時間）
- 序章（折りたたみ表示）
- 読者数（読書中/読了/読みたい）
- 公開キャラクター一覧
- 本棚追加ボタン
- AIコンパニオンボタン

### 2.3 読書体験

**ルート**: `/read/[episodeId]`

| 機能 | 詳細 |
|------|------|
| 没入型リーダー | フルスクリーン、ヘッダー/カーソル自動非表示 |
| 読書設定 | フォントサイズ(4段階), 行間(4段階), 最大幅(3段階), テーマ(light/dark/sepia) |
| 進捗追跡 | スクロール位置自動記録（5秒デバウンス） |
| キーボード操作 | S:設定, A:AI, C:コメント, I:没入, ?:ヘルプ |
| スワイプナビ | 左右端スワイプでページ送り |
| エピソード完了バナー | 90%スクロールで表示、感情リアクション |

#### ハイライト機能

- テキスト選択 → ハイライト作成（6色）
- メモ追加
- AI解説リクエスト
- SNS共有（Post化）

#### レター（ファンメール）

- エピソード単位で送信
- 無料/有料レター

### 2.4 本棚

**ルート**: `/bookshelf`

3タブ: 読書中 / 読みたい / 読了
ソート: 更新日 / タイトル / 品質スコア / 読書進捗

### 2.5 読書統計

**ルート**: `/stats`

- 読了作品数, 総読書時間, 連続読書日数
- ジャンル分布チャート
- 月間アクティビティ
- トップ感情タグ

### 2.6 ソーシャル機能

| 機能 | ルート | エンドポイント |
|------|--------|---------------|
| タイムライン | `/timeline` | `GET /timeline`, `GET /timeline/global` |
| 投稿作成 | タイムライン内 | `POST /posts` |
| リプライ/引用 | `/posts/[id]` | `POST /posts` (replyToId/quoteOfId) |
| 拍手 | — | `POST /posts/:id/applause` |
| リポスト | — | `POST /posts/:id/repost` |
| ブックマーク | `/bookmarks` | `POST /posts/:id/bookmark` |
| フォロー | `/users/[id]` | `POST /users/:id/follow` |
| プロフィール | `/users/[id]` | `GET /users/:id` |
| 通知 | `/notifications` | `GET /notifications` |

### 2.7 ユーザー設定

| ルート | 機能 |
|--------|------|
| `/profile` | 表示名, ニックネーム, 自己紹介編集 |
| `/settings` | パスワード変更, アカウント削除, 招待コード管理 |
| `/settings/billing` | プラン管理, クレジット購入, 取引履歴 |
| `/settings/reading-profile` | AI性格診断, 推薦ジャンル |

### 2.8 AI読者機能

| 機能 | エンドポイント | コスト |
|------|---------------|--------|
| AIコンパニオン | `POST /ai/companion/:workId/chat` (SSE) | 0cr (Free: 5回/週) |
| ハイライトAI解説 | `POST /reading/highlights/:id/ai-explain` | 0cr |
| AI作品インサイト | `GET /ai/insights/:workId` | 0cr |
| パーソナル推薦 | `GET /ai/recommendations/for-me` | 0cr |
| 類似作品推薦 | `GET /ai/recommendations/because-you-read/:workId` | 0cr |

---

## 3. AI側（AI System）機能

### 3.1 モデル構成 & ティアシステム

| モデル | 用途 | 変数名 |
|--------|------|--------|
| claude-haiku-4-5-20251001 | 軽量タスク（分析, スコアリング, ハイライト解説） | HAIKU_MODEL |
| claude-sonnet-4-6 | 標準創作（デフォルト） | — |
| claude-opus-4-6 | プレミアム（Proのみ） | OPUS_MODEL |

| プラン | 月間クレジット | 思考モード | Opus | コンパニオン |
|--------|-------------|-----------|------|-------------|
| Free | 20 | ✗ | ✗ | 5回/週 |
| Standard | 200 | ✓ | ✗ | 無制限 |
| Pro | 600 | ✓ | ✓ | 無制限 |

| 機能 | クレジットコスト |
|------|----------------|
| 軽量タスク（校正, スコア, ハイライト等） | 0 |
| 通常Sonnet | 1 |
| Sonnet + Extended Thinking | 2 |
| Opus (Pro) | 5 |
| コンパニオン | 0 |
| ウィザード生成 | 1 |

### 3.2 AIコンテキスト構築

#### 構造化コンテキスト（`buildStructuredContext()`）

`story-structure.service.ts` から構築。`GET /works/:workId/story-context` で取得。

**含まれるデータ**:

| データ | ソース | ラベル |
|--------|--------|--------|
| キャラクター全フィールド | StoryCharacter | 【登場キャラクター設定（厳守）】 |
| カスタムフィールド（名前解決済み） | StoryCharacter.customFields + customFieldDefinitions | フィールド名: 値 |
| キャラクター関係 | StoryCharacterRelation | 関係: キャラ名（関係タイプ） |
| 物語構造 | StoryArc + StoryAct + StoryScene | 【物語構造】 |
| 世界観設定 | WorkCreationPlan.worldBuildingData | 【世界観設定（厳守）】 |

#### AIコンテキストビルダー（`ai-context-builder.service.ts`）

作品IDからリッチコンテキストを自動構築。テンプレート変数 `structural_context` が未指定の場合に自動注入。

**優先度順バケット（10,000文字上限）**:

| 優先度 | セクション | 内容 | 目安文字数 |
|--------|-----------|------|-----------|
| 1 | シーン目標 | 章の目的, 感情ターゲット, 転換点 | ~500 |
| 2 | 直近サマリー | 直前2エピソードの詳細 | ~1500 |
| 3 | 世界観設定 | 時代, ルール（時代考証用） | ~500 |
| 4 | キャラクター | 登場済み/未登場を分類、関係性付き | ~3000 |
| 5 | エピソード要約 | 全既刊の要約 | ~1500 |
| 6 | 伏線 | 未解決スレッド + 重要度 | ~500 |
| 7 | メタデータ | 視点, トーン, タイムライン | ~200 |

#### フロントエンドコンテキスト（`ai-assist-panel.tsx`）

エディター内AIパネルで構築。**含まれるデータ**:

| データ | ソース | 条件 |
|--------|--------|------|
| キャラクター設定 | structuredContext (優先) / creationPlan.characters (フォールバック) | 常に |
| プロット | creationPlan.plotOutline | 構造化→テキスト変換 |
| 章立て | creationPlan.chapterOutline | あれば |
| 世界観 | creationPlan.worldBuildingData | あれば |
| テーマ・想い | creationPlan.emotionBlueprint | 全6フィールド |
| ストーリーサマリー | creationPlan.storySummary | あれば |
| エピソード一覧 | episodes | フォールバック |

### 3.3 プロンプトテンプレート

10種の組み込みテンプレート:

| スラグ | 名称 | モデル | 主要変数 |
|--------|------|--------|---------|
| chapter-opening | 章の書き出し | Sonnet | content, context, char_count |
| continue-writing | 続きを書く | Sonnet | content, context, char_count |
| character-dev | キャラ深掘り | Sonnet | content, character_name, context |
| scene-enhance | 場面描写強化 | Sonnet | content, context |
| dialogue-improve | 台詞推敲 | Sonnet | content, context |
| plot-ideas | 展開案 | Sonnet | content, genre, context |
| style-adjust | 文体調整 | Sonnet | content, target_style |
| proofread | 校正 | Haiku | content |
| synopsis-gen | あらすじ生成 | Haiku | content |
| free-prompt | 自由プロンプト | Sonnet | content, context, user_prompt |

**全テンプレート共通ルール**:
- キャラの性別/口調/一人称は**厳守**
- 初登場キャラは外見描写必須
- 恋人/家族間は口調の柔軟化OK
- 世界観の時代考証（存在しない語彙禁止）

### 3.4 エピソード分析（自動）

**トリガー**: エピソード保存時（contentVersion変更検出時）
**モデル**: Haiku（0クレジット）

**抽出データ**:
```
summary: 200-300字
endState: 終了時の状況
narrativePOV: 視点
emotionalArc: 感情の流れ
timelineStart/End: 時間軸
locations: [{ name, description }]
characters: [{ name, role, action, currentState }]
foreshadowings: [{ description, type: plant|develop|resolve }]
dialogueSamples: [{ character, line, context, emotion }]
newWorldRules: [{ category, name, description }]
```

**副作用**:
- `StoryCharacter.currentState` 更新
- `Foreshadowing` レコード作成/更新
- `WorldSetting` エントリ作成
- `CharacterDialogueSample` 作成

### 3.5 ストーリーサマリー（キャッシュ）

**トリガー**: エピソード公開後
**モデル**: Haiku
**保存先**: `WorkCreationPlan.storySummary`

**戦略**:
- 初回: 全エピソード（各2000字上限）から完全構築
- 以降: 既存サマリー + 直近2話から差分更新

**出力構造**:
```json
{
  "overallSummary": "300字以内",
  "episodes": [{ "title", "summary", "keyEvents", "endState" }],
  "characters": [{ "name", "currentState", "relationships" }],
  "openThreads": ["伏線1", "伏線2"],
  "worldRules": ["ルール1"],
  "tone": "トーン",
  "timeline": "時間経過"
}
```

### 3.6 AI整合性チェック

**エンドポイント**: `POST /works/:workId/episodes/:episodeId/ai-check`
**コスト**: 1クレジット

**チェック対象**:
- 誤字脱字・文法
- キャラクター整合性（名前表記, 性別, 口調）
- プロット整合性（タイムライン, 動機, 因果関係）

**コンテキストに含まれるデータ**:
- StoryCharacter全フィールド（name, role, personality, speechStyle, firstPerson, gender, age, appearance, background, motivation, arc, customFields）
- plotOutline（構造化テキスト変換済み）
- worldBuildingData（basics, rules, terminology）

### 3.7 品質スコアリング

**モデル**: Haiku（0クレジット）

**4軸評価（0-100）**:
1. 没入力: 感情的没入度
2. 変容力: 読者の感情変化
3. 拡散力: シェアしたくなる度
4. 世界構築力: 設定の一貫性

**副産物**: 感情タグ3-5個を自動付与

### 3.8 AIコンパニオン（読者向け）

**ネタバレ防止**: 読者の読了位置より先の内容は絶対に言及しない
**コンテキスト**: 作品テキスト（30,000字上限）+ 直近20メッセージ
**プロンプトキャッシング**: 作品テキストはephemeralキャッシュ

### 3.9 AI推薦 & インサイト

| 機能 | モデル | キャッシュ |
|------|--------|----------|
| パーソナル推薦 | Haiku | 1時間 |
| 類似作品推薦 | Haiku | 作品単位 |
| 作品インサイト | Haiku | 作品単位 |
| ハイライト解説 | Haiku | — |

### 3.10 プロンプトキャッシング戦略

全APIコールに `anthropic-beta: prompt-caching-2024-07-31` ヘッダー付与。

**キャッシュ対象**:
- 構造化コンテキスト（system message, `cache_control: ephemeral`）
- エピソード分析システムプロンプト
- スコアリングシステムプロンプト
- コンパニオン作品テキスト

---

## 4. データフロー全体図

### 4.1 作品作成 → 執筆 → 読者到達

```
[Creation Wizard]
  ↓ saveCreationPlan()
[WorkCreationPlan] ← characters, plotOutline, emotionBlueprint,
  │                   customFieldDefinitions, worldBuildingData
  │
  ├─ migrateCharacters() → [StoryCharacter] (customFields含む)
  ├─ migrateArc() → [StoryArc] → [StoryAct] → [StoryScene]
  └─ syncWorldSettings() → [WorldSetting]

[Writing Editor]
  ↓ createEpisode() / updateEpisode()
[Episode]
  │
  ├─ Auto: episodeAnalysis → [EpisodeAnalysis]
  │    ├─ updates StoryCharacter.currentState
  │    ├─ creates Foreshadowing
  │    ├─ creates WorldSetting
  │    └─ creates CharacterDialogueSample
  │
  ├─ Auto: updateStorySummary → WorkCreationPlan.storySummary
  ├─ Auto: autoProcessWork → QualityScore
  └─ Auto: createAutoEpisodePost → Post (SNS)

[Reader]
  ↓ GET /works/:id, GET /episodes/:id
  ├─ ReadingProgress tracking
  ├─ BookshelfEntry management
  ├─ Highlight creation + AI explanation
  ├─ EmotionTag feedback
  └─ AI Companion chat
```

### 4.2 AIコンテキスト構築フロー

```
[AI Assist Request]
  │
  ├─ Frontend (ai-assist-panel.tsx):
  │    ├─ structuredContext (from buildStructuredContext API)
  │    ├─ creationPlan.plotOutline (structured → text conversion)
  │    ├─ creationPlan.worldBuildingData → 【世界観設定（厳守）】
  │    ├─ creationPlan.emotionBlueprint (6 fields)
  │    ├─ creationPlan.storySummary (if cached)
  │    └─ episodes list (fallback)
  │
  ├─ Backend (ai-context-builder.service.ts):
  │    ├─ StoryCharacter + relations + dialogueSamples
  │    ├─ StoryArc + Acts + Scenes
  │    ├─ EpisodeAnalysis (prior episodes)
  │    ├─ Foreshadowing (open threads)
  │    ├─ WorldSetting
  │    └─ Priority-based truncation (10K chars)
  │
  └─ Merged → Claude API prompt
```

### 4.3 キャラクターデータフロー

```
[Wizard Character Input]
  ↓ customFieldValues: { fieldId: value }
[WorkCreationPlan.characters] (JSON)
  ↓ migrateCharacters()
[StoryCharacter Table]
  ├─ customFields: { fieldId: value }
  ├─ arc, notes (relationships/uniqueTrait統合)
  └─ 標準フィールド全コピー
  ↓ updateCharacter()
[StoryCharacter Table] (customFields含めDTO対応)
  ↓ buildStructuredContext()
[AI Context]
  ├─ フィールドID → フィールド名に変換 (customFieldDefinitionsから参照)
  └─ 全フィールド + 関係性テキスト化
```

---

## 5. 改善点・課題一覧

### 5.1 構造連動性の課題

| # | 領域 | 課題 | 影響 | 提案 |
|---|------|------|------|------|
| 1 | コンテキスト | buildStructuredContext()の10K文字制限で暗黙的に切り捨て | 長編でAI品質低下 | 切り捨て発生時にユーザー通知 |
| 2 | コンテキスト | ai-assist-panelのcreationPlanがマウント時に1回だけ取得 | キャラ編集後にAIが旧データ参照 | パネル開閉時にリフレッシュ |
| 3 | 伏線管理 | Foreshadowingのopen/resolvedが自動分析のみ | 手動管理不可 | 作家が手動で伏線ステータス変更可能に |
| 4 | タイムライン | timelineStart/Endが抽出されるが検証なし | エピソード間の時間矛盾検出不可 | AI整合性チェックにタイムライン検証追加 |
| 5 | 関係タイプ | StoryCharacterRelation.relationTypeが台詞ルールに未反映 | 恋人間なのに敬語のまま等 | 関係タイプに応じた口調ルールをプロンプトに |
| 6 | 感情アーク | emotionBlueprintの感情弧がエピソード単位で検証されない | 設計と実装の乖離 | エピソード分析時にemotionTarget達成度チェック |

### 5.2 読者体験の改善点

| # | 課題 | 提案 |
|---|------|------|
| 7 | 検索がtitle/author/tagのみ | 本文全文検索、あらすじ検索の追加 |
| 8 | ジャンルフィルターのみ、タグ検索がない | タグでの複合検索（AND/OR）対応 |
| 9 | 読書進捗がスクロール位置のみ | 章単位の進捗表示、残り読了時間予測 |
| 10 | 公開キャラクターがネタバレ管理不可 | エピソード単位の公開制御（N話以降で公開） |
| 11 | 世界観設定が読者に直接公開されていない | 作品ページに世界観タブ追加 |
| 12 | 読了後のレコメンドが限定的 | 読者の感情タグ履歴 + 品質スコア類似度でマッチング強化 |

### 5.3 AI活用の改善点

| # | 課題 | 提案 |
|---|------|------|
| 13 | キャラクター自動検出がエピソード保存時に実行されない | 新キャラ検出時に確認ダイアログ表示 |
| 14 | 感情アーク実行時検証なし | エピソードの感情分析結果とemotionTargetを自動比較 |
| 15 | WorldSettingの読者向けネタバレ管理 | firstEpisode/lastEpisodeを活用した段階的公開 |
| 16 | AIコンパニオンが世界観設定を活用していない | WorldSettingデータをコンパニオンコンテキストに注入 |
| 17 | 品質スコアが作家の改善アクションに直結しない | スコア低下要因のエピソード特定 + 具体的改善提案 |
| 18 | オリジナリティ計算がUI非表示 | 作品ページにオリジナリティスコア表示 |

### 5.4 検索性・AIマッチングの改善点

| # | 課題 | 提案 |
|---|------|------|
| 19 | 作品エンベディングが未活用 | 類似作品推薦にベクトル検索導入 |
| 20 | 感情タグが読者フィードバックのみ | 作家がemotionBlueprintで設定した感情もタグに自動反映 |
| 21 | 読書プロフィールが推薦に弱い関連 | AIプロフィール結果を推薦アルゴリズムの重み付けに活用 |
| 22 | ジャンル+感情の複合フィルターなし | 「ファンタジー×感動」のような複合検索 |
| 23 | 作品間のキャラ/世界観類似度未計算 | 類似世界観の作品推薦 |
| 24 | 読了完走率がランキングに未反映 | 完走率の高い作品を「隠れた名作」に優先表示 |

---

## 付録: 主要ファイル一覧

### フロントエンド

| カテゴリ | ファイル |
|---------|---------|
| ウィザード | `apps/frontend/src/components/creation-wizard/wizard-shell.tsx` |
| ウィザード各ステップ | `step-genre-tags.tsx`, `step-emotion-blueprint.tsx`, `step-character-designer.tsx`, `step-world-building.tsx`, `step-plot-structure.tsx`, `step-title-synopsis.tsx`, `step-review.tsx` |
| エディター | `apps/frontend/src/components/editor/writing-editor.tsx` |
| AIアシスト | `apps/frontend/src/components/editor/ai-assist-panel.tsx` |
| 参照パネル | `apps/frontend/src/components/editor/reference-panel.tsx` |
| 整合性チェック | `apps/frontend/src/components/editor/ai-consistency-check.tsx` |
| キャラ管理 | `apps/frontend/src/components/editor/character-registry-panel.tsx` |
| バージョン履歴 | `apps/frontend/src/components/editor/version-history-panel.tsx` |
| 作品編集 | `apps/frontend/src/app/works/[id]/edit/page.tsx` |
| リーダー | `apps/frontend/src/app/read/[episodeId]/page.tsx` |
| API | `apps/frontend/src/lib/api.ts` |

### バックエンド

| カテゴリ | ファイル |
|---------|---------|
| AIアシスト | `apps/backend/src/ai-assist/ai-assist.service.ts` |
| AIコンテキスト | `apps/backend/src/ai-assist/ai-context-builder.service.ts` |
| エピソード分析 | `apps/backend/src/ai-assist/episode-analysis.service.ts` |
| ウィザードAI | `apps/backend/src/creation-wizard/creation-wizard.service.ts` |
| ストーリー構造 | `apps/backend/src/story-structure/story-structure.service.ts` |
| AIティア | `apps/backend/src/ai-settings/ai-tier.service.ts` |
| クレジット | `apps/backend/src/billing/credit.service.ts` |
| スコアリング | `apps/backend/src/scoring/scoring.service.ts` |
| スキーマ | `apps/backend/prisma/schema.prisma` |

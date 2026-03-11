# Workwrite SNS機能 実装計画書 v2

**文書バージョン**: 2.0
**作成日**: 2026-03-11

---

## 1. コンセプト

Twitterのように「投稿→タイムライン→交流」のサイクルを持つSNSを、Workwriteの小説プラットフォーム上に構築する。ユーザーが慣れ親しんだSNS操作感を維持しつつ、デザインとインタラクションはWorkwriteの世界観（温かみのあるベージュ系トーン、Noto Serif JP、文芸的な用語）を踏襲する。

### Twitter → Workwrite の翻訳

| Twitter | Workwrite | 理由 |
|---|---|---|
| ツイート | **ひとこと** | 小説プラットフォームらしい呼称 |
| いいね ❤️ | **拍手** 👏 | 文芸の世界では拍手が自然。絵文字ではなくアイコンで表現 |
| リツイート | **おすすめ** | 拡散より「推薦」のニュアンス |
| 引用リツイート | **引用おすすめ** | コメント付き推薦 |
| ブックマーク | **しおり** | 本のしおり。読書プラットフォームに最適 |
| リプライ | **返信** | そのまま |
| フォロー | **フォロー** | 既存機能を活用 |
| トレンド | **話題** | — |
| タイムライン | **タイムライン** | そのまま |

### リアクションの設計

**絵文字は使わない。** 代わりにWorkwriteのUIコンポーネントで表現する:

- **拍手**: lucide-react の `HandMetal` または独自SVGアイコン。タップで拍手数+1。色はprimary
- **おすすめ**: lucide-react の `Share2` アイコン。自分のタイムラインに再表示
- **しおり**: lucide-react の `Bookmark` アイコン。個人の保存リスト
- **返信**: lucide-react の `MessageCircle` アイコン。スレッド展開

すべてWorkwriteのカラーパレット（primary: #3d3127, accent: #8a7e6e）で統一。

---

## 2. 既存機能との統合ポイント

Workwriteの既存機能をSNSの「投稿」と自然に接続する:

| 既存機能 | SNS統合 |
|---|---|
| **作品公開** | 自動投稿: 「新作『○○』を公開しました」+ WorkCardミニ埋め込み |
| **エピソード公開** | 自動投稿: 「『○○』第N話を公開しました」 |
| **レビュー投稿** | 自動投稿: レビュー冒頭を引用した投稿 |
| **読了（本棚）** | 任意投稿: 「『○○』を読了しました」+ 感想を書ける |
| **ハイライト** | 任意投稿: 印象的な一節を引用投稿（作品への導線） |
| **感情タグ** | 投稿に感情タグを表示（「この作品に #泣ける を付けました」） |
| **レター** | 連携なし（プライベート機能として維持） |
| **フォロー** | そのまま活用。フォロー中のタイムラインの基盤 |
| **通知** | 拍手、おすすめ、返信、フォローを通知 |

---

## 3. データベース設計

### 3.1 新規テーブル

#### `Post`（投稿 / ひとこと）

```prisma
model Post {
  id          String    @id @default(cuid())
  authorId    String
  content     String    @db.Text       // 本文（最大500文字）
  postType    PostType  @default(ORIGINAL)

  // 埋め込みコンテンツ（任意）
  workId      String?                  // 作品への参照
  episodeId   String?                  // エピソードへの参照
  highlightId String?                  // ハイライト引用

  // おすすめ/引用おすすめ
  repostOfId  String?                  // おすすめ元の投稿ID
  quoteOfId   String?                  // 引用おすすめ元の投稿ID

  // 返信
  replyToId   String?                  // 返信先の投稿ID
  threadRootId String?                 // スレッドの起点投稿ID

  // 非正規化カウンター（パフォーマンス用）
  replyCount    Int     @default(0)
  repostCount   Int     @default(0)
  applauseCount Int     @default(0)
  bookmarkCount Int     @default(0)

  isDeleted   Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  author    User     @relation("PostAuthor", fields: [authorId], references: [id], onDelete: Cascade)
  work      Work?    @relation(fields: [workId], references: [id], onDelete: SetNull)
  episode   Episode? @relation(fields: [episodeId], references: [id], onDelete: SetNull)
  highlight Highlight? @relation(fields: [highlightId], references: [id], onDelete: SetNull)
  repostOf  Post?    @relation("Repost", fields: [repostOfId], references: [id], onDelete: SetNull)
  quoteOf   Post?    @relation("Quote", fields: [quoteOfId], references: [id], onDelete: SetNull)
  replyTo   Post?    @relation("Reply", fields: [replyToId], references: [id], onDelete: SetNull)
  threadRoot Post?   @relation("Thread", fields: [threadRootId], references: [id], onDelete: SetNull)

  reposts   Post[]   @relation("Repost")
  quotes    Post[]   @relation("Quote")
  replies   Post[]   @relation("Reply")
  threadPosts Post[] @relation("Thread")

  applause  Applause[]
  bookmarks PostBookmark[]

  @@index([authorId, createdAt])
  @@index([replyToId])
  @@index([threadRootId])
  @@index([repostOfId])
  @@index([createdAt])
  @@index([workId])
}

enum PostType {
  ORIGINAL          // 通常の投稿
  REPOST            // おすすめ（リツイート相当）
  QUOTE             // 引用おすすめ
  REPLY             // 返信
  AUTO_WORK         // 作品公開の自動投稿
  AUTO_EPISODE      // エピソード公開の自動投稿
  AUTO_REVIEW       // レビュー投稿の自動投稿
  AUTO_READING      // 読了報告の自動投稿
}
```

#### `Applause`（拍手 / いいね相当）

```prisma
model Applause {
  id        String   @id @default(cuid())
  userId    String
  postId    String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@unique([userId, postId])
  @@index([postId])
  @@index([userId])
}
```

#### `PostBookmark`（しおり / ブックマーク相当）

```prisma
model PostBookmark {
  id        String   @id @default(cuid())
  userId    String
  postId    String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@unique([userId, postId])
  @@index([userId, createdAt])
  @@index([postId])
}
```

### 3.2 既存テーブルの変更

#### `User`

```prisma
model User {
  // ... existing ...
  posts         Post[]         @relation("PostAuthor")
  applause      Applause[]
  postBookmarks PostBookmark[]
}
```

#### `Highlight`（共有フラグ追加）

```prisma
model Highlight {
  // ... existing ...
  isShared  Boolean  @default(false)
  sharedAt  DateTime?
  posts     Post[]

  @@index([episodeId, isShared])  // 追加
}
```

#### `Work`, `Episode`

```prisma
model Work {
  // ... existing ...
  posts Post[]
}

model Episode {
  // ... existing ...
  posts Post[]
}
```

### 3.3 テーブル関連図

```
User ──< Post (authorId)
Post ──< Post (replyToId)     // 返信ツリー
Post ──< Post (repostOfId)    // おすすめ
Post ──< Post (quoteOfId)     // 引用おすすめ
Post ──< Post (threadRootId)  // スレッド
Post ──< Applause (postId)    // 拍手
Post ──< PostBookmark (postId)// しおり
Post ──? Work (workId)        // 作品埋め込み
Post ──? Episode (episodeId)  // エピソード埋め込み
Post ──? Highlight (highlightId) // ハイライト引用
User ──< Follow (既存)        // タイムラインのフォロー基盤
```

---

## 4. API設計

### 4.1 投稿 (Post)

```
POST   /api/v1/posts                    -- 投稿作成
GET    /api/v1/posts/:id                -- 投稿詳細（返信スレッド含む）
DELETE /api/v1/posts/:id                -- 投稿削除（論理削除）
```

#### 投稿作成リクエスト

```json
{
  "content": "最高の一冊に出会いました。",
  "workId": "cuid...",          // 任意: 作品埋め込み
  "episodeId": "cuid...",       // 任意: エピソード埋め込み
  "highlightId": "cuid...",     // 任意: ハイライト引用
  "replyToId": "cuid...",       // 任意: 返信先
  "quoteOfId": "cuid..."        // 任意: 引用おすすめ元
}
```

### 4.2 タイムライン

```
GET /api/v1/timeline                    -- フォロー中タイムライン
GET /api/v1/timeline/global             -- グローバル（おすすめ/新着）
GET /api/v1/timeline/user/:id           -- ユーザーの投稿一覧
```

**共通パラメータ**:
- `cursor` — カーソルベースページネーション（投稿ID）
- `limit` — 取得件数（デフォルト20、最大50）

**フォロータイムラインのクエリ戦略**:
```sql
SELECT p.* FROM "Post" p
WHERE p."authorId" IN (
  SELECT "followingId" FROM "Follow" WHERE "followerId" = :userId
  UNION SELECT :userId  -- 自分の投稿も含む
)
AND p."isDeleted" = false
ORDER BY p."createdAt" DESC
LIMIT :limit
```

**レスポンス例**:
```json
{
  "data": {
    "posts": [
      {
        "id": "cuid...",
        "author": {
          "id": "cuid...",
          "displayName": "山田太郎",
          "name": "yamada",
          "avatarUrl": null,
          "role": "AUTHOR"
        },
        "content": "第5話を公開しました。今回は主人公の過去が明らかに...",
        "postType": "ORIGINAL",
        "work": {
          "id": "cuid...",
          "title": "星降る夜に",
          "genre": "fantasy"
        },
        "replyCount": 3,
        "repostCount": 5,
        "applauseCount": 12,
        "bookmarkCount": 2,
        "hasApplauded": true,
        "hasBookmarked": false,
        "hasReposted": false,
        "createdAt": "2026-03-11T10:30:00Z"
      }
    ],
    "nextCursor": "cuid..."
  }
}
```

### 4.3 拍手 (Applause)

```
POST   /api/v1/posts/:id/applause      -- 拍手する
DELETE /api/v1/posts/:id/applause      -- 拍手取消
```

### 4.4 おすすめ (Repost)

```
POST   /api/v1/posts/:id/repost        -- おすすめ（リポスト）
DELETE /api/v1/posts/:id/repost        -- おすすめ取消
```

### 4.5 しおり (Bookmark)

```
POST   /api/v1/posts/:id/bookmark      -- しおりに追加
DELETE /api/v1/posts/:id/bookmark      -- しおりから削除
GET    /api/v1/bookmarks/posts         -- しおり一覧
```

### 4.6 ユーザープロフィール

```
GET /api/v1/users/:id                  -- 公開プロフィール
GET /api/v1/users/:id/posts            -- ユーザーの投稿
GET /api/v1/users/:id/posts/applause   -- ユーザーの拍手した投稿
GET /api/v1/users/:id/works            -- ユーザーの公開作品
GET /api/v1/users/:id/followers        -- フォロワー一覧
GET /api/v1/users/:id/following        -- フォロー中一覧
```

### 4.7 話題 (Trending)

```
GET /api/v1/trending/posts             -- 話題の投稿（拍手数ベース、24h）
GET /api/v1/trending/works             -- 話題の作品（投稿での言及数、24h）
```

---

## 5. フロントエンドUI設計

### 5.1 デザイン原則

- **Workwriteのカラーパレット**をそのまま使用（ベージュ系、ダーク対応）
- **Card コンポーネント**をベースに投稿カードを構築
- **フォント**: 本文は Inter/Noto Sans JP、引用テキストは Noto Serif JP
- **アイコン**: lucide-react のみ使用（外部絵文字ライブラリは使わない）
- **アニメーション**: 拍手時に軽いスケールアニメーション（`transition-transform`）
- **レスポンシブ**: モバイルファースト、`md:` でデスクトップ対応

### 5.2 投稿カード（PostCard）

Twitter的なレイアウトをWorkwriteのデザインで:

```
┌─────────────────────────────────────────────┐
│ [Avatar] 山田太郎 @yamada · 3時間前          │
│                                              │
│ 第5話を公開しました。今回は主人公の過去が     │
│ 明らかになります。ぜひ読んでください。        │
│                                              │
│ ┌─────────────────────────────────────────┐ │
│ │ 📖 星降る夜に                           │ │
│ │ ファンタジー · 全12話 · 3.2万字          │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ 💬 3    🔄 5    👏 12    🔖 2               │
│ 返信   おすすめ  拍手    しおり              │
└─────────────────────────────────────────────┘
```

**アクションバーのアイコン（lucide-react）**:
- 返信: `MessageCircle` — デフォルト色 muted-foreground
- おすすめ: `Repeat2` — おすすめ済みは `text-green-600`
- 拍手: `Heart` — 拍手済みは `text-red-500 fill-red-500`（視覚的にはハート。「拍手」という名前だが、UIは馴染みのあるハートアイコン）
- しおり: `Bookmark` — 保存済みは `fill-primary`

**注**: 「拍手」という概念名だが、アイコンはハート（Heart）を使用する。理由: ユーザーが最も慣れているインタラクション。呼称だけWorkwrite風にする。

### 5.3 投稿コンポーザー

```
┌─────────────────────────────────────────────┐
│ [Avatar] いまどうしてる？                     │
├─────────────────────────────────────────────┤
│                                              │
│ (テキストエリア / 最大500文字)               │
│                                              │
│                                              │
│ ┌───────────────────────────────────┐       │
│ │ 📖 作品を添付: 星降る夜に    ✕   │       │
│ └───────────────────────────────────┘       │
│                                              │
│ [📖作品] [📑エピソード] [✨ハイライト]  [投稿]│
│  添付     添付          引用       ボタン    │
└─────────────────────────────────────────────┘
```

**添付オプション**:
- 作品を添付: 自分の作品 or 他者の作品をWorkCardミニで埋め込み
- エピソードを添付: 特定のエピソードへのリンク
- ハイライトを引用: 自分の共有ハイライトからテキストを引用

### 5.4 ページ構成

#### タイムラインページ `/timeline`（メインフィード）

```
┌─────────────────────────────────────────────┐
│ [タブ] フォロー中 | おすすめ                  │
├─────────────────────────────────────────────┤
│ [投稿コンポーザー]                           │
├─────────────────────────────────────────────┤
│ [PostCard] ...                               │
│ [PostCard] ...                               │
│ [PostCard] ...                               │
│ (無限スクロール)                             │
└─────────────────────────────────────────────┘
```

- **フォロー中タブ**: フォロー中ユーザー + 自分の投稿を時系列で表示
- **おすすめタブ**: グローバルフィード（拍手数 + 新着のバランス）
- フォロー0人の場合: 「おすすめ」タブをデフォルト表示 + フォロー推奨UI

#### 投稿詳細ページ `/posts/[id]`

```
┌─────────────────────────────────────────────┐
│ ← 戻る                      ひとこと         │
├─────────────────────────────────────────────┤
│ [大きめのPostCard — 本文全表示]               │
│                                              │
│ 💬 3    🔄 5    👏 12    🔖 2               │
├─────────────────────────────────────────────┤
│ [返信コンポーザー]                           │
├─────────────────────────────────────────────┤
│ [返信PostCard] ...                           │
│ [返信PostCard] ...                           │
└─────────────────────────────────────────────┘
```

#### 公開プロフィールページ `/users/[id]`

```
┌─────────────────────────────────────────────┐
│ [大きめAvatar]                               │
│ 山田太郎                                     │
│ @yamada                                      │
│ 「ファンタジーと恋愛を書いています」          │
│                                              │
│ 12 フォロー中   48 フォロワー                │
│                                              │
│ [フォローする] ボタン                         │
├─────────────────────────────────────────────┤
│ [タブ] ひとこと | 作品 | 拍手                 │
├─────────────────────────────────────────────┤
│ [PostCard] ...                               │
│ [PostCard] ...                               │
│ (無限スクロール)                             │
└─────────────────────────────────────────────┘
```

**タブ内容**:
- **ひとこと**: ユーザーの投稿（おすすめ含む）
- **作品**: ユーザーの公開作品（WorkCardグリッド）
- **拍手**: ユーザーが拍手した投稿

#### しおりページ `/bookmarks`

```
┌─────────────────────────────────────────────┐
│ しおり                                       │
├─────────────────────────────────────────────┤
│ [PostCard] ...                               │
│ [PostCard] ...                               │
└─────────────────────────────────────────────┘
```

### 5.5 ナビゲーション変更

#### ボトムナビ（モバイル）

```
現在:  ホーム | 検索 | 本棚 | タイムライン | マイページ
変更:  ホーム | 検索 | 投稿 | タイムライン | マイページ
```

- **本棚**はマイページ内のタブに移動
- **投稿ボタン**を中央に配置（Twitter的な投稿導線）
- **タイムライン**は既存のアイコン位置を維持

投稿ボタン: 他と異なるスタイル（primary背景 + 丸アイコン）で目立たせる

#### ヘッダー（デスクトップ）

```
現在:  ロゴ | 検索 | 本棚 | タイムライン | 執筆 | 通知 | プロフ
変更:  ロゴ | 検索 | タイムライン | 本棚 | 執筆 | 通知 | プロフ
```

- タイムラインを検索の次に移動（SNSとしての重要度を上げる）

---

## 6. 自動投稿の仕組み

既存のアクションに連動して自動的に投稿が生成される。

### 6.1 自動投稿のトリガー

| アクション | 自動投稿の内容 | PostType | 制御 |
|---|---|---|---|
| 作品を公開 | 「新作『{title}』を公開しました」+ WorkCard | AUTO_WORK | 常に生成 |
| エピソードを公開 | 「『{work.title}』第{n}話「{title}」を公開しました」 | AUTO_EPISODE | 常に生成 |
| レビューを投稿 | 「『{work.title}』にレビューを投稿しました」+ レビュー冒頭 | AUTO_REVIEW | ユーザー設定で制御可 |
| 作品を読了 | 「『{work.title}』を読了しました」 | AUTO_READING | ユーザー設定で制御可 |

### 6.2 自動投稿の表示

自動投稿は通常の投稿と同じカードで表示するが、`postType`に応じて:
- 上部に小さく「📖 作品を公開しました」等のラベルを表示
- 削除可能（作家が投稿を消したい場合）
- 拍手・おすすめ・返信も通常通り可能

### 6.3 ユーザー設定

```
設定 > SNS連携
☑ レビュー投稿時にタイムラインに自動投稿する
☑ 作品読了時にタイムラインに自動投稿する
```

---

## 7. 通知連携

### 7.1 新規通知タイプ

| イベント | 通知タイプ | 通知文 | 集約 |
|---|---|---|---|
| 拍手された | `post_applause` | 「{name}さんがあなたのひとことに拍手しました」 | 5件ごとに集約 |
| おすすめされた | `post_repost` | 「{name}さんがあなたのひとことをおすすめしました」 | 個別 |
| 返信された | `post_reply` | 「{name}さんが返信しました: {冒頭30字}」 | 個別 |
| フォローされた | `follow` | 「{name}さんにフォローされました」 | 個別 |
| 引用おすすめ | `post_quote` | 「{name}さんがあなたのひとことを引用しました」 | 個別 |

### 7.2 集約通知

拍手は短時間に大量に来る可能性があるため集約する:
- 5件以上の拍手が1時間以内にあった場合: 「{name}さん他{n}人があなたのひとことに拍手しました」
- 既存の `notifications.service.ts` に集約ロジックを追加

---

## 8. バックエンドモジュール構成

### 8.1 新規モジュール

```
src/posts/
  posts.module.ts
  posts.service.ts
  posts.controller.ts
  dto/
    create-post.dto.ts
    post-query.dto.ts

src/timeline/
  timeline.module.ts
  timeline.service.ts
  timeline.controller.ts
```

**設計判断**: PostsモジュールとTimelineモジュールを分離する。
- `PostsService`: 投稿のCRUD、拍手、おすすめ、しおり
- `TimelineService`: フィード生成、トレンド計算

### 8.2 PostsService

```typescript
class PostsService {
  // 投稿CRUD
  create(userId, dto): Promise<Post>
  findById(id, viewerId?): Promise<PostWithMeta>
  delete(id, userId): Promise<void>

  // 拍手
  applaud(postId, userId): Promise<void>
  removeApplause(postId, userId): Promise<void>

  // おすすめ
  repost(postId, userId): Promise<Post>
  removeRepost(postId, userId): Promise<void>

  // しおり
  bookmark(postId, userId): Promise<void>
  removeBookmark(postId, userId): Promise<void>
  getBookmarks(userId, cursor?, limit?): Promise<Post[]>

  // 返信
  getReplies(postId, cursor?, limit?): Promise<Post[]>

  // 自動投稿（他のサービスから呼ばれる）
  createAutoPost(userId, type, data): Promise<Post>

  // ユーザーの投稿
  getUserPosts(userId, cursor?, limit?): Promise<Post[]>
  getUserApplaudedPosts(userId, cursor?, limit?): Promise<Post[]>
}
```

### 8.3 TimelineService

```typescript
class TimelineService {
  // タイムライン
  getFollowingTimeline(userId, cursor?, limit?): Promise<TimelineResult>
  getGlobalTimeline(cursor?, limit?): Promise<TimelineResult>

  // トレンド
  getTrendingPosts(limit?): Promise<Post[]>
  getTrendingWorks(limit?): Promise<Work[]>
}
```

### 8.4 既存サービスへの変更

自動投稿の呼び出しを追加:

| サービス | メソッド | 追加処理 |
|---|---|---|
| `works.service.ts` | publish時 | `postsService.createAutoPost(userId, 'AUTO_WORK', { workId })` |
| `episodes.controller.ts` | publish() | `postsService.createAutoPost(userId, 'AUTO_EPISODE', { workId, episodeId })` |
| `reviews.service.ts` | create時 | `postsService.createAutoPost(userId, 'AUTO_REVIEW', { workId, reviewText })` |
| `bookshelf.service.ts` | status→COMPLETED時 | `postsService.createAutoPost(userId, 'AUTO_READING', { workId })` |
| `follows.service.ts` | follow() | `notificationsService.create(followingId, { type: 'follow', ... })` |

---

## 9. パフォーマンス設計

### 9.1 タイムラインクエリの最適化

**プルモデル（Phase 1で採用）**:
- フォロー中ユーザーIDをIN句で指定してPostを取得
- フォロー数 < 500 の場合は十分高速
- インデックス: `Post(authorId, createdAt)` + `Follow(followerId)`

**将来のプッシュモデル（ユーザー増加時）**:
- 投稿時にフォロワー全員のタイムラインテーブルに書き込む（ファンアウトオンライト）
- 現時点では不要

### 9.2 カウンターの非正規化

`Post`テーブルに`replyCount`, `repostCount`, `applauseCount`, `bookmarkCount`を直接保持。
- 拍手/おすすめ操作時に `$transaction` 内で `increment`/`decrement`
- JOINやSUBQUERYなしでカウントを表示可能

### 9.3 インデックス設計

```
Post(authorId, createdAt)    -- ユーザーの投稿一覧
Post(createdAt)              -- グローバルタイムライン
Post(replyToId)              -- 返信の取得
Post(threadRootId)           -- スレッド表示
Post(workId)                 -- 作品に言及した投稿
Applause(userId, postId)     -- ユニーク制約 + 存在チェック
Applause(postId)             -- 投稿の拍手一覧
PostBookmark(userId, createdAt) -- しおり一覧
```

---

## 10. 実装フェーズ

### Phase 1: コアSNS機能（最優先）

**目標**: Twitter的な投稿・タイムライン・拍手・返信が動作する状態

| タスク | 工数 | 依存 |
|---|---|---|
| 1-1. DB設計（Post, Applause, PostBookmark） | 0.5日 | なし |
| 1-2. PostsService + Controller | 2日 | 1-1 |
| 1-3. TimelineService + Controller | 1日 | 1-1 |
| 1-4. PostCard コンポーネント | 1.5日 | なし |
| 1-5. タイムラインページ `/timeline` | 1日 | 1-3, 1-4 |
| 1-6. 投稿コンポーザー | 1日 | 1-2, 1-4 |
| 1-7. 投稿詳細ページ `/posts/[id]` | 1日 | 1-2, 1-4 |
| 1-8. ナビゲーション変更 | 0.5日 | 1-5 |
| **小計** | **8.5日** | |

### Phase 2: プロフィール & ソーシャル連携

| タスク | 工数 | 依存 |
|---|---|---|
| 2-1. 公開プロフィールページ `/users/[id]` | 1.5日 | Phase 1 |
| 2-2. フォロワー/フォロー一覧ページ | 0.5日 | 2-1 |
| 2-3. 自動投稿の実装（作品/エピソード公開連携） | 1日 | Phase 1 |
| 2-4. しおりページ `/bookmarks` | 0.5日 | Phase 1 |
| 2-5. 通知連携（拍手/おすすめ/返信/フォロー） | 1日 | Phase 1 |
| 2-6. 作品詳細ページの作家リンク化 | 0.5日 | 2-1 |
| **小計** | **5日** | |

### Phase 3: 発見 & エンゲージメント

| タスク | 工数 | 依存 |
|---|---|---|
| 3-1. おすすめタブ（グローバルフィード） | 1日 | Phase 1 |
| 3-2. 話題の投稿/作品 | 1日 | Phase 1 |
| 3-3. ハイライト引用投稿 | 1日 | Phase 1 |
| 3-4. 読了報告/レビュー自動投稿 | 1日 | Phase 2 |
| 3-5. ユーザー設定（自動投稿の制御） | 0.5日 | 3-4 |
| **小計** | **4.5日** | |

**合計: 約18日**

---

## 11. テスト計画

### ユニットテスト

| サービス | テスト内容 |
|---|---|
| PostsService | 投稿CRUD、500字制限、論理削除、権限チェック |
| PostsService | 拍手の追加/取消/カウント更新、unique制約 |
| PostsService | おすすめの作成/取消/カウント更新、自己おすすめ防止 |
| PostsService | 返信スレッドの取得、threadRootId設定 |
| PostsService | 自動投稿の各PostType生成 |
| TimelineService | フォロータイムライン（フォロー中+自分）、カーソルページネーション |
| TimelineService | グローバルタイムライン、削除済み投稿の除外 |

### 統合テスト

| フロー | 内容 |
|---|---|
| 投稿 → フィード | ユーザーA投稿 → フォロワーBのタイムラインに表示 |
| 拍手 → カウント → 通知 | Bが拍手 → Post.applauseCount+1 → A に通知 |
| エピソード公開 → 自動投稿 | エピソード公開API → 自動Post作成 → フォロワーのTLに表示 |
| おすすめ → 展開 | BがAの投稿をおすすめ → Bのフォロワーのタイムラインに表示 |

---

## 12. ファイル一覧

### バックエンド新規

| ファイル | Phase | 内容 |
|---|---|---|
| `src/posts/posts.module.ts` | 1 | Postsモジュール |
| `src/posts/posts.service.ts` | 1 | 投稿CRUD、拍手、おすすめ、しおり |
| `src/posts/posts.controller.ts` | 1 | 投稿API |
| `src/posts/dto/create-post.dto.ts` | 1 | 投稿作成DTO |
| `src/posts/dto/post-query.dto.ts` | 1 | クエリパラメータDTO |
| `src/timeline/timeline.module.ts` | 1 | タイムラインモジュール |
| `src/timeline/timeline.service.ts` | 1 | フィード生成、トレンド |
| `src/timeline/timeline.controller.ts` | 1 | タイムラインAPI |

### フロントエンド新規

| ファイル | Phase | 内容 |
|---|---|---|
| `components/posts/post-card.tsx` | 1 | 投稿カード |
| `components/posts/post-card-skeleton.tsx` | 1 | ローディング |
| `components/posts/post-composer.tsx` | 1 | 投稿フォーム |
| `components/posts/post-actions.tsx` | 1 | アクションバー（拍手/おすすめ/返信/しおり） |
| `components/posts/work-embed.tsx` | 1 | 作品埋め込みカード（ミニWorkCard） |
| `components/posts/highlight-embed.tsx` | 3 | ハイライト引用カード |
| `components/posts/repost-indicator.tsx` | 1 | 「{name}さんがおすすめ」表示 |
| `components/timeline/timeline-feed.tsx` | 1 | 無限スクロールフィード |
| `components/timeline/timeline-tabs.tsx` | 1 | フォロー中/おすすめタブ |
| `app/timeline/page.tsx` | 1 | タイムラインページ |
| `app/posts/[id]/page.tsx` | 1 | 投稿詳細+返信スレッド |
| `app/users/[id]/page.tsx` | 2 | 公開プロフィール |
| `app/users/[id]/followers/page.tsx` | 2 | フォロワー一覧 |
| `app/users/[id]/following/page.tsx` | 2 | フォロー中一覧 |
| `app/bookmarks/page.tsx` | 2 | しおり一覧 |

### 既存ファイル変更

| ファイル | Phase | 変更 |
|---|---|---|
| `prisma/schema.prisma` | 1 | Post, Applause, PostBookmark追加、User/Work/Episode/Highlightリレーション |
| `src/app.module.ts` | 1 | PostsModule, TimelineModule登録 |
| `src/episodes/episodes.controller.ts` | 2 | publish時に自動投稿 |
| `src/works/works.service.ts` | 2 | 公開時に自動投稿 |
| `src/reviews/reviews.service.ts` | 3 | レビュー投稿時に自動投稿 |
| `src/bookshelf/bookshelf.service.ts` | 3 | 読了時に自動投稿 |
| `src/follows/follows.service.ts` | 2 | フォロー通知追加 |
| `src/notifications/notifications.service.ts` | 2 | 集約通知、新タイプ |
| `frontend/src/lib/api.ts` | 1 | 投稿/TL/拍手等のAPIメソッド |
| `frontend/src/components/layout/bottom-nav.tsx` | 1 | 投稿ボタン追加、本棚移動 |
| `frontend/src/components/layout/header.tsx` | 1 | ナビ順序変更 |
| `frontend/src/app/works/[id]/page.tsx` | 2 | 作家名リンク化 |
| `frontend/src/components/work-card.tsx` | 2 | 作家名リンク化 |

---

## 13. 成功基準

### Phase 1 完了時
- [ ] テキスト投稿の作成・表示・削除が動作する
- [ ] フォロー中タイムラインに投稿が時系列で表示される
- [ ] 拍手の追加/取消がリアルタイムでカウントに反映される
- [ ] おすすめ（リポスト）が自分のタイムラインに表示される
- [ ] 返信スレッドが投稿詳細ページで表示される
- [ ] しおり（ブックマーク）の保存/一覧が動作する
- [ ] 作品を添付した投稿でWorkCardミニが表示される
- [ ] モバイルボトムナビに投稿ボタンがある
- [ ] 無限スクロールが動作する

### Phase 2 完了時
- [ ] 公開プロフィールページが動作する
- [ ] 作品公開/エピソード公開時に自動投稿が生成される
- [ ] 拍手/おすすめ/返信/フォローの通知が届く
- [ ] フォロワー/フォロー中一覧ページが動作する

### Phase 3 完了時
- [ ] おすすめタブ（グローバルフィード）が動作する
- [ ] ハイライト引用投稿が動作する
- [ ] 読了報告/レビュー自動投稿が動作する
- [ ] 自動投稿のON/OFF設定が可能

---

## 14. リスクと軽減策

| リスク | 影響度 | 軽減策 |
|---|---|---|
| タイムラインクエリの遅延 | 高 | IN句+インデックスで対応。フォロー500人上限。将来プッシュモデル |
| Post テーブルの肥大化 | 中 | カーソルページネーション。isDeleted の定期パージ |
| 自己おすすめ・自己拍手 | 低 | サービス層でバリデーション |
| スパム投稿 | 中 | レートリミット（1分5投稿）。連続投稿検知 |
| 初期ユーザー少数でTLが寂しい | 中 | おすすめタブをデフォルト。運営アカウントでシード投稿 |

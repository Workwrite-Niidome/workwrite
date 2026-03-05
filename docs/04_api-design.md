# 超読者ファースト API設計書

## 1. API規約

- REST API（主要CRUD） + GraphQL（複雑な読み取りクエリ）
- ベースURL: `/api/v1/`
- 認証: Bearer Token (JWT)
- レスポンス形式: JSON
- ページネーション: Cursor-based
- エラー形式: `{ error: { code, message, details } }`

## 2. エンドポイント一覧

### Auth（認証）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | /auth/register | メール登録 | - |
| POST | /auth/login | ログイン | - |
| POST | /auth/oauth/:provider | OAuth認証 | - |
| POST | /auth/refresh | トークン更新 | JWT |
| POST | /auth/logout | ログアウト | JWT |

### Users（ユーザー）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | /users/me | 自分のプロフィール | JWT |
| PATCH | /users/me | プロフィール更新 | JWT |
| POST | /users/me/onboarding | オンボーディング結果保存 | JWT |
| GET | /users/:id | ユーザー公開プロフィール | - |
| POST | /users/:id/follow | フォロー | JWT |
| DELETE | /users/:id/follow | フォロー解除 | JWT |

### Works（作品）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | /works | 作品一覧（検索・フィルター） | - |
| GET | /works/:id | 作品詳細 | - |
| POST | /works | 作品作成 | JWT(Author) |
| PATCH | /works/:id | 作品更新 | JWT(Author/Owner) |
| DELETE | /works/:id | 作品削除 | JWT(Author/Owner) |
| GET | /works/:id/quality-score | 品質スコア | - |

### Episodes（エピソード）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | /works/:workId/episodes | エピソード一覧 | - |
| GET | /episodes/:id | エピソード本文取得 | JWT* |
| POST | /works/:workId/episodes | エピソード投稿 | JWT(Author) |
| PATCH | /episodes/:id | エピソード更新 | JWT(Author) |
| DELETE | /episodes/:id | エピソード削除 | JWT(Author) |

### Reading（読書）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | /reading/progress | 読書進捗バッチ送信 | JWT |
| GET | /reading/bookshelf | 本棚取得 | JWT |
| POST | /reading/bookshelf | 本棚に追加 | JWT |
| PATCH | /reading/bookshelf/:workId | ステータス変更 | JWT |
| POST | /reading/highlights | ハイライト保存 | JWT |
| GET | /reading/highlights/:workId | ハイライト一覧 | JWT |

### Discovery（発見）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | /discover/emotion-state | 感情状態ベース探索 | JWT |
| GET | /discover/emotion-tags | 感情タグ検索 | - |
| GET | /discover/search | 従来型検索 | - |
| GET | /discover/recommend | パーソナライズドレコメンド | JWT |
| GET | /discover/destiny | 「運命の一冊」 | JWT |
| GET | /discover/trending | トレンド作品 | - |

### Emotions（感情タグ）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | /emotions | 感情タグ投稿（読後） | JWT |
| GET | /emotions/work/:workId | 作品の感情タグ集計 | - |
| GET | /emotions/me/timeline | 自分の感情タイムライン | JWT |

### Reviews（レビュー・省察）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | /reviews | レビュー投稿 | JWT |
| GET | /reviews/work/:workId | 作品のレビュー一覧 | - |
| POST | /reviews/:id/helpful | 参考になった | JWT |
| POST | /reflection/state-change | 状態変化記録 | JWT |

### Scoring（品質スコア）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | /scoring/work/:workId | 品質スコア詳細 | JWT(Author) |
| GET | /scoring/work/:workId/report | 改善提案レポート | JWT(Author) |

### Analytics（作家ダッシュボード）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | /analytics/overview | ダッシュボード概要 | JWT(Author) |
| GET | /analytics/work/:workId/readthrough | 読了率分析 | JWT(Author) |
| GET | /analytics/work/:workId/emotions | 感情タグ分析 | JWT(Author) |
| GET | /analytics/work/:workId/engagement | エンゲージメント | JWT(Author) |
| GET | /analytics/earnings | 収益情報 | JWT(Author) |

### Payments（決済）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| POST | /payments/subscribe | プレミアムプラン登録 | JWT |
| DELETE | /payments/subscribe | プラン解約 | JWT |
| POST | /payments/tip | 投げ銭 | JWT |
| POST | /payments/episode/:id/purchase | エピソード購入 | JWT |
| POST | /payments/webhook | Stripe Webhook | Stripe Sig |

### Points（ポイント）

| Method | Path | 説明 | 認証 |
|--------|------|------|------|
| GET | /points/balance | ポイント残高 | JWT |
| GET | /points/history | ポイント履歴 | JWT |
| POST | /points/redeem | ポイント交換 | JWT |

# 超読者ファースト システムアーキテクチャ

## 1. 全体構成

```
                    [Cloudflare CDN]
                          |
                    [Next.js Frontend]
                     (SSR/SSG/CSR)
                          |
                    [API Gateway]
                     (NestJS API)
                    /     |     \
            [PostgreSQL] [Redis] [Meilisearch]
                          |
                  [Job Queue (Bull)]
                    /           \
        [AI Scoring Worker]  [Notification Worker]
              |
        [Claude API]
```

## 2. モジュール構成（バックエンド）

```
src/
  auth/           # 認証・認可（OAuth, JWT, RBAC）
  users/          # ユーザー管理
  works/          # 作品管理
  episodes/       # エピソード管理
  reading/        # 読書進捗・ハイライト・メモ
  discovery/      # 発見システム（検索・感情タグ）
  emotions/       # 感情タグ管理
  reviews/        # レビュー・省察
  scoring/        # AI品質スコアリング
  recommend/      # レコメンドエンジン
  payments/       # 決済・サブスク・投げ銭
  points/         # ポイントシステム
  crowdfund/      # クラウドファンディング
  analytics/      # 分析・ダッシュボードデータ
  notifications/  # 通知
  common/         # 共通（ガード、インターセプター、DTO）
```

## 3. フロントエンド構成

```
app/
  (auth)/
    login/            # ログイン
    register/         # 新規登録
    onboarding/       # オンボーディング診断
  (reader)/
    page.tsx          # トップページ（発見システム）
    discover/         # 感情状態ベース探索
    search/           # 検索結果
    works/[id]/       # 作品詳細
    read/[episodeId]/ # リーダービューア
    bookshelf/        # 本棚
    reflection/       # 省察タイムライン
    profile/          # プロフィール
    premium/          # プレミアムプラン
  (author)/
    dashboard/        # 作家ダッシュボード
    works/            # 作品管理
    works/new/        # 新規投稿
    works/[id]/edit/  # 編集
    analytics/        # 分析
    earnings/         # 収益
  (admin)/
    ...               # 管理画面
```

## 4. データフロー

### 読書行動データ収集
```
Reader -> Frontend (scroll/read events)
  -> API (batch, debounced every 30s)
    -> Redis Streams (event buffer)
      -> Worker (aggregate)
        -> PostgreSQL (ReadingProgress)
        -> Meilisearch (index update)
```

### AI品質スコアリング
```
Author posts Episode
  -> API saves to DB
    -> Bull Queue (scoring job)
      -> Scoring Worker
        -> Claude API (text analysis)
        -> Score calculation
          -> PostgreSQL (QualityScore)
          -> Meilisearch (score update)
```

### レコメンド生成
```
Daily Batch Job:
  PostgreSQL (user data, emotions, progress)
    -> Recommendation Engine
      -> Layer 1: State matching (emotion vectors)
      -> Layer 2: Transformation path matching
      -> Layer 3: Collaborative filtering
      -> Layer 4: Quality score filter
        -> Redis (cached recommendations per user)

Request time:
  User request -> API -> Redis cache -> Response (< 1s)
```

## 5. インフラ構成（MVP）

### Docker Compose（開発環境）
```yaml
services:
  frontend:     Next.js (port 3000)
  backend:      NestJS (port 3001)
  postgres:     PostgreSQL 16 (port 5432)
  redis:        Redis 7 (port 6379)
  meilisearch:  Meilisearch (port 7700)
```

### 本番環境（MVP段階）
- Vercel (Frontend) + Railway/Render (Backend)
- Supabase または Neon (PostgreSQL)
- Upstash (Redis)
- Meilisearch Cloud
- 成長期以降: AWS/GCP + Kubernetes に移行

## 6. セキュリティ設計

| レイヤー | 対策 |
|----------|------|
| 認証 | NextAuth.js + OAuth 2.0 (Google/X/Apple) |
| 認可 | JWT + ロールベースアクセス制御 (RBAC) |
| API | Rate Limiting、CORS、Helmet.js |
| データ | 個人情報暗号化、SQLインジェクション防止(Prisma) |
| 決済 | Stripe (PCI DSS準拠)、Webhook署名検証 |
| 通信 | HTTPS強制、CSP headers |
| インフラ | 環境変数管理(Vault/Secrets)、最小権限原則 |

## 7. 監視・ログ

| ツール | 用途 |
|--------|------|
| Sentry | エラートラッキング（Frontend + Backend） |
| Grafana + Prometheus | メトリクス監視（応答時間、エラー率） |
| Structured Logging (pino) | アプリケーションログ |
| Uptime Robot | 外部死活監視 |

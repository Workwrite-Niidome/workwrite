# 超読者ファースト 開発要件定義書

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| プロジェクト名 | 超読者ファーストプラットフォーム（Ultra Reader First Platform） |
| ミッション | 「人生を変える一冊に、出会える。」 |
| プラットフォーム | Webアプリケーション（レスポンシブ、モバイルファースト） |
| 対象コンテンツ | 小説（ライトノベル・文芸・エンタメ全般） |
| 対象市場 | 日本市場優先 |

## 2. 技術スタック

| レイヤー | 技術 | 備考 |
|----------|------|------|
| フロントエンド | Next.js (React) + TypeScript | SSR/SSG、モバイルファースト |
| バックエンドAPI | Node.js (NestJS) または Python (FastAPI) | REST API + GraphQL |
| データベース | PostgreSQL + Redis | トランザクション管理 + キャッシュ |
| 検索エンジン | Meilisearch | 全文検索・感情タグ検索 |
| AI/MLパイプライン | Python + LLM API (Claude) | 品質スコアリング・レコメンド |
| イベントストリーミング | Apache Kafka | 読書行動のリアルタイム収集 |
| オブジェクトストレージ | AWS S3 / GCS | コンテンツ・画像保管 |
| インフラ | Docker + Kubernetes | コンテナオーケストレーション |
| CI/CD | GitHub Actions + Terraform | 自動テスト・自動デプロイ |
| モニタリング | Grafana + Prometheus | パフォーマンス監視 |

### 技術選定の判断（推奨）

- **バックエンド: NestJS (TypeScript)** を推奨
  - フロントエンドと言語統一（TypeScript）により開発効率向上
  - 型安全なAPI定義の共有が容易
  - GraphQL統合が成熟している
- **検索: Meilisearch** を推奨
  - Elasticsearchより軽量でセットアップが簡単
  - 日本語トークナイズ対応
  - MVP段階に適切なスケール
- **イベントストリーミング: Phase 1ではRedis Streams** で代替
  - Kafkaは成長期（Phase 2）で導入
  - MVP段階ではオーバースペック

## 3. ユーザーロールと権限

| ロール | 権限 |
|--------|------|
| 読者（ライト） | 作品閲覧、感情タグ入力、基本レコメンド |
| 読者（コア/プレミアム） | 上記 + 高度レコメンド、省察フルアクセス |
| 作家 | 作品投稿・管理、ダッシュボード閲覧、収益管理 |
| 編集者 | 担当作家のデータ閲覧、品質スコア詳細 |
| 管理者 | 全機能、コンテンツ管理、システム設定 |

## 4. 非機能要件

| カテゴリ | 要件 | 基準値 |
|----------|------|--------|
| パフォーマンス | ページロード | 初回2秒以内、遷移500ms以内 |
| パフォーマンス | リーダー応答 | スクロール60fps、ページ送り200ms以内 |
| パフォーマンス | AIスコアリング | 投稿から60分以内にスコア反映 |
| パフォーマンス | レコメンド応答 | 1秒以内 |
| 可用性 | 稼働率 | 99.9%以上 |
| スケーラビリティ | 同時接続 | MVP: 1,000 / 成長期: 100,000 |
| セキュリティ | 認証 | OAuth 2.0 + JWT、RBAC |
| セキュリティ | データ保護 | 暗号化、GDPR/個人情報保護法準拠 |
| セキュリティ | 決済 | PCI DSS準拠、Stripe利用 |
| アクセシビリティ | WCAG 2.1 | AAレベル準拠 |
| 国際化 | 言語 | 初期: 日本語、将来: 英語・中国語・韓国語 |

## 5. データモデル（主要エンティティ）

```
User
  id, name, email, role, onboarding_state, created_at
  has_many: ReadingProgress, EmotionTag, Review, Point

Work
  id, title, author_id, status, quality_score, genre_tags, emotion_tags_author
  belongs_to: User(Author), has_many: Episode, EmotionTag, QualityScore

Episode
  id, work_id, title, content, order, published_at
  belongs_to: Work, has_many: ReadingProgress

ReadingProgress
  id, user_id, episode_id, progress_pct, read_time, completed_at
  belongs_to: User, Episode

EmotionTag
  id, user_id, work_id, tag_type, intensity, created_at
  belongs_to: User, Work

Review
  id, user_id, work_id, body, emotion_tags, effectiveness_score
  belongs_to: User, Work

QualityScore
  id, work_id, immersion, transformation, virality, worldbuilding, composite
  belongs_to: Work

RecommendationLog
  id, user_id, work_id, algorithm_layer, clicked, completed
  belongs_to: User, Work

CrowdfundProject
  id, work_id, goal_amount, current_amount, status
  belongs_to: Work, has_many: Pledge

Point
  id, user_id, amount, source, redeemed_at
  belongs_to: User
```

## 6. 外部連携

| サービス | 用途 |
|----------|------|
| Google / X / Apple | ソーシャルログイン (OAuth) |
| Stripe | 決済（サブスク・課金・投げ銭） |
| Claude API | AI品質スコアリング・レコメンド |
| SNS API (X等) | シェア機能連携 |

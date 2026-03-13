# Workwrite

「人生を変える一冊に、出会える。」

世界を席巻する作品を輩出する次世代小説プラットフォーム。作家の自己表現と読者の潜在ニーズをAIにより調和させ、読後の自己変容を設計するエコシステム。

## Core Concepts

- **いい作品が生まれる** - AI品質スコアリングによる客観的評価と作家へのフィードバック
- **いい作品が埋もれない** - 品質スコアが高いが認知が低い作品を自動ブースト
- **最高の作品に出会える** - 感情状態ベースのパーソナライズドレコメンド

## Features

### 読者向け
- 本棚管理（読みたい・読書中・読了）
- レビュー・感想文投稿
- 感情タグによる作品評価
- AI読書コンパニオン（作品についての対話）
- AIレコメンデーション
- ハイライト・メモ機能
- SNSタイムライン（投稿・リポスト・引用）

### 作家向け
- リッチテキストエディタ（作品・エピソード管理）
- AI執筆アシスト（続き書き・キャラ深掘り・校正など8種類）
- Creation Wizard（キャラクター・プロット・感情設計・章立てをAIで生成）
- AI品質スコアリング（文章力・構成力・独創性など多軸評価）

### プラットフォーム
- 招待制ベータ登録
- クレジットベース課金（Free / Standard / Pro）
- Stripe連携（サブスクリプション・クレジット追加購入）
- 管理者ダッシュボード

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 + React 19 + TypeScript |
| Backend | NestJS 11 + TypeScript |
| ORM | Prisma 6 |
| Database | PostgreSQL 16 + Redis 7 |
| Search | Meilisearch |
| AI | Claude API (Sonnet / Opus / Haiku) |
| Payment | Stripe (Checkout, Webhooks, Customer Portal) |
| Infra | Docker |

## Project Structure

```
apps/
  backend/          # NestJS API server (port 3001)
    prisma/         # Schema & migrations
    src/
      admin/        # Admin dashboard API
      ai-assist/    # AI writing assistant
      ai-insights/  # AI reading insights
      ai-recommendations/  # AI-powered recommendations
      ai-settings/  # AI tier & credit cost management
      auth/         # Authentication (JWT, OAuth, invite codes)
      billing/      # Credit system & Stripe integration
      creation-wizard/  # AI-powered story creation
      episodes/     # Episode management
      works/        # Work management
      ...
  frontend/         # Next.js web app (port 3000)
    src/
      app/          # App Router pages
      components/   # React components
      lib/          # API client & utilities
```

## Development

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL, Redis, Meilisearch)

### Setup

```bash
# Install dependencies
npm install

# Start infrastructure
docker compose up -d

# Setup database
cd apps/backend
cp .env.example .env  # Edit with your values
npx prisma migrate dev
npx prisma db seed

# Start development servers
npm run dev  # Backend (port 3001)
cd ../frontend && npm run dev  # Frontend (port 3000)
```

### Stripe Setup (Optional)

See [Stripe Setup Guide](docs/stripe-setup.md) for payment system configuration.

### Credit System

| Plan | Monthly Credits | Price |
|------|----------------|-------|
| Free | 20cr | 無料 |
| Standard | 200cr | 月額 2,980円 |
| Pro | 600cr | 月額 7,980円 |

| AI Feature | Credit Cost |
|------------|-------------|
| スコアリング・インサイト・レコメンド | 0cr |
| AI読書コンパニオン | 0cr (Free: 週5回) |
| AI執筆アシスト (通常) | 1cr |
| AI執筆アシスト (じっくり) | 2cr |
| AI執筆アシスト (高精度) | 5cr |
| Creation Wizard (各ステップ) | 1cr |

## Documentation

- [Development Requirements](docs/01_development-requirements.md)
- [Task Breakdown](docs/02_task-breakdown.md)
- [Architecture](docs/03_architecture.md)
- [API Design](docs/04_api-design.md)
- [Screen List](docs/05_screen-list.md)
- [Risk & Mitigation](docs/06_risk-mitigation.md)
- [WBS & Gantt](docs/07_wbs-gantt.md)
- [Reader Experience AI Integration](docs/08_reader-experience-ai-integration.md)
- [Writing Experience AI Integration](docs/08_writing-experience-ai-integration.md)
- [Billing Requirements](docs/billing-requirements.md)
- [Stripe Setup Guide](docs/stripe-setup.md)
- [SNS Implementation Plan](docs/sns-implementation-plan.md)

## License

Private - All rights reserved.

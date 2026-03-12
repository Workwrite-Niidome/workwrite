# Stripe課金システム セットアップガイド

## 1. Stripeダッシュボードでの準備

### 1-1. Productと Price の作成

Stripe Dashboard > Products で以下を作成:

#### サブスクリプション商品

| Product名 | Price | 間隔 | 用途 |
|---|---|---|---|
| Workwrite Standard | ¥2,980 | 月額 | STRIPE_STANDARD_PRICE_ID |
| Workwrite Pro | ¥7,980 | 月額 | STRIPE_PRO_PRICE_ID |

#### クレジット追加購入（一回限り）

| Product名 | Price | 用途 |
|---|---|---|
| Workwrite Credits (Standard) | ¥980 | STRIPE_CREDIT_PURCHASE_STANDARD_PRICE_ID |
| Workwrite Credits (Pro) | ¥880 | STRIPE_CREDIT_PURCHASE_PRO_PRICE_ID |

### 1-2. Webhook の設定

Stripe Dashboard > Developers > Webhooks > Add endpoint

- **URL**: `https://api.workwrite.jp/api/v1/billing/webhook`
  - ローカルテスト時: Stripe CLIを使用（後述）
- **対象イベント**:
  - `checkout.session.completed`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

作成後に表示される Signing secret を `STRIPE_WEBHOOK_SECRET` に設定。

### 1-3. Customer Portal の設定

Stripe Dashboard > Settings > Billing > Customer portal

- 支払い方法の変更: 有効
- サブスクリプションのキャンセル: 有効
- プランの変更: 無効（アプリ内で制御）

## 2. 環境変数の設定

### ローカル開発 (`apps/backend/.env`)

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STANDARD_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_CREDIT_PURCHASE_STANDARD_PRICE_ID=price_...
STRIPE_CREDIT_PURCHASE_PRO_PRICE_ID=price_...
FRONTEND_URL=http://localhost:3000
```

### 本番 (VPS / Docker)

同じ変数を本番用の値で設定。`sk_test_` → `sk_live_` に変更。

## 3. DBマイグレーション

```bash
# ローカル
cd apps/backend
npx prisma migrate dev --name add_credit_billing_system

# 本番
npx prisma migrate deploy

# 既存ユーザーにCreditBalance付与 + premium→proマイグレーション
npx prisma db seed
```

## 4. ローカルWebhookテスト

### Stripe CLI のインストールと使用

```bash
# インストール (Windows)
scoop install stripe

# ログイン
stripe login

# ローカルにWebhookを転送
stripe listen --forward-to localhost:3001/api/v1/billing/webhook

# 別ターミナルでテストイベント送信
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger customer.subscription.deleted
```

`stripe listen` 実行時に表示される `whsec_...` を `.env` の `STRIPE_WEBHOOK_SECRET` に設定。

## 5. 動作確認チェックリスト

### サブスクリプション

- [ ] Free → Standard アップグレード（Checkout → 成功ページ → クレジット付与）
- [ ] Free → Pro アップグレード
- [ ] トライアル開始（7日間、クレジット付与確認）
- [ ] トライアル終了後の自動課金（invoice.paid → クレジット再付与）
- [ ] 解約（cancelAtPeriodEnd → 期間終了後にFreeに戻る）
- [ ] 支払い失敗（past_due状態になる）

### クレジット

- [ ] AI執筆アシスト（通常）: 1cr消費
- [ ] AI執筆アシスト（じっくり）: 2cr消費
- [ ] AI執筆アシスト（高精度）: 5cr消費
- [ ] Creation Wizard（各ステップ）: 1cr消費
- [ ] API呼び出し失敗時: REFUND（残高復元）
- [ ] 残高不足時: エラー + アップグレード導線
- [ ] 0cr機能（スコアリング等）: 消費なし
- [ ] クレジット追加購入（Standard ¥980/100cr, Pro ¥880/100cr）

### フロントエンド

- [ ] 課金設定ページ: 残高・プラン・取引履歴表示
- [ ] 料金ページ: Checkout連携
- [ ] AI assist panel: 残高・消費量プレビュー
- [ ] Stripeカスタマーポータル遷移

## 6. 本番デプロイ時の注意

### Cloudflare Tunnel経由の場合

cloudflared の config に API ルートが含まれていることを確認:
```yaml
ingress:
  - hostname: api.workwrite.jp
    service: http://localhost:3001
```

### Raw Body

Stripe Webhook署名検証にはリクエストのraw bodyが必要。
`main.ts` で `/api/v1/billing/webhook` パスに `express.raw()` ミドルウェアを設定済み。

### 冪等性

- `invoice.paid`: invoice IDで重複チェック済み
- `addPurchasedCredits`: stripePaymentIntentIdで重複チェック済み
- Stripe側のイベント再送（最大3回）に対応

## 7. 月次運用

### 自動処理

- 毎月1日 00:00: Freeユーザーへの30cr自動付与（CreditGrantScheduler）
- 有料ユーザー: invoice.paid Webhookで月次クレジット付与

### 手動運用（必要時）

- 管理画面からプラン付与/剥奪（AdminController）
- Stripeダッシュボードでの返金処理

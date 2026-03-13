# Stripe課金システム セットアップガイド

## 1. Stripeアカウントの準備

1. https://dashboard.stripe.com/ にログイン
2. 左上のモード切替で **「テスト」モード** になっていることを確認（オレンジの「テストデータ」バナーが表示されていればOK）

---

## 2. Secret Key の取得

1. 左メニュー → **「開発者」**（歯車の隣）→ **「APIキー」**
2. 「シークレットキー」の横の **「テストキーを表示」** をクリック
3. `sk_test_` で始まる文字列をコピー
4. `apps/backend/.env` を開いて以下を追加（コメントアウトを外す）:
   ```
   STRIPE_SECRET_KEY=sk_test_ここにコピーした値を貼り付け
   ```

---

## 3. 商品（Product）と価格（Price）の作成

### 3-1. Standardプラン（月額サブスクリプション）

1. 左メニュー → **「商品カタログ」** → 右上 **「+商品を追加」**
2. 以下を入力:
   - **名前**: `Workwrite Standard`
   - **説明**: （任意）`月200クレジット付きのスタンダードプラン`
3. 「価格情報」セクション:
   - **価格モデル**: 標準の料金体系
   - **金額**: `2980` JPY
   - **請求間隔**: **「定期」** を選択 → **「毎月」**
4. **「商品を保存」** をクリック
5. 保存後の商品詳細ページで、「価格」セクションに表示されている価格の行をクリック
6. URLまたは価格詳細に表示される **`price_`で始まるID** をコピー
7. `.env` に追加:
   ```
   STRIPE_STANDARD_PRICE_ID=price_ここにコピーした値
   ```

### 3-2. Proプラン（月額サブスクリプション）

1. 再び **「+商品を追加」**
2. 以下を入力:
   - **名前**: `Workwrite Pro`
   - **説明**: （任意）`月600クレジット付きのプロプラン`
3. 「価格情報」セクション:
   - **金額**: `7980` JPY
   - **請求間隔**: **「定期」** → **「毎月」**
4. **「商品を保存」**
5. Price ID（`price_...`）をコピー
6. `.env` に追加:
   ```
   STRIPE_PRO_PRICE_ID=price_ここにコピーした値
   ```

### 3-3. クレジット追加購入 Standard用（一回限りの購入）

1. **「+商品を追加」**
2. 以下を入力:
   - **名前**: `Workwrite Credits (Standard)`
   - **説明**: （任意）`100クレジット追加購入（Standardプラン向け）`
3. 「価格情報」セクション:
   - **金額**: `980` JPY
   - **請求間隔**: **「1回限り」** を選択（「定期」ではない）
4. **「商品を保存」**
5. Price ID（`price_...`）をコピー
6. `.env` に追加:
   ```
   STRIPE_CREDIT_PURCHASE_STANDARD_PRICE_ID=price_ここにコピーした値
   ```

### 3-4. クレジット追加購入 Pro用（一回限りの購入）

1. **「+商品を追加」**
2. 以下を入力:
   - **名前**: `Workwrite Credits (Pro)`
   - **説明**: （任意）`100クレジット追加購入（Proプラン向け）`
3. 「価格情報」セクション:
   - **金額**: `880` JPY
   - **請求間隔**: **「1回限り」**
4. **「商品を保存」**
5. Price ID（`price_...`）をコピー
6. `.env` に追加:
   ```
   STRIPE_CREDIT_PURCHASE_PRO_PRICE_ID=price_ここにコピーした値
   ```

### 確認

この時点で `.env` に以下の6つが設定されているはず:

```env
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_STANDARD_PRICE_ID=price_xxxxx
STRIPE_PRO_PRICE_ID=price_xxxxx
STRIPE_CREDIT_PURCHASE_STANDARD_PRICE_ID=price_xxxxx
STRIPE_CREDIT_PURCHASE_PRO_PRICE_ID=price_xxxxx
```

残り1つ（`STRIPE_WEBHOOK_SECRET`）はWebhook設定時に取得します。

---

## 4. Webhook の設定

### ローカル開発の場合（Stripe CLI を使用）

Stripe CLIを使うと、Stripeからのイベントをローカルのバックエンドに転送できます。

#### 4-1. Stripe CLI のインストール

**Windows (scoop)**:
```bash
scoop install stripe
```

**Windows (手動)**:
1. https://github.com/stripe/stripe-cli/releases/latest からWindows用のzipをダウンロード
2. 解凍して `stripe.exe` をPATHの通ったフォルダに配置

#### 4-2. Stripe CLI にログイン

```bash
stripe login
```
→ ブラウザが開くので、Stripeアカウントでログインして許可する

#### 4-3. Webhookの転送を開始

```bash
stripe listen --forward-to localhost:3001/api/v1/billing/webhook
```

実行すると以下のように表示されます:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxxxxx (^C to quit)
```

この **`whsec_`で始まる文字列** をコピーして `.env` に追加:
```
STRIPE_WEBHOOK_SECRET=whsec_ここにコピーした値
```

**重要**: `stripe listen` は起動しっぱなしにしておく必要があります。バックエンドのテスト中はこのターミナルを閉じないでください。

### 本番環境の場合（Stripeダッシュボードから設定）

1. 左メニュー → **「開発者」** → **「Webhook」**
2. **「エンドポイントを追加」** をクリック
3. **「エンドポイントURL」**: `https://api.workwrite.jp/api/v1/billing/webhook`
4. **「イベントを選択」** をクリックして、以下の5つにチェック:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. **「エンドポイントを追加」** をクリック
6. 作成されたエンドポイントの詳細画面で **「署名シークレット」** の **「表示」** をクリック
7. `whsec_...` をコピーして `.env` の `STRIPE_WEBHOOK_SECRET` に設定

---

## 5. Customer Portal の設定

1. https://dashboard.stripe.com/settings/billing/portal にアクセス
   （左メニュー → **「設定」** → **「Billing」** → **「カスタマーポータル」** でも行ける）
2. 以下の設定を変更:
   - **「顧客が支払い方法を更新可能」**: 有効（ON）
   - **「顧客がサブスクリプションをキャンセル可能」**: 有効（ON）
   - **「顧客がプランを切り替え可能」**: 無効（OFF）— アプリ内で制御するため
3. **「保存」** をクリック

---

## 6. 最終的な .env の確認

`apps/backend/.env` に以下の7つ全てが設定されていること:

```env
# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_STANDARD_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PRO_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_CREDIT_PURCHASE_STANDARD_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_CREDIT_PURCHASE_PRO_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxxxxxx
FRONTEND_URL=http://localhost:3000
```

`FRONTEND_URL` は既に設定済みのはず。

---

## 7. DBマイグレーション

バックエンドのDBを起動してマイグレーションを実行:

```bash
# 1. Docker で PostgreSQL / Redis / Meilisearch を起動
docker compose up -d

# 2. マイグレーション実行（初回はテーブル作成）
cd apps/backend
npx prisma migrate dev --name add_credit_billing_system

# 3. 既存ユーザーにCreditBalance付与 + premium→proマイグレーション
npx prisma db seed
```

---

## 8. ローカルテスト手順

### 8-1. 起動

ターミナルを3つ開く:

**ターミナル1**: Stripe CLI
```bash
stripe listen --forward-to localhost:3001/api/v1/billing/webhook
```

**ターミナル2**: バックエンド
```bash
cd apps/backend
npm run dev
```

**ターミナル3**: フロントエンド
```bash
cd apps/frontend
npm run dev
```

### 8-2. テストイベント送信（別ターミナルで）

```bash
# Checkoutセッション完了イベントのテスト
stripe trigger checkout.session.completed

# 請求書支払い完了イベントのテスト
stripe trigger invoice.paid

# サブスクリプション削除イベントのテスト
stripe trigger customer.subscription.deleted
```

### 8-3. テスト用カード番号

Stripeテストモードでは以下のカード番号が使えます:

| カード番号 | 結果 |
|---|---|
| `4242 4242 4242 4242` | 成功 |
| `4000 0000 0000 0002` | カード拒否 |
| `4000 0000 0000 3220` | 3Dセキュア認証が必要 |

有効期限: 未来の任意の日付（例: `12/34`）
CVC: 任意の3桁（例: `123`）

---

## 9. 動作確認チェックリスト

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

---

## 10. 本番デプロイ時の注意

### テスト → 本番の切り替え

1. Stripeダッシュボードで **「本番」モード** に切り替え
2. 本番環境の商品・価格を新規作成（テストとは別物）
3. `.env` の値を全て本番用に差し替え:
   - `sk_test_...` → `sk_live_...`
   - `whsec_...` → 本番Webhookの署名シークレット
   - `price_...` → 本番Price ID

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

---

## 11. 月次運用

### 自動処理

- 毎月1日 00:00: Freeユーザーへの20cr自動付与（CreditGrantScheduler）
- 有料ユーザー: invoice.paid Webhookで月次クレジット付与

### 手動運用（必要時）

- 管理画面からプラン付与/剥奪（AdminController）
- 管理画面から個別ユーザーへのクレジット無償付与
- 管理画面から個別ユーザーへの招待コード付与
- Stripeダッシュボードでの返金処理

---

## トラブルシューティング

### 「Stripe決済は現在利用できません」と表示される
→ `STRIPE_SECRET_KEY` が `.env` に設定されていないか、値が間違っている

### 「xxxプランの価格が設定されていません」と表示される
→ `STRIPE_STANDARD_PRICE_ID` または `STRIPE_PRO_PRICE_ID` が未設定

### Webhookイベントが届かない
→ `stripe listen` が起動しているか確認。ターミナルにイベントログが表示されるはず

### Webhook署名検証エラー
→ `STRIPE_WEBHOOK_SECRET` の値が `stripe listen` で表示された値と一致しているか確認。`stripe listen` を再起動するとsecretが変わるので `.env` も更新が必要

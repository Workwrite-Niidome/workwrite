# Workwrite クレジット制ハイブリッド課金システム 要件定義書

**文書バージョン**: 1.0
**作成日**: 2026-03-11
**対象リポジトリ**: Workwrite-Niidome/workwrite

---

## 1. 概要

### 1.1 背景と目的

Workwriteは小説執筆プラットフォームであり、現在AIアシスト機能を無料プラン（週5回制限）と有料プラン（無制限）の2軸で提供している。現行システムには以下の課題がある:

- **コスト予測が困難**: 有料プランユーザーがAIを無制限に使用できるため、プラットフォーム側のAPI費用が予測不能
- **モデル別の価格差が反映されていない**: Sonnet(低コスト)とOpus(高コスト)の消費が同等に扱われている
- **柔軟性の欠如**: 無料ユーザーが一時的に多く使いたい場合の手段がない
- **プラン間の価値差が不明瞭**: starter/standard/premiumの差別化がモデルアクセスのみ

本要件定義書では、**月額サブスクリプション + クレジット制**のハイブリッド課金モデルを導入し、上記課題を解決する。

### 1.2 コンセプト

- ユーザーはプランに応じた月間クレジットを受け取る
- AIアシストの各呼び出しはモデルに応じたクレジットを消費する
- クレジットが不足した場合、追加購入が可能（有料プランのみ）
- 構造解析・キャラクター抽出・あらすじ更新などのバックグラウンド処理はプラットフォーム負担（0cr）

### 1.3 現行システムとの差分

| 項目 | 現行 | 新システム |
|---|---|---|
| 無料プラン制限 | 週5回 | 月20cr（Sonnet 20回相当） |
| 有料プラン制限 | 無制限 | 月間クレジット付与（追加購入可） |
| Opus利用 | premiumプラン限定 | 全有料プランで利用可（5cr/回） |
| コスト管理 | なし | クレジットで自動制御 |
| 追加購入 | 不可 | 有料プランのみ可 |

---

## 2. プラン設計

### 2.1 プラン一覧

| プラン | 月額料金 | 月間付与クレジット | 追加購入 | 備考 |
|---|---|---|---|---|
| Free | ¥0 | 20cr/月 | 不可 | Sonnet 20回 or Opus 4回相当 |
| Standard | ¥2,980 | 200cr/月 | 100cr = ¥980 | Sonnet 200回 or Opus 40回相当 |
| Pro | ¥7,980 | 600cr/月 | 100cr = ¥880 | Sonnet 600回 or Opus 120回相当 |

### 2.2 クレジット消費テーブル

| アクション | 消費クレジット | 使用モデル | 備考 |
|---|---|---|---|
| AIアシスト（Sonnet） | 1cr | claude-sonnet-4-20250514 | 通常の執筆アシスト |
| AIアシスト（Sonnet + Thinking） | 2cr | claude-sonnet-4-20250514 (extended thinking) | じっくりモード（Sonnet） |
| AIアシスト（Opus） | 5cr | claude-opus-4-6 | じっくりモード（Opus） |
| 構造解析（自動） | 0cr | Haiku | エピソード保存時の自動解析 |
| キャラクター抽出 | 0cr | Haiku | AI生成テキストからの自動抽出 |
| あらすじ更新 | 0cr | Haiku | storySummary自動更新 |
| QualityScore算出 | 0cr | Haiku | 作品品質スコアリング |
| オンボーディングプロファイル | 0cr | Haiku | 初回診断 |

### 2.3 0cr（プラットフォーム負担）の定義

`LIGHT_FEATURES`（現行の`ai-tier.service.ts`で定義済み）に該当する機能はプラットフォーム負担とし、ユーザーのクレジットを消費しない。これらはすべてHaikuモデルを使用し、コストが低いため。

対象feature slug一覧:
- `proofread`
- `scoring`
- `episode_scoring`
- `synopsis-gen`
- `highlight_explain`
- `onboarding_profile`
- `embedding_generation`
- `character_extraction`（新規追加）
- `story_summary_update`（新規追加）
- `structural_analysis`（新規追加）

---

## 3. データベース設計

### 3.1 既存テーブルの変更

#### `Subscription`テーブルの拡張

現行の`Subscription`モデルを拡張する。`plan`フィールドの値を `free` / `standard` / `pro` に変更する（現行の`starter`/`standard`/`premium`から移行）。

```prisma
model Subscription {
  id                String    @id @default(cuid())
  userId            String    @unique
  stripeSubId       String?   @unique
  plan              String    // "free" | "standard" | "pro"
  status            String    // "active" | "canceled" | "past_due" | "trialing" | "paused"
  currentPeriodStart DateTime?
  currentPeriodEnd  DateTime?
  cancelAtPeriodEnd Boolean   @default(false)
  trialEnd          DateTime?
  grantedBy         String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**変更点**:
- `currentPeriodStart` 追加 — クレジット付与サイクルの開始日
- `cancelAtPeriodEnd` 追加 — 期間末キャンセル予約フラグ
- `trialEnd` 追加 — トライアル終了日
- `plan`の値変更: `starter` -> 廃止, `standard` -> `standard`, `premium` -> `pro`

### 3.2 新規テーブル

#### `CreditBalance`（クレジット残高）

```prisma
model CreditBalance {
  id             String   @id @default(cuid())
  userId         String   @unique
  balance        Int      @default(0)    // 現在の利用可能クレジット
  monthlyGranted Int      @default(0)    // 今月付与されたクレジット
  lastGrantedAt  DateTime?               // 最後のクレジット付与日
  updatedAt      DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**設計判断**: クレジット残高を単一レコードで管理する。有効期限の管理はCreditTransactionのレコードではなく、月次のバッチ処理で期限切れクレジットを一括失効させる方式を採用する。

#### `CreditTransaction`（クレジット取引履歴）

```prisma
model CreditTransaction {
  id              String            @id @default(cuid())
  userId          String
  amount          Int               // 正=付与/購入, 負=消費/失効
  type            CreditTxType
  balance         Int               // 取引後の残高（スナップショット）
  relatedFeature  String?           // "writing_assist" | "writing_assist_premium" etc.
  relatedModel    String?           // "claude-sonnet-4" | "claude-opus-4" etc.
  aiUsageLogId    String?           // AiUsageLog.id（消費時のみ）
  stripePaymentId String?           // 追加購入時のStripe Payment Intent ID
  description     String?           // 管理者付与時のメモ等
  createdAt       DateTime          @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, type])
  @@index([createdAt])
}

enum CreditTxType {
  MONTHLY_GRANT      // 月額プランによる付与
  PURCHASE           // 追加購入
  CONSUME            // AI利用による消費
  EXPIRE             // 月末失効
  ADMIN_GRANT        // 管理者による手動付与
  ADMIN_REVOKE       // 管理者による手動取消
  REFUND             // エラー時の返還
  PLAN_CHANGE_ADJUST // プラン変更時の調整
}
```

**設計ポイント**:
- `balance`フィールドに取引後の残高スナップショットを保存。CreditBalanceとの整合性監査と残高再計算を可能にする
- `aiUsageLogId`で既存のAiUsageLogと紐付け、トークン使用量とクレジット消費の相関分析を可能にする
- `stripePaymentId`で追加購入の決済と紐付け

#### `CreditPurchase`（追加クレジット購入履歴）

```prisma
model CreditPurchase {
  id                    String   @id @default(cuid())
  userId                String
  amount                Int      // 購入クレジット数（例: 100）
  priceJpy              Int      // 支払い金額（円）
  stripePaymentIntentId String   @unique
  status                String   @default("completed") // "pending" | "completed" | "failed" | "refunded"
  createdAt             DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

### 3.3 既存テーブルとの関連

#### `User`モデルへのリレーション追加

```prisma
model User {
  // ... existing fields ...
  creditBalance      CreditBalance?
  creditTransactions CreditTransaction[]
  creditPurchases    CreditPurchase[]
}
```

#### `AiUsageLog`との統合

既存の`AiUsageLog`はそのまま維持する。クレジット消費トランザクションから`aiUsageLogId`で参照し、トークン消費とクレジット消費を紐づける。AiUsageLogの変更は不要。

---

## 4. クレジット管理ビジネスロジック

### 4.1 月間クレジット付与

**付与タイミング**: サブスクリプションの更新日（Stripe `invoice.paid` イベント受信時）

**付与フロー**:
1. Stripeから`invoice.paid`ウェブフックを受信
2. 該当ユーザーのプランに応じたクレジット数を決定
3. 既存の残クレジットの処理（失効ポリシーに基づく）
4. 新規クレジットを`CreditBalance.balance`に加算
5. `CreditTransaction`に`MONTHLY_GRANT`レコードを作成
6. `CreditBalance.monthlyGranted`と`lastGrantedAt`を更新

**Freeプランの付与**: 毎月1日 00:00 JSTにバッチ処理で20crを付与。Stripeサブスクリプションは存在しないため、Cronジョブで実行する。

### 4.2 クレジット失効ポリシー

**ポリシー: 月間付与クレジットは翌月繰り越し不可。追加購入クレジットは無期限。**

**理由**:
- 繰り越し可能にするとコスト予測が困難になる
- 追加購入は実費支払い済みのため失効させない
- ユーザー心理として「使い切らないと損」が適度な利用促進になる

**実装方法**:
- `CreditBalance`に`balance`（総残高）を保持
- 月間付与時に前月の未使用付与分を算出: `max(0, monthlyGranted - 当月消費分)`
- 未使用分を`EXPIRE`トランザクションとして記録し、`balance`から減算
- その後、新月のクレジットを付与

**消費順序**: 月間付与クレジットを先に消費し、追加購入クレジットは後に消費する（FIFO）。これにより、月末に失効するのは月間付与分の未使用分のみ。

**実装の簡略化**: 月末の失効処理時に以下の計算で失効分を決定:

```
当月消費合計 = SUM(CreditTransaction.amount WHERE type = CONSUME AND 当月分)
月間付与分の消費 = MIN(monthlyGranted, 当月消費合計)
失効クレジット = monthlyGranted - 月間付与分の消費
```

### 4.3 クレジット消費フロー

AIアシスト呼び出し時の処理:

```
1. リクエスト受信（userId, templateSlug, premiumMode）
2. 使用モデルの決定（getModelConfig）
3. 消費クレジット数の決定:
   - LIGHT_FEATURES に該当 → 0cr（プラットフォーム負担）
   - Sonnet（通常） → 1cr
   - Sonnet（thinking） → 2cr
   - Opus → 5cr
4. 0cr でない場合、残高の事前チェック:
   - CreditBalance.balance >= 必要クレジット → 続行
   - 不足 → 403エラー（フレンドリーメッセージ付き）
5. AI API呼び出し（ストリーミング）
6. 成功時: クレジット消費処理（トランザクション内で実行）
   a. CreditBalance.balance を減算
   b. CreditTransaction に CONSUME レコード作成
   c. AiUsageLog 作成（既存処理）
7. 失敗時: クレジットは消費しない（ステップ6をスキップ）
```

**重要**: クレジットの引き落としはAI APIの**成功後**に行う。APIエラーやタイムアウトでユーザーが結果を受け取れなかった場合にクレジットを消費しない。

**二重消費防止**: ストリーミング応答の`finally`ブロック内で消費処理を行う。ストリームが正常に開始された場合（少なくとも1つの`content_block_delta`が受信された場合）にのみ消費する。

### 4.4 残高不足時の処理

クレジット不足時のレスポンス:

```json
{
  "statusCode": 403,
  "error": "INSUFFICIENT_CREDITS",
  "message": "クレジットが不足しています",
  "data": {
    "required": 5,
    "current": 2,
    "canPurchase": true,
    "purchaseUrl": "/settings/billing"
  }
}
```

フロントエンド:
- エディタ内にモーダルを表示
- 現在の残高と必要クレジットを表示
- 有料プランユーザー → 「クレジットを追加購入」ボタン
- Freeプランユーザー → 「プランをアップグレード」ボタン

### 4.5 並行リクエスト制御（レースコンディション対策）

**方式: Prismaトランザクション + SELECT FOR UPDATE**

```typescript
await prisma.$transaction(async (tx) => {
  const balance = await tx.$queryRaw`
    SELECT * FROM "CreditBalance"
    WHERE "userId" = ${userId}
    FOR UPDATE
  `;

  if (balance[0].balance < requiredCredits) {
    throw new InsufficientCreditsError();
  }

  await tx.creditBalance.update({
    where: { userId },
    data: { balance: { decrement: requiredCredits } },
  });

  await tx.creditTransaction.create({
    data: {
      userId,
      amount: -requiredCredits,
      type: 'CONSUME',
      balance: balance[0].balance - requiredCredits,
      relatedFeature: feature,
      relatedModel: model,
      aiUsageLogId,
    },
  });
});
```

**フロー**:
1. 事前チェック（ロックなし、楽観的チェック） — ここで弾ける場合は即座に403
2. AI API呼び出し（トランザクション外）
3. 成功後、トランザクション内でロック付き残高チェック + 消費処理
4. ステップ3で残高不足の場合 → AI応答は返すが次回リクエスト時にブロック

### 4.6 管理者によるクレジット操作

- **ボーナスクレジット付与**: `ADMIN_GRANT`タイプでCreditTransaction作成、CreditBalance加算
- **クレジット取消**: `ADMIN_REVOKE`タイプ（不正利用対応等）
- **プラン手動付与/取消**: 現行の`grantPlan`/`revokePlan`機能を維持

---

## 5. サブスクリプション管理

### 5.1 Stripe統合

**使用するStripeオブジェクト**:
- `Product` — Standard / Pro
- `Price` — Standard月額¥2,980、Pro月額¥7,980
- `Customer` — Userと1:1対応
- `Subscription` — 月額サブスクリプション
- `PaymentIntent` — 追加クレジット購入
- `Checkout Session` — 決済フロー

**環境変数**:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STANDARD_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_CREDIT_100_STANDARD_PRICE_ID` (¥980)
- `STRIPE_CREDIT_100_PRO_PRICE_ID` (¥880)

### 5.2 サブスクリプションライフサイクル

#### 新規登録フロー

```
1. ユーザーがプラン選択ページで「Standardに登録」をクリック
2. POST /api/v1/billing/checkout { plan, successUrl, cancelUrl }
3. バックエンド: Stripe Checkout Session作成（mode: 'subscription'）
4. フロントエンド → Stripe Checkoutにリダイレクト
5. 決済完了 → successURLにリダイレクト
6. Webhook: checkout.session.completed
   a. Subscription レコード作成/更新
   b. CreditBalance 作成、月間クレジット付与
   c. CreditTransaction に MONTHLY_GRANT 記録
```

#### プランアップグレードフロー

```
1. POST /api/v1/billing/change-plan { plan: "pro" }
2. Stripe Subscription 更新（proration_behavior: 'create_prorations'）
3. 即座にプラン切り替え
4. 差額クレジット日割り付与: (600-200) * 残日数/月日数
5. CreditTransaction に PLAN_CHANGE_ADJUST 記録
```

#### プランダウングレードフロー

```
1. POST /api/v1/billing/change-plan { plan: "standard" }
2. 次回更新時に反映（proration_behavior: 'none'）
3. 現在の期間終了まではPro特典を維持
4. 次回更新時に付与クレジットが200crに変更
```

#### キャンセルフロー

```
1. POST /api/v1/billing/cancel
2. Stripe: cancel_at_period_end = true
3. 期間終了まではプラン特典維持
4. 期間終了時:
   a. 月間付与分の残り → 失効
   b. 追加購入分の残り → 維持（無期限）
   c. Freeプランに移行
```

### 5.3 トライアル期間

- 初回のStandard/Pro登録時に**7日間のトライアル**
- トライアル中はプランの全クレジットを付与
- トライアル中にキャンセル → クレジット失効、課金なし
- 1ユーザーにつき1回のみ（Stripe Customerメタデータで管理）

### 5.4 支払い失敗時の処理

```
1. invoice.payment_failed → status = "past_due"
2. ユーザーにメール + アプリ内通知
3. 猶予期間: 7日間はクレジット利用継続可能
4. 7日後 → クレジット利用ブロック（残高は維持）
5. 30日後 → Stripe自動キャンセル → status = "canceled"
```

---

## 6. 追加クレジット購入

### 6.1 購入フロー

```
1. 「クレジットを追加購入」をクリック
2. 数量選択（100cr単位）
3. POST /api/v1/billing/credits/purchase { quantity: 1 }
4. プラン別単価でStripe Checkout Session作成（mode: 'payment'）
5. 決済完了
6. Webhook: checkout.session.completed
   a. CreditPurchase レコード作成
   b. CreditBalance.balance 加算
   c. CreditTransaction に PURCHASE 記録
```

### 6.2 購入制限

- **Freeプラン**: 追加購入不可
- **月間購入上限**: 10回（1,000cr）まで
- **最小購入単位**: 100cr
- **最大一度の購入**: 500cr

### 6.3 返金ポリシー

- サポート経由でのみ対応
- 消費済みクレジットは返金対象外
- `REFUND`タイプのCreditTransactionで記録

---

## 7. API エンドポイント設計

### 7.1 課金ステータス

**GET /api/v1/billing/status**

```json
{
  "data": {
    "plan": "standard",
    "status": "active",
    "credits": {
      "balance": 142,
      "monthlyGranted": 200,
      "monthlyUsed": 58,
      "purchasedRemaining": 0
    },
    "subscription": {
      "currentPeriodStart": "2026-03-01T00:00:00Z",
      "currentPeriodEnd": "2026-04-01T00:00:00Z",
      "cancelAtPeriodEnd": false,
      "trialEnd": null
    },
    "usage": {
      "todayUsed": 5,
      "weekUsed": 23,
      "monthUsed": 58
    }
  }
}
```

### 7.2 Checkout Session作成

**POST /api/v1/billing/checkout**

### 7.3 プラン変更

**POST /api/v1/billing/change-plan**

### 7.4 キャンセル / キャンセル取り消し

**POST /api/v1/billing/cancel**
**POST /api/v1/billing/reactivate**

### 7.5 追加クレジット購入

**POST /api/v1/billing/credits/purchase**

### 7.6 取引履歴

**GET /api/v1/billing/transactions?page=1&limit=20&type=CONSUME**

### 7.7 Stripeウェブフック

**POST /api/v1/billing/webhook**

| イベント | 処理内容 |
|---|---|
| `checkout.session.completed` | サブスク作成 or クレジット購入確定 |
| `invoice.paid` | 月間クレジット付与、サブスク更新 |
| `invoice.payment_failed` | ステータス→past_due、通知送信 |
| `customer.subscription.updated` | プラン変更反映 |
| `customer.subscription.deleted` | キャンセル完了、クレジット失効 |

### 7.8 管理者API

**POST /api/v1/admin/credits/grant** — ボーナスクレジット付与
**GET /api/v1/admin/billing/analytics** — 収益サマリー・統計

---

## 8. フロントエンドUI設計

### 8.1 エディタ内クレジット表示

- **位置**: エディタヘッダー右上（常時表示）
- 表示: `⚡ 142cr`
- 残高20%以下 → オレンジ色
- 残高0 → 赤色
- クリック → 利用状況ポップオーバー

### 8.2 AIアシストUI統合

モデル選択ドロップダウン（有料プランユーザー）:
- Sonnet（1cr） — デフォルト
- Sonnet じっくり（2cr）
- Opus じっくり（5cr）

### 8.3 プラン選択ページ

**パス**: `/pricing`（未ログイン可） / `/settings/billing`（ログイン時）

### 8.4 利用履歴ページ

**パス**: `/settings/billing/history`

### 8.5 クレジット不足モーダル

```
┌─────────────────────────────────────┐
│  クレジットが不足しています          │
│                                     │
│  必要: 5cr  /  残高: 2cr           │
│                                     │
│  [クレジットを追加購入]   ← Standard│
│  [プランをアップグレード] ← Free    │
│                                     │
│  [閉じる]                          │
└─────────────────────────────────────┘
```

### 8.6 低クレジット警告

残高が月間付与の20%以下 → エディタ上部にインフォバー（dismissible）

---

## 9. セキュリティ要件

### 9.1 Stripeウェブフック署名検証

```typescript
const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
```

NestJSのウェブフックエンドポイントでは`rawBody`を保持する設定が必要。

### 9.2 クレジット残高操作防止

- すべてのクレジット操作はCreditTransactionとして記録（監査証跡）
- 定期バッチで`CreditBalance.balance`と`SUM(CreditTransaction.amount)`を比較
- DBレベルで`CHECK (balance >= 0)`制約

### 9.3 レートリミティング

現行のインメモリレートリミット（1時間20回）はクレジット制と併用して維持。

追加:
- 追加クレジット購入: 1日5回まで
- プラン変更: 1日3回まで
- Checkout Session作成: 1時間10回まで

---

## 10. バッチ処理

### 10.1 Freeプラン月間クレジット付与

**スケジュール**: 毎月1日 00:00 JST

### 10.2 クレジット整合性チェック

**スケジュール**: 毎日 03:00 JST（自動修正は行わず管理者通知）

### 10.3 利用統計集計

**スケジュール**: 毎日 04:00 JST（MRR, ARPU, プラン別ユーザー数等）

---

## 11. 既存ユーザーの移行

### 11.1 移行ステップ

#### Phase 1: データベース準備
- 新テーブル作成
- Subscriptionテーブル拡張
- planフィールド変換: `starter`→`standard`, `premium`→`pro`

#### Phase 2: クレジット初期付与
- 全ユーザーにCreditBalanceレコード作成
- プランに応じた初期クレジット付与

#### Phase 3: コード切り替え
- `AiTierService`をクレジットベースに変更
- 環境変数`CREDIT_SYSTEM_ENABLED`でフラグ制御

#### Phase 4: Stripe統合
- 新Product/Price作成
- 既存サブスクリプション移行

### 11.2 ロールバック計画

- `CREDIT_SYSTEM_ENABLED=false`で旧ロジックに復帰
- CreditBalance/CreditTransactionデータは保持

---

## 12. エラーハンドリング一覧

| シナリオ | HTTP | エラーコード | メッセージ |
|---|---|---|---|
| クレジット不足 | 403 | `INSUFFICIENT_CREDITS` | クレジットが不足しています |
| Freeで追加購入 | 403 | `PURCHASE_NOT_ALLOWED` | Standard以上のプランが必要です |
| 購入上限超過 | 429 | `PURCHASE_LIMIT_EXCEEDED` | 今月の上限に達しました |
| 決済失敗 | 502 | `PAYMENT_FAILED` | カード情報をご確認ください |
| 支払い延滞 | 403 | `SUBSCRIPTION_PAST_DUE` | お支払い方法を更新してください |
| AI APIエラー | 503 | `AI_SERVICE_ERROR` | AIサービスが一時的に利用できません（クレジット未消費） |
| レートリミット | 429 | `RATE_LIMIT_EXCEEDED` | しばらくお待ちください |

---

## 13. パフォーマンス要件

| 操作 | 目標 |
|---|---|
| クレジット残高取得 | < 50ms |
| クレジット消費処理 | < 100ms |
| Billing statusエンドポイント | < 200ms |
| 取引履歴取得 | < 300ms |

---

## 14. 監視とアラート

| 項目 | 閾値 | アクション |
|---|---|---|
| クレジット残高不整合 | 1件以上 | 管理者に即時通知 |
| Webhook処理失敗 | 連続3回 | 管理者に即時通知 |
| 1ユーザー1時間のAI呼び出し | > 50回 | 不正利用調査 |
| 日次収益の前日比 | -30%以上 | 管理者に通知 |

---

## 15. 実装対象ファイル

### バックエンド（修正）

| ファイル | 変更内容 |
|---|---|
| `prisma/schema.prisma` | CreditBalance, CreditTransaction, CreditPurchase追加、Subscription拡張 |
| `src/ai-settings/ai-tier.service.ts` | クレジットベースの権限チェックに全面改修 |
| `src/ai-assist/ai-assist.service.ts` | クレジット消費処理を追加 |

### バックエンド（新規）

| ファイル | 内容 |
|---|---|
| `src/billing/billing.module.ts` | Billingモジュール |
| `src/billing/billing.controller.ts` | 課金APIエンドポイント |
| `src/billing/billing.service.ts` | Stripe統合、Checkout Session |
| `src/billing/credit.service.ts` | クレジット残高管理、消費、付与 |
| `src/billing/stripe-webhook.controller.ts` | Webhook受信、署名検証 |
| `src/billing/dto/` | リクエスト/レスポンスDTO群 |

### フロントエンド（新規）

| ファイル | 内容 |
|---|---|
| `src/app/pricing/page.tsx` | プラン選択ページ |
| `src/app/settings/billing/page.tsx` | 課金設定ページ |
| `src/app/settings/billing/history/page.tsx` | 取引履歴ページ |
| `src/components/billing/CreditBadge.tsx` | エディタ内クレジット表示 |
| `src/components/billing/InsufficientCreditsModal.tsx` | 不足時モーダル |
| `src/components/billing/LowCreditBanner.tsx` | 低クレジット警告バナー |
| `src/components/billing/PlanCard.tsx` | プラン比較カード |

---

## 16. 将来の拡張性

- **年間プラン**: 月額の10ヶ月分で12ヶ月（2ヶ月分お得）
- **チームプラン**: 複数ユーザーでクレジットプール共有
- **クレジットギフト**: ユーザー間でのクレジット送付
- **ボリュームディスカウント**: 大量追加購入時の割引

---

## 17. 用語定義

| 用語 | 定義 |
|---|---|
| クレジット (cr) | AI機能の利用に消費されるプラットフォーム内通貨単位 |
| 月間付与クレジット | サブスクリプション更新時にプランに応じて付与。翌月繰り越し不可 |
| 追加購入クレジット | 有料プランユーザーが別途購入。無期限 |
| プラットフォーム負担 | ユーザーのクレジットを消費せず運営側がコスト負担する機能 |
| MRR | Monthly Recurring Revenue（月間定期収益） |
| ARPU | Average Revenue Per User（ユーザーあたり平均収益） |

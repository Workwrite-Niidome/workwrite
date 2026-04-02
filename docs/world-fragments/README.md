# World Fragments — 世界の断片

> 一つの小説が、一つの世界になる

## 概要

World Fragmentsは、読者が小説の世界に「もしも」を願い、AIが原作の制約の中で世界の断片を描く機能。原作は聖域であり、キャラクターの人格、世界観、確定した出来事は壊されない。

---

## コンセプト

小説は世界の一つの断面。読者が「見たいif」を願い、AIが原作の正典（Canon）の制約の中で描く。ifが積み重なって、一つの小説が一つの世界になる。

### 核心原則

- **原作は聖域**: 世界観、キャラクター、関係値、出来事は壊せない
- **結果は変わらないが過程が変わる**: 原作の物語は変わらない。無数のifが過程として生まれる
- **人間が願い、AIが描く**: 他の作者が書くのではない。AIが原作の制約の中で生成する。だから世界が壊れない

---

## アーキテクチャ

```
読者 → 願い(wish) → 制約チェック(Sonnet) → 生成(Opus) → 自己評価(Sonnet) → 公開
                          ↓ 矛盾あり
                        却下（1cr消費）
```

### コンポーネント

| コンポーネント | 場所 | 役割 |
|-------------|------|------|
| WorldCanon | DBテーブル | 作品の正典。キャラ・世界観・タイムライン・関係値・層構造の集約 |
| WorldFragment | DBテーブル | 読者の願いから生まれた世界の断片 |
| WorldCanonService | backend service | Canon構築・更新・願いの種管理 |
| FragmentGeneratorService | backend service | 制約チェック・Fragment生成・自己評価の全パイプライン |
| WorldFragmentsController | backend controller | REST APIエンドポイント群 |
| world-fragments-api.ts | frontend lib | フロントエンド用APIクライアント |
| /world-fragments/ | frontend pages | 作品一覧・願いUI・Fragment閲覧・Canon編集 |

---

## データモデル

### WorldCanon（作品の正典）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| workId | String (unique) | 対象作品 |
| canonVersion | Int | バージョン番号 |
| upToEpisode | Int | この話数まで分析済み |
| characterProfiles | Json | キャラクターの人格・口調・動機・制約 |
| worldRules | Json | 物理法則・社会構造・地理・制約 |
| timeline | Json | 主要イベントのタイムライン |
| relationships | Json | キャラクター間の関係値 |
| establishedFacts | Json | 確定事実（変更不可） |
| ambiguities | Json | 原作が意図的に曖昧にしている領域 |
| narrativeStyle | Json | 文体・語り口・POV |
| worldLayers | Json | 世界の層構造（現実/虚構/夢 等） |
| layerInteractions | Json | 層間の相互作用ルール |
| layerAmbiguities | Json | 層に関する意図的な曖昧さ |
| wishSeeds | Json | 事前生成された「願いの種」プール |

### WorldFragment（世界の断片）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| workId | String | 対象作品 |
| requesterId | String | 願った読者のuserId |
| wish | Text | 自然言語の願い |
| wishType | Enum | PERSPECTIVE / SIDE_STORY / MOMENT / WHAT_IF |
| scope | Json | { upToEpisode: N } |
| content | Text | 生成されたテキスト |
| status | Enum | PENDING → CHECKING → GENERATING → EVALUATING → PUBLISHED / REJECTED / FAILED |
| qualityScore | Json | 4軸評価（キャラ一貫性、世界整合性、文学的品質、願い充足度） |
| creditCost | Int | 消費クレジット |
| generationLog | Json | モデル、トークン数、タイムスタンプ |

### wishType（願いの種類）

| 種類 | 説明 | コスト |
|------|------|--------|
| PERSPECTIVE | 既存シーンを別キャラの視点で | 15cr |
| SIDE_STORY | 本編の裏で起きていたこと | 20cr |
| MOMENT | 本編に描かれなかった一瞬 | 10cr |
| WHAT_IF | もし違う選択をしていたら | 25cr |

---

## 層構造（World Layers）

物語に複数の現実・虚構・夢の層がある場合、Canonがそれを管理する。

### certainty（層の確実性）

| 値 | 意味 |
|----|------|
| real | 確実に現実 |
| presented_as_real | 物語が現実として提示しているが、保証はない |
| fictional_within_story | 物語内の虚構（劇中劇、作中作） |
| dream | 夢 |
| memory | 回想 |
| ambiguous | 意図的に曖昧 |

### Fragment生成時の層ルール

- Fragmentは原則として単一の層内で完結させる
- 層をまたぐ場合は原作で描かれた越境方法のみ使用可能
- layerAmbiguitiesに記載された曖昧さを解決してはならない

---

## API エンドポイント

### Canon管理（Admin限定）

| メソッド | パス | 説明 |
|---------|------|------|
| POST | /:workId/canon/build | AIでCanon構築 |
| POST | /:workId/canon/import | 手作りCanonを直接投入 |
| PATCH | /:workId/canon | Canon部分更新（作者 or Admin） |
| GET | /:workId/canon | Canon取得 |

### 願いの種（Seeds）

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /:workId/wish-seeds | ランダムに種を取得（デフォルト5個） |
| POST | /:workId/wish-seeds/generate | 種プール生成（Admin限定、50個、既存に追加） |

### Fragment

| メソッド | パス | 説明 |
|---------|------|------|
| POST | /:workId/wish | 願いを送信してFragment生成（非同期、即座にPENDINGを返す） |
| GET | /:workId/fragments | 作品のFragment一覧（フィルタ/ソート/ページネーション） |
| GET | /fragment/:id | Fragment詳細（viewCountインクリメント） |
| GET | /fragment/:id/status | ステータスポーリング用（軽量） |
| POST | /fragment/:id/applause | 拍手トグル |
| POST | /fragment/:id/bookmark | ブックマークトグル |
| DELETE | /fragment/:id | 削除（生成者のみ） |
| GET | /my-fragments | 自分が生成したFragment一覧 |

### 作品一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /works | Canon構築済み作品の一覧（enableWorldFragments: trueのみ） |

---

## フロントエンドページ

| パス | 説明 |
|------|------|
| /world-fragments/ | Canon構築済み作品の一覧 |
| /world-fragments/[workId] | 願い入力 + Fragment閲覧 |
| /world-fragments/[workId]/canon | Canon編集（作者 or Admin） |

全てのページはサイト内のどこからもリンクされていない（Admin限定の作品ページリンクを除く）。

---

## 生成パイプライン

### 1. 願い受付（即座に返す）

```
読者が願いを送信
  → レートリミットチェック（5回/時間）
  → Canon存在・scope確認
  → enableWorldFragmentsフラグ確認
  → PENDING状態のFragmentをDB作成
  → 即座にPENDINGを返す
  → processFragmentを非同期で起動（setImmediate）
```

### 2. 制約チェック（Sonnet）

```
  → 1cr消費（非返金）
  → Canonの確定事実・キャラ制約・世界制約・層構造を渡す
  → 願いが原作と矛盾しないか検証
  → 矛盾あり → REJECTED（理由はユーザー向けの日本語、内部用語なし）
  → 矛盾なし → ガイドライン生成 → 次フェーズへ
```

### 3. Fragment生成（Opus）

```
  → 残りクレジット消費
  → Canonの全データ + 層構造 + ガイドラインをプロンプトに
  → 生成ルール: 原作文体再現、キャラ一貫、constraints厳守
  → 厳禁事項: ヘッダーなし、Canon外の描写なし、認識レベル超過なし
  → 後処理: Markdownヘッダー除去、コードブロック除去
```

### 4. 自己評価（Sonnet）

```
  → 4軸評価: characterConsistency, worldCoherence, literaryQuality, wishFulfillment
  → スコアをqualityScoreに保存
```

### 5. 公開

```
  → PUBLISHED状態に更新
  → トークン使用量をgenerationLogに記録
  → 使用された願いの種のusedCountをインクリメント
  → 種プールの30%以上が消費済みなら自動補充（fire-and-forget）
```

---

## フロントエンドUI

### 願いを紡ぐ

1. wishType選択（4種類のカード）
2. 願いの種（Canonから自動生成、タップで自動入力、「別の種を見る」でリロード）
3. テキスト入力（自由記述も可能）
4. 「断片を願う」ボタン

### 非同期生成UI

願い送信後、即座にプログレスカードが表示される:

```
受付中 → 検証中 → 生成中 → 評価中 → 完了
```

4秒間隔でステータスをポーリング。生成中も他のFragmentを閲覧可能。

### Fragment閲覧

- 一覧: カード形式、新しい順/人気順切り替え、wishTypeフィルタ
- 詳細: 縦書き風のserif表示、拍手（Heartアイコン）、ブックマーク、削除（生成者のみ）
- リジェクト: 琥珀色の穏やかな表示（赤いエラーではない）

---

## クレジットとコスト

### 読者側

| 処理 | コスト | 返金 |
|------|--------|------|
| 制約チェック | 1cr | なし（リジェクトでも消費） |
| Fragment生成 | wishTypeに応じた残額 | 生成失敗時は返金なし |

### Workwrite側（APIコスト）

| 処理 | モデル | 推定コスト |
|------|--------|-----------|
| 制約チェック | Sonnet | $0.01-0.05 |
| Fragment生成 | Opus | $0.3-1.0 |
| 自己評価 | Sonnet | $0.01-0.05 |
| Canon構築 | Sonnet | $1-2（初回）|
| 願いの種生成 | Sonnet | $0.1-0.3 |

### レートリミット

1ユーザーあたり1時間5回まで。超過時: 「願いの回数が上限に達しました。しばらく時間をおいてからお試しください。」

---

## Canon管理

### 構築方法

1. **手作り**: Claude Code等でCanon JSONを作成し、`/canon/import`で投入
2. **AI構築**: `/canon/build`でSonnetが既存データ（StoryCharacter, WorldSetting, EpisodeAnalysis, StoryEvent）から構築
3. **作者編集**: `/world-fragments/[workId]/canon`ページでconstraints, ambiguities, 層構造を編集

### 自動更新

エピソード公開時に`enableWorldFragments: true`の作品のCanon `upToEpisode`が自動更新される（DB更新のみ、AIコストなし）。

### 願いの種

- Canon構築後に`/wish-seeds/generate`で50個生成（Sonnet）
- 既存プールに追加される（補充モード）
- 既存の種と重複しないよう指示
- 多様性ルール: 全キャラカバー、全wishTypeバランス、同じシーン重複なし
- usedCount >= 3が30%超で自動補充

---

## 作品の有効化

1. `enableWorldFragments`フラグをtrueにする（デフォルトfalse）
2. WorldCanonを構築する（手作り or AI構築）
3. 願いの種を生成する
4. フロントエンドでアクセス可能になる

---

## セキュリティ

- Admin限定エンドポイント: canon/build, canon/import, wish-seeds/generate
- 作者 or Admin: canon PATCH
- 生成者のみ: fragment DELETE
- JwtAuthGuard: 全エンドポイント
- レートリミット: 5回/時間/ユーザー
- リジェクトメッセージに内部用語（Canon, WHAT_IF, constraints等）を含めない

---

## 既存システムへの影響

- **影響ゼロ**: 全ての変更は純粋な追加。既存テーブル・サービス・コンポーネントの削除・変更なし
- **enableWorldFragments**: デフォルトfalse。既存作品には一切影響しない
- **エピソード公開フック**: fire-and-forget + フラグチェック。フラグがfalseなら即return
- **作品ページリンク**: ADMIN roleのみに表示。一般ユーザーには見えない
- **フロントエンドページ**: サイト内にリンクなし。URLを直接知らない限り到達不可

---

## 未実装

- **作者収益還元**: WorldFragmentRevenueモデルが必要。purchasedDeducted * 9.8 * 0.4円
- **World Stories**: 断片ではなく連続した物語。設計書のみ（world_stories_design.md）
- **層構造の自動検出テスト**: Canon AI構築時の層検出精度の検証
- **公開Fragment閲覧セクション**: 作品ページにFragment一覧を表示（Admin限定で設計済み、未実装）

---

## ファイル一覧

### バックエンド

```
apps/backend/
  prisma/schema.prisma                                    # WorldCanon, WorldFragment, 関連テーブル
  src/world-fragments/
    world-fragments.module.ts                              # NestJSモジュール
    world-fragments.controller.ts                          # REST APIコントローラー
    dto/
      create-wish.dto.ts                                   # 願い入力DTO
      build-canon.dto.ts                                   # Canon構築DTO
    services/
      world-canon.service.ts                               # Canon構築・更新・種管理
      fragment-generator.service.ts                        # 制約チェック・生成・評価パイプライン
```

### フロントエンド

```
apps/frontend/src/
  lib/world-fragments-api.ts                               # APIクライアント
  app/world-fragments/
    page.tsx                                               # 作品一覧
    [workId]/
      page.tsx                                             # 願いUI + Fragment閲覧
      canon/
        page.tsx                                           # Canon編集
```

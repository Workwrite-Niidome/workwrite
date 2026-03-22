# 編集者モード（Editor Mode）設計書

## コンセプト

「AIが作家、人間が編集者」— 人間は自然言語で作品のビジョンを語り、AIが全話を執筆する。人間はレビュー・修正指示で品質を追い込む。AI Generatedバッジ必須。表示場所・カードデザインも分離。

## モード選択画面の注意表示

`/works/new` で「編集者モード」を選択する画面に以下を明記:

- 「AIが全話を自動生成します。第1話のテイスト確認後にバッチ生成が開始されます」
- 「全自動生成では、話の間に齟齬が生じる可能性があります。レビュー段階でAI修正や手動修正で品質を追い込んでください」
- 「この方法で作成された作品にはAI Generatedバッジが付与され、通常の作品とは別の場所に表示されます」
- 高精度モード（Opus）推奨の案内

## ユーザーフロー

```
Phase 1: 設計対話 → Phase 2: 設計レビュー → Phase 3: 第1話テイスト確認（必須）
                                                          ↓ OK
                                                     Phase 4: 第2話以降バッチ生成
                                                          ↓
                                                     Phase 5: 全話レビュー（AI修正可）
                                                          ↓
                                                        公開
```

### Phase 1: 設計対話（ビジョン構築）

**画面:** `/works/new/editor-mode`

**UI構成:**
- 左側: AIとのチャット（対話で設計を構築）
- 右側: 設計チェックリスト（対話の中で埋まった項目にチェックが入る）

**チェックリスト項目:**
- [ ] ジャンル・舞台
- [ ] テーマ・コアメッセージ
- [ ] 読者に届けたい感情・読後感
- [ ] 主人公
- [ ] 主要キャラクター（2人以上）
- [ ] 世界観・ルール
- [ ] コンフリクト（中心的な葛藤）
- [ ] プロット概要
- [ ] トーン・文体
- [ ] 話数・各話の文字数目安

**AIの振る舞い:**
- 最初の質問: 「どんな物語を作りたいですか？ジャンル、雰囲気、テーマなど自由に教えてください。」
- ユーザーの回答から設定項目を抽出し、チェックリストを自動更新
- 未確定の項目について追加質問
- 全項目が埋まったら「設計が完成しました。レビューしますか？」と提案

**モデル選択:**
- 通常モード（Sonnet）: 1cr/発言
- 高精度モード（Opus）: 5cr/発言
- 画面上部に「消費クレジット: ○○cr / 残り: ○○cr」を常時表示

**データ保存:**
- 対話の結果をdesign.jsonに相当する構造としてWorkCreationPlanに保存
- isAiGenerated = true を作品作成時に設定

### Phase 2: 設計レビュー

**画面:** Phase 1の続き、または `/works/[id]/editor-mode/review`

**UI:**
- 設計書の一覧表示（キャラクター、世界観、プロット、各話概要）
- 各セクションに「修正指示」ボタン
- 修正指示 → AI が該当セクションを書き直し（1cr or 5cr/回）
- 「承認して執筆開始」ボタン

**執筆開始時に表示:**
- 総話数: N話
- 各話の目安文字数: X,XXX字
- 推定クレジット消費:
  - 通常モード: N × 1 = Ncr
  - 高精度モード: N × 5 = N×5cr
- 現在の残りクレジット: XXXcr
- 不足している場合: 「クレジットが不足しています。○○cr追加購入が必要です」

### Phase 3: 第1話テイスト確認（必須）

**トリガー:** 設計レビュー承認後

**フロー:**
1. 第1話のみ先行生成（1cr or 5cr）
2. ユーザーに第1話の全文を提示
3. 必須アクション:
   - 「このテイストでOK → 残りを生成」
   - 「修正指示」→ テキスト入力 → AIが第1話を書き直し（1cr or 5cr/回）
   - 「設計に戻る」→ Phase 1の対話に戻る
4. 承認後にPhase 4（バッチ生成）に進む

**目的:** 全話生成後に「テイストが違う」となると全クレジットが無駄になる。第1話で確認することで手戻りを防ぐ。

### Phase 4: 全話生成（バックグラウンド）

**トリガー:** 第1話テイスト承認後

**生成プロセス:**
1. 第2話以降を順番に生成（第1話の承認済みテイストを踏襲）
2. 各話の生成完了ごとにクレジット消費（1cr or 5cr）
3. 各話の生成完了ごとにDBに保存（下書き状態）
4. 進捗をリアルタイム表示: 「第3話/全15話 生成中... (45cr消費済み)」

**中断・再開:**
- 「停止」ボタンで生成を中断
- 完了分のクレジットのみ消費済み（未生成分は課金されない）
- 残クレジット不足で自動停止 → メッセージ表示
- 「続きから生成」ボタンで未生成の話から再開
- 設計書・完了済みエピソードはDBに保存済みなので品質は落ちない

**生成品質（briefの学びを反映）:**
- 全話を順番に、前話の余韻を抱えたまま書く
- 各話にキラーライン（その話のために存在する一文）を必ず入れる
- 五感描写を全話に入れる（没入力の底上げ）
- キャラクター全員の声の書き分け
- 伏線は設置と回収を明確に

### Phase 5: 編集者レビュー

**画面:** `/works/[id]/editor-mode/review-episodes`

**UI:**
- 全話リスト（各話のステータス: 生成済み / 承認済み / 修正中）
- 各話をクリックすると本文表示
- 各話に4つのアクション:
  - 「承認」— この話はOK
  - 「修正指示」— テキスト入力 → AIが指示に従って書き直し（1cr or 5cr/回）
  - 「AI自動修正」— AIが前後の話との整合性・品質を自動チェックし修正（1cr or 5cr/回）
    - 前後エピソードのコンテキストを踏まえて矛盾を検出・修正
    - キャラの口調揺れ、伏線の整合性、トーンの一貫性を自動修正
  - 「再生成」— この話を最初から書き直し（1cr or 5cr）
- 全話承認で「公開」ボタンが有効に

**AI自動修正のプロンプト:**
- 対象エピソードの前後2話分のコンテキストを含む
- キャラクター設定・世界観設定と照合
- 「修正箇所と理由」をコメントとして表示した上で修正版を提示

## 表示の分離

### ディスカバーページ
- タブ: 「作品」「AI作品」
- デフォルト: 「作品」タブ
- AI作品タブには編集者モードの作品 + isAiGenerated=trueの作品

### カードデザイン
- 通常作品: 現状のまま
- AI作品: カード上部にインディゴのライン + 「AI Generated」バッジ常時表示 + 背景が微かにパープル

### 作品詳細ページ
- 「作者」→「編集者」と表示
- 「この作品はAIが執筆し、{ユーザー名}が編集しました」

## クレジット体系

既存クレジットをそのまま使用。専用プランは不要。

| 工程 | 通常(Sonnet) | 高精度(Opus) |
|------|-------------|-------------|
| 設計対話（1発言） | 1cr | 5cr |
| 設計修正（1回） | 1cr | 5cr |
| 全話生成（1話） | 1cr | 5cr |
| 修正指示（1回） | 1cr | 5cr |
| 再生成（1話） | 1cr | 5cr |

**消費タイミング:** 各操作完了時に即消費。中断時は完了分のみ。

## DB設計

### 既存テーブルの活用
- `Work` — isAiGenerated フラグで判別
- `WorkCreationPlan` — 設計対話の結果を保存
- `Episode` — 生成されたエピソードを保存

### 新規テーブル: EditorModeJob
```
model EditorModeJob {
  id              String   @id @default(cuid())
  workId          String   @unique
  userId          String
  status          String   @default("designing") // designing / generating / paused / reviewing / completed
  aiMode          String   @default("normal")    // normal / premium
  totalEpisodes   Int
  completedEpisodes Int    @default(0)
  creditsConsumed Int      @default(0)
  designChatHistory Json?  // 設計対話の履歴
  episodePlan     Json?    // 各話の概要（タイトル、要約、文字数目安）
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  work Work @relation(fields: [workId], references: [id])
  user User @relation(fields: [userId], references: [id])
}
```

## 技術実装

### バックエンド
- `POST /works/:workId/editor-mode/chat` — 設計対話（SSE）
- `POST /works/:workId/editor-mode/finalize-design` — 設計確定
- `POST /works/:workId/editor-mode/start-generation` — 全話生成開始
- `POST /works/:workId/editor-mode/pause` — 生成中断
- `POST /works/:workId/editor-mode/resume` — 生成再開
- `POST /works/:workId/editor-mode/episodes/:episodeId/revise` — 修正指示（SSE）
- `POST /works/:workId/editor-mode/episodes/:episodeId/regenerate` — 再生成（SSE）
- `GET /works/:workId/editor-mode/status` — ジョブ状態取得

### フロントエンド
- `/works/new/editor-mode` — 設計対話画面
- `/works/[id]/editor-mode` — 生成進捗 + レビュー画面（Phase 3-4統合）

### 生成エンジン（バックエンド）
- 既存のAiAssistServiceを活用
- 1話ずつ順番に生成、前話のcontextを自動注入
- `?skipAnalysis=true` で保存（最後に1回だけ分析）
- 完了後に `analyzeAllEpisodes` + スコアリングを実行

# AI Content Generator (via Workwrite Platform APIs)

Workwriteの全機能を使って、AI生成作品を一括投稿するスクリプト。
**Claude APIを直接叩くのではなく、Workwrite自身のAI機能を通して作品を作る。**

## 生成パイプライン

人間の作家がWorkwriteで作品を作るのと同じフローで動きます:

```
1. 作品作成（isAiGenerated: true）
2. キャラクター生成（Creation Wizard）
3. プロット構築（Creation Wizard）
4. 感情設計（Creation Wizard）
5. 章立て生成（Creation Wizard）
6. 創作プラン保存（characters, plot, emotions, chapters）
7. あらすじ生成
8. 各話を執筆（AI Assist: chapter-opening / continue-writing）
   ※ 構造化コンテキスト（キャラ設定、前話のendState、世界設定等）が自動注入される
9. 作品公開 → 自動スコアリング＋感情タグ生成
```

## 使い方

### 必要なもの

- Workwrite管理者のJWTトークン（`localStorage.getItem('accessToken')` で取得）
- Node.js 22+, tsx

### Dry Run（テーマ一覧の確認のみ）

```bash
npx tsx scripts/ai-content-gen/generate.ts --dry-run --count=10
```

### 本番投稿（5作品ずつ）

```bash
npx tsx scripts/ai-content-gen/generate.ts \
  --backend-url=https://backend-production-db434.up.railway.app \
  --token=eyJxxx \
  --start=0 \
  --count=5
```

### 続きから投稿

```bash
npx tsx scripts/ai-content-gen/generate.ts \
  --token=eyJxxx \
  --start=5 --count=5
```

## パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `--backend-url` | No | Railway本番 | Workwrite Backend URL |
| `--token` | Yes* | - | 管理者JWT（*dry-runでは不要） |
| `--start` | No | 0 | genres.tsのインデックス開始位置 |
| `--count` | No | 5 | 生成する作品数 |
| `--dry-run` | No | false | テーマ一覧を表示するのみ |

## コスト

Workwriteのクレジットを消費します（AI機能をそのまま使うため）:
- Creation Wizard: 4cr/作品（キャラ+プロット+感情+章立て）
- AI Assist: 1cr/話（通常モード）
- 1作品（4話）あたり: 約8cr

50作品 × 8cr = 400cr → Standard プラン2ヶ月分、または追加購入 ¥3,920

## ジャンル構成（genres.ts）

45テーマ × 11ジャンル:
- ファンタジー(8), 恋愛(6), SF(5), ミステリー(4), ホラー(3)
- ヒューマンドラマ(6), コメディ(3), 歴史(2), 青春(3), 冒険(2), 純文学(3)

## なぜClaude API直叩きではないのか

- Workwriteの構造化システム（キャラ管理、伏線追跡、コンテキスト注入）を通して書く
- 生成された作品が「Workwriteの機能で書くとこうなる」ショーケースになる
- スコアリングの精度が上がる（構造データが揃うため）
- 話間の一貫性がWorkwriteの仕組みで担保される

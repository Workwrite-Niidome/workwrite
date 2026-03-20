# AI Content Batch Generator

Workwriteプラットフォームに、AI生成作品を一括投稿するスクリプト。
`isAiGenerated: true` フラグ付きで作品が作成され、フロントに「AI Generated」バッジが表示される。

## 前提条件

- Claude API Key（Haiku使用、低コスト）
- Workwrite管理者のJWTトークン
- Node.js 22+, tsx

## 使い方

### 1. Dry Run（生成のみ、投稿しない）

```bash
npx tsx scripts/ai-content-gen/generate.ts \
  --api-key=sk-ant-xxx \
  --dry-run \
  --count=3
```

### 2. 本番投稿（5作品ずつ）

```bash
npx tsx scripts/ai-content-gen/generate.ts \
  --api-key=sk-ant-xxx \
  --backend-url=https://backend-production-db434.up.railway.app \
  --token=eyJxxx \
  --start=0 \
  --count=5
```

### 3. 続きから投稿

```bash
# 次の5作品（index 5〜9）
npx tsx scripts/ai-content-gen/generate.ts \
  --api-key=sk-ant-xxx \
  --token=eyJxxx \
  --start=5 \
  --count=5
```

## パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `--api-key` | Yes | - | Claude API Key |
| `--backend-url` | No | Railway本番 | Workwrite Backend URL |
| `--token` | Yes* | - | 管理者JWT（*dry-runでは不要） |
| `--start` | No | 0 | genres.tsのインデックス開始位置 |
| `--count` | No | 5 | 生成する作品数 |
| `--dry-run` | No | false | 生成のみ、API投稿しない |

## コスト見積もり

Claude Haiku使用:
- 1作品あたり: ~5000 input + ~15000 output tokens
- 50作品: ~$1.50
- 100作品: ~$3.00

## ジャンル構成（genres.ts）

50テーマを10ジャンルに分散配置:
- ファンタジー: 8作品
- 恋愛: 6作品
- SF: 5作品
- ミステリー: 4作品
- ホラー: 3作品
- ヒューマンドラマ: 6作品
- コメディ: 3作品
- 歴史: 2作品
- 青春: 3作品
- 冒険: 2作品
- 純文学: 3作品

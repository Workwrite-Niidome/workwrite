/**
 * AI Content Batch Generator for Workwrite
 *
 * Usage:
 *   npx tsx scripts/ai-content-gen/generate.ts \
 *     --api-key=sk-ant-... \
 *     --backend-url=https://backend-production-db434.up.railway.app \
 *     --token=eyJ... \
 *     [--start=0] [--count=5] [--dry-run]
 *
 * Requirements:
 *   - Claude API key (Haiku for generation)
 *   - Workwrite backend auth token (admin)
 *   - tsx installed: npx tsx ...
 */

import { GENRE_THEMES, type GenreTheme } from './genres';

// ── Config ──

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);

const CLAUDE_API_KEY = args['api-key'] || process.env.CLAUDE_API_KEY || '';
const BACKEND_URL = args['backend-url'] || 'https://backend-production-db434.up.railway.app';
const AUTH_TOKEN = args['token'] || '';
const START_INDEX = parseInt(args['start'] || '0', 10);
const COUNT = parseInt(args['count'] || '5', 10);
const DRY_RUN = args['dry-run'] === 'true';
const MODEL = 'claude-haiku-4-5-20251001';

if (!CLAUDE_API_KEY) { console.error('ERROR: --api-key required'); process.exit(1); }
if (!AUTH_TOKEN && !DRY_RUN) { console.error('ERROR: --token required (admin JWT)'); process.exit(1); }

// ── Claude API ──

async function callClaude(system: string, user: string, maxTokens = 8000): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ── Generation ──

interface GeneratedWork {
  title: string;
  synopsis: string;
  genre: string;
  episodes: { title: string; content: string }[];
}

async function generateWork(theme: GenreTheme): Promise<GeneratedWork> {
  console.log(`  [plan] Generating plan for: ${theme.theme}`);

  // Phase 1: Plan (title, synopsis, episode titles)
  const planPrompt = `あなたは日本語の小説家です。以下のテーマで小説を書きます。

ジャンル: ${theme.genre}
テーマ: ${theme.theme}
舞台: ${theme.setting}
トーン: ${theme.tone}
エピソード数: ${theme.episodeCount}話

以下のJSON形式で、作品の企画を出力してください（JSONのみ）:
{
  "title": "作品タイトル（魅力的で印象に残る日本語タイトル）",
  "synopsis": "あらすじ（200〜300字。ネタバレなし、読者の興味を引く内容）",
  "episodes": [
    { "title": "第1話タイトル", "outline": "この話で起きること（50字程度）" }
  ]
}`;

  const planText = await callClaude(
    '日本語で回答してください。JSONのみを出力し、前置きや説明は不要です。',
    planPrompt,
    2000,
  );

  const planJson = extractJson(planText);
  if (!planJson) throw new Error('Failed to parse plan JSON');

  const plan = planJson as { title: string; synopsis: string; episodes: { title: string; outline: string }[] };

  console.log(`  [plan] Title: "${plan.title}" (${plan.episodes.length} episodes)`);

  // Phase 2: Write each episode
  const episodes: { title: string; content: string }[] = [];
  let previousEnding = '';

  for (let i = 0; i < plan.episodes.length; i++) {
    const ep = plan.episodes[i];
    console.log(`  [write] Episode ${i + 1}/${plan.episodes.length}: ${ep.title}`);

    const prevContext = previousEnding
      ? `\n\n【前回のラスト】\n${previousEnding}`
      : '';

    const writePrompt = `あなたは日本語の小説家です。以下の情報に基づいて、第${i + 1}話の本文を書いてください。

【作品情報】
タイトル: ${plan.title}
ジャンル: ${theme.genre}
舞台: ${theme.setting}
トーン: ${theme.tone}

【この話の概要】
${ep.outline}
${prevContext}

【指示】
- 2000〜4000文字で書いてください
- 小説の本文のみを出力してください。タイトルや「第○話」などのヘッダーは不要です
- 会話文と地の文をバランスよく配置してください
- 五感を使った描写を含めてください
- ${i === 0 ? '冒頭は読者を引き込むフックから始めてください' : '前回のラストから自然に繋がる書き出しにしてください'}
- ${i === plan.episodes.length - 1 ? '物語を美しく締めくくってください。読後感を大切に' : '次の話への期待を残す終わり方にしてください'}`;

    const content = await callClaude(
      '日本語の小説家として、本文のみを出力してください。メタ的な説明や注釈は不要です。',
      writePrompt,
      6000,
    );

    episodes.push({ title: ep.title, content: content.trim() });

    // Save the ending for next episode's context
    previousEnding = content.trim().slice(-500);

    // Rate limit: wait 1s between episodes
    await sleep(1000);
  }

  return {
    title: plan.title,
    synopsis: plan.synopsis,
    genre: theme.genre,
    episodes,
  };
}

// ── Workwrite API ──

async function postToWorkwrite(work: GeneratedWork): Promise<string> {
  const apiBase = `${BACKEND_URL}/api/v1`;

  // 1. Create work
  const createRes = await fetch(`${apiBase}/works`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      title: work.title,
      synopsis: work.synopsis,
      genre: work.genre,
      isAiGenerated: true,
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Create work failed: ${createRes.status} ${err}`);
  }
  const createData = await createRes.json();
  const workId = createData.data?.id;
  if (!workId) throw new Error('No workId in response');

  console.log(`  [api] Created work: ${workId}`);

  // 2. Create episodes
  for (let i = 0; i < work.episodes.length; i++) {
    const ep = work.episodes[i];
    const epRes = await fetch(`${apiBase}/works/${workId}/episodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        title: ep.title,
        content: ep.content,
        publish: true,
      }),
    });
    if (!epRes.ok) {
      console.warn(`  [api] Episode ${i + 1} creation failed: ${epRes.status}`);
    }
    await sleep(500);
  }

  // 3. Publish work
  const pubRes = await fetch(`${apiBase}/works/${workId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({ status: 'PUBLISHED' }),
  });
  if (!pubRes.ok) {
    console.warn(`  [api] Publish failed: ${pubRes.status}`);
  }

  console.log(`  [api] Published work: ${workId}`);
  return workId;
}

// ── Helpers ──

function extractJson(text: string): unknown | null {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ──

async function main() {
  const themes = GENRE_THEMES.slice(START_INDEX, START_INDEX + COUNT);
  console.log(`\n=== Workwrite AI Content Generator ===`);
  console.log(`Model: ${MODEL}`);
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Themes: ${START_INDEX} to ${START_INDEX + themes.length - 1} (${themes.length} works)`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log('');

  const results: { index: number; title: string; workId: string; episodes: number; status: string }[] = [];

  for (let i = 0; i < themes.length; i++) {
    const theme = themes[i];
    const globalIndex = START_INDEX + i;
    console.log(`[${globalIndex}/${GENRE_THEMES.length}] ${theme.genre} — ${theme.theme}`);

    try {
      const work = await generateWork(theme);
      console.log(`  [done] Generated: "${work.title}" (${work.episodes.length} episodes, ${work.episodes.reduce((s, e) => s + e.content.length, 0)} chars)`);

      if (DRY_RUN) {
        results.push({ index: globalIndex, title: work.title, workId: 'dry-run', episodes: work.episodes.length, status: 'generated' });
        console.log(`  [dry-run] Skipping API post\n`);
        continue;
      }

      const workId = await postToWorkwrite(work);
      results.push({ index: globalIndex, title: work.title, workId, episodes: work.episodes.length, status: 'posted' });
      console.log(`  [done] Posted: ${workId}\n`);

      // Rate limit between works
      await sleep(2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  [ERROR] ${msg}\n`);
      results.push({ index: globalIndex, title: theme.theme, workId: '', episodes: 0, status: `error: ${msg}` });
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Total: ${results.length} works`);
  console.log(`Success: ${results.filter((r) => r.status === 'posted' || r.status === 'generated').length}`);
  console.log(`Errors: ${results.filter((r) => r.status.startsWith('error')).length}`);
  console.log('');
  for (const r of results) {
    console.log(`  [${r.index}] ${r.status.padEnd(12)} "${r.title}" (${r.episodes}ep) ${r.workId}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

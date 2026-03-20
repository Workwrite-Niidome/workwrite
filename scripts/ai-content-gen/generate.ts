/**
 * AI Content Generator using Workwrite's own features
 *
 * This script uses Workwrite's Creation Wizard + AI Assist APIs
 * to generate works the same way a human author would:
 *
 * 1. Create work → 2. Generate characters (Creation Wizard)
 * 3. Generate plot → 4. Generate emotion blueprint
 * 5. Generate chapter outline → 6. Save creation plan
 * 7. Create episodes → 8. Write each episode (AI Assist)
 * 9. Publish → 10. Auto-scoring kicks in
 *
 * Usage:
 *   npx tsx scripts/ai-content-gen/generate.ts \
 *     --backend-url=https://backend-production-db434.up.railway.app \
 *     --token=eyJ... \
 *     [--start=0] [--count=5] [--dry-run]
 */

import { GENRE_THEMES, type GenreTheme } from './genres';

// ── Config ──

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);

const BACKEND_URL = args['backend-url'] || 'https://backend-production-db434.up.railway.app';
const AUTH_TOKEN = args['token'] || '';
const START_INDEX = parseInt(args['start'] || '0', 10);
const COUNT = parseInt(args['count'] || '5', 10);
const DRY_RUN = args['dry-run'] === 'true';
const API = `${BACKEND_URL}/api/v1`;

if (!AUTH_TOKEN && !DRY_RUN) { console.error('ERROR: --token required (admin JWT)'); process.exit(1); }

// ── Helpers ──

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function extractJson(text: string): any | null {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) {
    // Try array
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd > arrStart) {
      try { return JSON.parse(cleaned.slice(arrStart, arrEnd + 1)); } catch { return null; }
    }
    return null;
  }
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
});

// ── API: REST calls ──

async function apiPost(path: string, body: any): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`POST ${path} failed: ${res.status} ${err.slice(0, 200)}`);
  }
  return res.json();
}

async function apiPut(path: string, body: any): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`PUT ${path} failed: ${res.status} ${err.slice(0, 200)}`);
  }
  return res.json();
}

// ── API: SSE stream consumer ──
// All Workwrite AI endpoints return SSE streams. We consume them and collect the full text.

async function consumeSSE(path: string, body: any): Promise<string> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`SSE ${path} failed: ${res.status} ${err.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let parsedData: any = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith(': ping')) continue; // keep-alive
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        if (parsed.text) fullText += parsed.text;
        if (parsed.parsed) parsedData = parsed.parsed;
        if (parsed.error) throw new Error(`SSE error: ${parsed.error}`);
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('SSE error:')) throw e;
      }
    }
  }

  return fullText;
}

// ── Work Generation Pipeline (using Workwrite features) ──

async function generateWorkViaWorkwrite(theme: GenreTheme): Promise<{ workId: string; title: string; episodes: number }> {
  // ─── Step 1: Create Work ───
  console.log('  [1/9] Creating work...');
  const createRes = await apiPost('/works', {
    title: `${theme.theme.slice(0, 50)}`, // Temporary title
    genre: theme.genre,
    isAiGenerated: true,
  });
  const workId = createRes.data?.id;
  if (!workId) throw new Error('Failed to create work');
  console.log(`        workId: ${workId}`);

  try {
    // ─── Step 2: Generate Characters (Creation Wizard) ───
    console.log('  [2/9] Generating characters...');
    const charsText = await consumeSSE(`/works/${workId}/creation/characters`, {
      vision: `${theme.theme}。舞台: ${theme.setting}。トーン: ${theme.tone}`,
      genre: theme.genre,
      themes: theme.theme,
    });
    const charsJson = extractJson(charsText);
    const characters = charsJson?.characters || [];
    console.log(`        ${characters.length} characters generated`);
    await sleep(1000);

    // ─── Step 3: Generate Plot ───
    console.log('  [3/9] Generating plot...');
    const plotText = await consumeSSE(`/works/${workId}/creation/plot`, {
      themes: theme.theme,
      message: `${theme.tone}のトーンで、${theme.setting}を舞台に`,
      emotionGoals: theme.tone,
      characters,
    });
    const plotJson = extractJson(plotText);
    console.log(`        Plot generated: ${plotJson?.premise?.slice(0, 50) || 'OK'}...`);
    await sleep(1000);

    // ─── Step 4: Generate Emotion Blueprint ───
    console.log('  [4/9] Generating emotion blueprint...');
    const emotionText = await consumeSSE(`/works/${workId}/creation/emotions`, {
      coreMessage: theme.theme,
      targetEmotions: theme.tone,
      readerJourney: `${theme.tone}の物語を通じて読者に感動を届ける`,
    });
    const emotionJson = extractJson(emotionText);
    console.log(`        Emotion blueprint generated`);
    await sleep(1000);

    // ─── Step 5: Generate Chapter Outline ───
    console.log('  [5/9] Generating chapter outline...');
    const chaptersText = await consumeSSE(`/works/${workId}/creation/chapters`, {
      plotOutline: plotJson || plotText,
      characters,
      emotionBlueprint: emotionJson || { coreMessage: theme.theme, targetEmotions: theme.tone },
      additionalNotes: `${theme.episodeCount}話構成。各話2000〜3000字`,
    });
    const chaptersJson = extractJson(chaptersText);
    const chapters = chaptersJson?.chapters || chaptersJson || [];
    const chapterList = Array.isArray(chapters) ? chapters : [];
    console.log(`        ${chapterList.length} chapters outlined`);
    await sleep(1000);

    // ─── Step 6: Save Creation Plan ───
    console.log('  [6/9] Saving creation plan...');
    await apiPut(`/works/${workId}/creation/plan`, {
      characters,
      plotOutline: plotJson || { text: plotText },
      emotionBlueprint: emotionJson || { coreMessage: theme.theme, targetEmotions: theme.tone },
      chapterOutline: chapterList,
    });

    // ─── Step 7: Generate Synopsis ───
    console.log('  [7/9] Generating synopsis...');
    const synopsisText = await consumeSSE(`/works/${workId}/creation/synopsis`, {
      context: `タイトル: ${chapterList[0]?.title || theme.theme}\nジャンル: ${theme.genre}\nテーマ: ${theme.theme}\n舞台: ${theme.setting}\nプロット: ${plotJson?.premise || ''}\nキャラクター: ${characters.map((c: any) => c.name).join('、')}`,
    });
    // Update work with synopsis and proper title
    const finalTitle = plotJson?.premise
      ? `${theme.theme.slice(0, 30)}`
      : theme.theme.slice(0, 50);
    await apiPut(`/works/${workId}`, {
      title: finalTitle,
      synopsis: synopsisText.trim().slice(0, 2000),
    });
    console.log(`        Synopsis saved. Title: "${finalTitle}"`);
    await sleep(1000);

    // ─── Step 8: Create & Write Episodes (AI Assist) ───
    const episodeCount = Math.min(chapterList.length, theme.episodeCount) || theme.episodeCount;
    console.log(`  [8/9] Writing ${episodeCount} episodes...`);

    for (let i = 0; i < episodeCount; i++) {
      const chapterInfo = chapterList[i] || {};
      const epTitle = chapterInfo.title || `第${i + 1}話`;

      console.log(`        Episode ${i + 1}/${episodeCount}: "${epTitle}"`);

      // Create episode (empty)
      const epRes = await apiPost(`/works/${workId}/episodes`, {
        title: epTitle,
        content: '',
        publish: false,
      });
      const episodeId = epRes.data?.id;
      if (!episodeId) {
        console.warn(`        Failed to create episode ${i + 1}`);
        continue;
      }

      // Use AI Assist "continue-writing" to write the episode
      // The structural context (characters, plot, previous episodes) is auto-injected by the backend
      const aiText = await consumeSSE('/ai/assist', {
        templateSlug: i === 0 ? 'chapter-opening' : 'continue-writing',
        variables: {
          content: chapterInfo.summary || chapterInfo.title || epTitle,
          workId,
          episodeOrder: String(i),
          char_count: '3000',
          custom_instruction: [
            `この話のタイトル: 「${epTitle}」`,
            chapterInfo.summary ? `この話の概要: ${chapterInfo.summary}` : '',
            chapterInfo.keyScenes?.length ? `主要シーン: ${chapterInfo.keyScenes.join('、')}` : '',
            chapterInfo.emotionTarget ? `感情目標: ${chapterInfo.emotionTarget}` : '',
            i === episodeCount - 1 ? '物語の最終話です。美しく締めくくってください。' : '',
          ].filter(Boolean).join('\n'),
        },
        episodeId,
        aiMode: 'normal',
      });

      // Update episode with generated content
      if (aiText.trim()) {
        await apiPut(`/works/${workId}/episodes/${episodeId}`, {
          title: epTitle,
          content: aiText.trim(),
          publish: true,
        });
        console.log(`        Written: ${aiText.trim().length} chars`);
      } else {
        console.warn(`        AI Assist returned empty text`);
      }

      // Wait between episodes (rate limit + let analysis run)
      await sleep(3000);
    }

    // ─── Step 9: Publish Work ───
    console.log('  [9/9] Publishing work...');
    await apiPut(`/works/${workId}`, { status: 'PUBLISHED' });
    console.log(`        Published!`);

    return { workId, title: finalTitle, episodes: episodeCount };
  } catch (e) {
    // If anything fails, leave the work as draft (don't delete)
    console.error(`  [ERROR] ${e instanceof Error ? e.message : e}`);
    throw e;
  }
}

// ── Main ──

async function main() {
  const themes = GENRE_THEMES.slice(START_INDEX, START_INDEX + COUNT);
  console.log(`\n=== Workwrite AI Content Generator (via Platform APIs) ===`);
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Themes: ${START_INDEX} to ${START_INDEX + themes.length - 1} (${themes.length} works)`);
  console.log(`Dry run: ${DRY_RUN}\n`);

  if (DRY_RUN) {
    console.log('Dry run mode: listing themes only\n');
    for (let i = 0; i < themes.length; i++) {
      const t = themes[i];
      console.log(`  [${START_INDEX + i}] ${t.genre} — ${t.theme} (${t.episodeCount}ep, ${t.setting})`);
    }
    console.log(`\nTotal: ${themes.length} works, ${themes.reduce((s, t) => s + t.episodeCount, 0)} episodes`);
    return;
  }

  const results: { index: number; theme: string; workId: string; title: string; episodes: number; status: string }[] = [];

  for (let i = 0; i < themes.length; i++) {
    const theme = themes[i];
    const globalIndex = START_INDEX + i;
    console.log(`\n[${globalIndex + 1}/${GENRE_THEMES.length}] ${theme.genre} — ${theme.theme}`);
    console.log(`  Setting: ${theme.setting} | Tone: ${theme.tone} | Episodes: ${theme.episodeCount}`);

    try {
      const result = await generateWorkViaWorkwrite(theme);
      results.push({ index: globalIndex, theme: theme.theme, workId: result.workId, title: result.title, episodes: result.episodes, status: 'success' });
      console.log(`  [DONE] ${result.title} → ${result.workId}\n`);

      // Wait between works
      await sleep(5000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ index: globalIndex, theme: theme.theme, workId: '', title: '', episodes: 0, status: `error: ${msg.slice(0, 100)}` });
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  const success = results.filter((r) => r.status === 'success');
  const errors = results.filter((r) => r.status.startsWith('error'));
  console.log(`Success: ${success.length}/${results.length}`);
  console.log(`Errors: ${errors.length}\n`);
  for (const r of results) {
    const icon = r.status === 'success' ? '✓' : '✗';
    console.log(`  ${icon} [${r.index}] "${r.title || r.theme}" (${r.episodes}ep) ${r.workId} ${r.status !== 'success' ? r.status : ''}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

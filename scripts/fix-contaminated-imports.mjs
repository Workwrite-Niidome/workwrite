/**
 * Fix contaminated imported episodes by re-scraping from narou.
 * Uses the updated scraper with correct selectors.
 *
 * Usage: node scripts/fix-contaminated-imports.mjs <token>
 */

import * as cheerio from 'cheerio';

const TOKEN = process.argv[2];
if (!TOKEN) { console.error('Usage: node fix-contaminated-imports.mjs <token>'); process.exit(1); }

const API = 'https://backend-production-db434.up.railway.app/api/v1';
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': `Bearer ${TOKEN}` };

const CONTAMINATED_WORK_IDS = [
  'cmmtaf87o00kont019259a416', // 冒険者ギルドの料理番
  'cmmtb38x900kznt01th77tq23', // 透明令嬢は、カジノ王の不器用な溺愛に、気づかない。
  'cmmtaajb500j9nt01lk9wwmcf', // 【書籍化決定】総合ギルドのチートな債権回収嬢
];

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Workwrite/1.0 (Novel Analysis Tool)' } });
      if (res.status === 429 || res.status >= 500) {
        console.log(`  Retry ${i + 1}: ${res.status}`);
        await sleep(3000 * (i + 1));
        continue;
      }
      return res;
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(3000 * (i + 1));
    }
  }
  throw new Error(`Failed after ${retries} retries`);
}

function extractContent(html) {
  const $ = cheerio.load(html);

  // Current layout (2025+)
  const newLayout = $('.p-novel__body .js-novel-text').text().trim();
  if (newLayout) return newLayout;

  const novelBody = $('.p-novel__body').text().trim();
  if (novelBody) return novelBody;

  // Legacy
  const legacy = $('#novel_honbun').text().trim();
  if (legacy) return legacy;

  const alt = $('.novel_view').text().trim();
  if (alt) return alt;

  return null; // Don't fallback to body - return null so we skip
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  for (const workId of CONTAMINATED_WORK_IDS) {
    console.log(`\n=== Processing work: ${workId} ===`);

    // Get work info to find source URL
    const importRes = await fetch(`${API}/works/import`, { headers });
    // Can't easily get sourceUrl from API, so we'll get it from the work's import record
    // Instead, get episodes and check their ncode from the work's import metadata

    // Get episodes
    const epRes = await fetch(`${API}/works/${workId}/episodes`, { headers });
    const epData = await epRes.json();
    const episodes = epData.data || [];
    console.log(`  Episodes: ${episodes.length}`);

    if (episodes.length === 0) continue;

    // Check first episode to confirm contamination
    const firstEpRes = await fetch(`${API}/episodes/${episodes[0].id}`, { headers });
    const firstEpData = await firstEpRes.json();
    const firstContent = (firstEpData.data || firstEpData).content || '';

    if (!firstContent.includes('googletagmanager') && !firstContent.includes('ログイン')) {
      console.log(`  Not contaminated, skipping`);
      continue;
    }

    // Try to determine ncode from title or existing data
    // We need the sourceUrl - let's try to get it from WorkImport table
    // Since we can't directly query, we'll look for ncode pattern in episode URLs
    // Actually, the episodes were scraped from sequential URLs like ncode.syosetu.com/nXXXX/1/, /2/, etc.

    // Get work title to help identify
    const workRes = await fetch(`${API}/works/${workId}`, { headers });
    const workData = await workRes.json();
    const title = (workData.data || workData).title;
    console.log(`  Title: ${title}`);

    // We need the ncode - let's search narou API for the title
    const searchUrl = `https://api.syosetu.com/novelapi/api/?of=n&title=${encodeURIComponent(title.slice(0, 30))}&out=json&lim=1`;
    const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'Workwrite/1.0' } });
    const searchData = await searchRes.json();

    if (!searchData[1]?.ncode) {
      console.log(`  Could not find ncode for "${title}", skipping`);
      continue;
    }

    const ncode = searchData[1].ncode.toLowerCase();
    console.log(`  Found ncode: ${ncode}`);

    // Re-scrape each episode
    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];
      const epUrl = `https://ncode.syosetu.com/${ncode}/${i + 1}/`;

      console.log(`  Fixing ep ${i + 1}/${episodes.length}: ${ep.title?.slice(0, 20)}...`);

      await sleep(1500); // Rate limit

      try {
        const res = await fetchWithRetry(epUrl);
        if (!res.ok) {
          console.log(`    Failed to fetch: ${res.status}`);
          continue;
        }

        const html = await res.text();
        const content = extractContent(html);

        if (!content || content.length < 50) {
          console.log(`    Content too short or empty, skipping`);
          continue;
        }

        // Update episode via API
        const updateRes = await fetch(`${API}/episodes/${ep.id}?skipAnalysis=true`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ content, title: ep.title }),
        });

        if (updateRes.ok) {
          console.log(`    Updated: ${content.length} chars`);
        } else {
          console.log(`    Update failed: ${updateRes.status}`);
        }
      } catch (e) {
        console.log(`    Error: ${e.message}`);
      }
    }

    console.log(`  Done!`);
  }

  console.log('\n=== All done ===');
}

main().catch(e => { console.error(e); process.exit(1); });

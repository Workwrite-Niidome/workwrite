import fs from 'fs';

const TOKEN = process.argv[2];
if (!TOKEN) { console.error('Usage: node post-work.mjs <token>'); process.exit(1); }

const API = 'https://backend-production-db434.up.railway.app/api/v1';
const BASE = 'C:/Users/kazuk/ultra-reader-first/scripts/ai-content-gen/output';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Authorization': `Bearer ${TOKEN}`,
};

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

async function put(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PUT ${path} → ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  // 1. Create work
  console.log('Creating work...');
  const work = await post('/works', {
    title: '空の骨 ── 竜と契約した少女が知った世界の真実',
    synopsis: '空に浮かぶ島々の世界。島を支える核石は、人々の暮らしを守る神秘の鉱物——とされていた。孤児の少女リーネは、生まれつきの蒼い痣に導かれ、数百年の眠りから目覚めた竜イグナーツと契約を結ぶ。竜と言葉を交わし、島の裏側を見たとき、リーネは世界の成り立ちの残酷な真実に辿り着く。核石の正体。大崩落の真相。そして、この美しい空の下に眠る無数の命。すべてを知った少女は、世界を壊すでも見て見ぬふりをするでもない、第三の道を選ぶ。',
    genre: 'ファンタジー',
    isAiGenerated: true,
  });
  const workId = work.data.id;
  console.log(`Work created: ${workId}`);

  // 2. Post episodes
  const episodes = [
    { file: 'ep1.txt', title: '蒼い痣の少女' },
    { file: 'ep2.txt', title: '銀翼の記憶' },
    { file: 'ep3.txt', title: '執政官の影' },
    { file: 'ep4.txt', title: '骨の島' },
    { file: 'ep5.txt', title: '空の約束' },
  ];

  for (let i = 0; i < episodes.length; i++) {
    const ep = episodes[i];
    const content = fs.readFileSync(`${BASE}/${ep.file}`, 'utf-8');
    console.log(`Posting episode ${i + 1}: ${ep.title} (${content.length} chars)...`);
    const res = await post(`/works/${workId}/episodes`, {
      title: ep.title,
      content,
      publish: true,
    });
    console.log(`  → ${res.data.id}`);
    await new Promise(r => setTimeout(r, 1000));
  }

  // 3. Publish work
  console.log('Publishing work...');
  await put(`/works/${workId}`, { status: 'PUBLISHED' });

  console.log(`\nDone! View at: https://workwrite.jp/works/${workId}`);
}

main().catch(e => { console.error(e); process.exit(1); });

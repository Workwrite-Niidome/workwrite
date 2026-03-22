import fs from 'fs';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1lZm5sOGcwMDAwcGIwMXZkZnBtazVmIiwiZW1haWwiOiJuaWlkb21lQHdvcmt3cml0ZS5jby5qcCIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc3NDAxMTIzNiwiZXhwIjoxNzc0MDE0ODM2fQ.xRAKHE42w_kyQhG9kPKxUzdteQSGlOqJfGm6RJmKAvY';
const API = 'https://backend-production-db434.up.railway.app/api/v1';
const BASE = 'C:/Users/kazuk/ultra-reader-first/scripts/ai-content-gen/output/work09';

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': `Bearer ${TOKEN}` };

async function post(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.text(); throw new Error(`POST ${path} → ${res.status}: ${e.slice(0,200)}`); }
  return res.json();
}
async function put(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.text(); throw new Error(`PUT ${path} → ${res.status}: ${e.slice(0,200)}`); }
  return res.json();
}
async function patch(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.text(); throw new Error(`PATCH ${path} → ${res.status}: ${e.slice(0,200)}`); }
  return res.json();
}

async function main() {
  const design = JSON.parse(fs.readFileSync(`${BASE}/design.json`, 'utf-8'));

  console.log('1. Creating work...');
  const work = await post('/works', {
    title: '勇者、経理部に異動になる。',
    synopsis: '魔王を倒した勇者ユウキ・ブレイブハート、25歳。平和になった王国で——異動を命じられた。行き先は経理部。「剣ではなく電卓を持て」と言われ困惑する勇者。だが王国は戦後の借金で火の車。財政再建は魔王討伐より難しい？ 冷静な上司エリカ、元魔王軍のベテラン経理ゴブリン太郎と共に、勇者は簿記という名の新たな冒険に挑む。「この予算書、俺が斬る！」——斬るな。',
    genre: 'コメディ',
    isAiGenerated: true,
  });
  const workId = work.data.id;
  console.log(`  Work ID: ${workId}`);

  console.log('2. Registering characters...');
  for (const c of design.characters) {
    try {
      await post(`/works/${workId}/characters`, {
        name: c.name, role: c.role||'', gender: c.gender||'', age: c.age||'',
        firstPerson: c.firstPerson||'', personality: c.personality||'',
        speechStyle: c.speechStyle||'', appearance: c.appearance||'',
        background: c.background||'', motivation: c.motivation||'', arc: c.arc||'',
      });
      console.log(`  ✓ ${c.name}`);
    } catch(e) { console.error(`  ✗ ${c.name}: ${e.message.slice(0,100)}`); }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('3. Saving creation plan...');
  try {
    await put(`/works/${workId}/creation/plan`, {
      characters: design.characters,
      plotOutline: design.plotOutline || {},
      emotionBlueprint: design.emotionBlueprint || {},
      chapterOutline: design.chapterOutline || [],
    });
    console.log('  ✓ Plan saved');
  } catch(e) { console.error(`  ✗ ${e.message.slice(0,100)}`); }

  console.log('4. Posting episodes...');
  const titles = [
    '勇者、経理部に異動になる。','勇者の簿記入門','赤字の魔王','将軍との戦い',
    '税制改革の勇者','不正の巣窟','エリカの秘密','決算日','勇者の称号','勇者、経理部にいる。'
  ];
  for (let i = 0; i < titles.length; i++) {
    const content = fs.readFileSync(`${BASE}/ep${i+1}.txt`, 'utf-8');
    console.log(`  ep${i+1}: ${titles[i]} (${content.length} chars)...`);
    await post(`/works/${workId}/episodes`, { title: titles[i], content, publish: true });
    console.log(`  ✓`);
    await new Promise(r => setTimeout(r, 800));
  }

  console.log('5. Publishing...');
  await patch(`/works/${workId}`, { status: 'PUBLISHED' });
  console.log(`\n✅ Done! https://workwrite.jp/works/${workId}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });

import fs from 'fs';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1lZm5sOGcwMDAwcGIwMXZkZnBtazVmIiwiZW1haWwiOiJuaWlkb21lQHdvcmt3cml0ZS5jby5qcCIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc3NDAxODQ1OCwiZXhwIjoxNzc0MDIyMDU4fQ.iX38MATxLxjbV_Fcix4nyrkvpRzZg24HFTIKmbWrM04';
const API = 'https://backend-production-db434.up.railway.app/api/v1';
const BASE = 'C:/Users/kazuk/ultra-reader-first/scripts/ai-content-gen/output/work10';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Authorization': `Bearer ${TOKEN}`,
};

async function post(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${err.slice(0, 300)}`);
  }
  return res.json();
}

async function patch(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PATCH ${path} → ${res.status}: ${err.slice(0, 300)}`);
  }
  return res.json();
}

async function put(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PUT ${path} → ${res.status}: ${err.slice(0, 300)}`);
  }
  return res.json();
}

async function main() {
  const design = JSON.parse(fs.readFileSync(`${BASE}/design.json`, 'utf-8'));

  // 1. Create work
  console.log('Creating work...');
  const work = await post('/works', {
    title: design.title,
    synopsis: design.synopsis,
    genre: '純文学',
    isAiGenerated: true,
  });
  const workId = work.data?.id || work.id;
  console.log(`  Work created: ${workId}`);

  // 2. Register characters
  console.log('Registering characters...');
  for (const char of design.characters) {
    try {
      await post(`/works/${workId}/characters`, {
        name: char.name,
        role: char.role,
        gender: char.gender || '不明',
        age: char.age || '',
        firstPerson: char.firstPerson || '',
        personality: char.personality || '',
        speechStyle: char.speechStyle || '',
        appearance: char.appearance || '',
        background: char.background || '',
        motivation: char.motivation || '',
      });
      console.log(`  Character: ${char.name}`);
    } catch (e) {
      console.error(`  Failed: ${char.name} - ${e.message}`);
    }
  }

  // 3. Save creation plan
  console.log('Saving creation plan...');
  try {
    await put(`/works/${workId}/creation/plan`, {
      characters: design.characters,
      plotOutline: design.plotOutline,
      emotionBlueprint: design.emotionBlueprint,
      chapterOutline: design.chapterOutline,
      worldBuildingData: design.worldBuilding,
    });
    console.log('  Plan saved');
  } catch (e) {
    console.error(`  Plan save failed: ${e.message}`);
  }

  // 4. Post episodes
  console.log('Posting episodes...');
  for (let i = 1; i <= 20; i++) {
    const filePath = `${BASE}/ep${i}.txt`;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const title = lines[0].trim();
    const body = lines.slice(1).join('\n').trim();

    try {
      await post(`/works/${workId}/episodes`, {
        title,
        content: body,
        publish: true,
      });
      console.log(`  Episode ${i}: ${title} (${body.length} chars)`);
    } catch (e) {
      console.error(`  Episode ${i} failed: ${e.message}`);
    }
  }

  // 5. Publish work
  console.log('Publishing work...');
  try {
    await patch(`/works/${workId}`, { status: 'PUBLISHED' });
    console.log('  Published!');
  } catch (e) {
    console.error(`  Publish failed: ${e.message}`);
  }

  console.log(`\nDone! https://workwrite.jp/works/${workId}`);
}

main().catch(e => { console.error(e); process.exit(1); });

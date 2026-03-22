import fs from 'fs';

const REFRESH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1lZm5sOGcwMDAwcGIwMXZkZnBtazVmIiwiZW1haWwiOiJuaWlkb21lQHdvcmt3cml0ZS5jby5qcCIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwianRpIjoiODUxNzBkYjktMDk2Ny00OTBkLTk2ZWItNWYxNTc3Y2MxNWFhIiwiaWF0IjoxNzc0MDE0ODkyLCJleHAiOjE3NzQ2MTk2OTJ9.IWbGtDx_kjqxu5IFU77lKLBQT1ymfjRt6tx409GCNVk';
const API = 'https://backend-production-db434.up.railway.app/api/v1';
const WORK_ID = 'cmmz0tp5o000bmp018pbblq0h';
const BASE = 'C:/Users/kazuk/ultra-reader-first/scripts/ai-content-gen/output/work10';

async function getToken() {
  const res = await fetch(`${API}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: REFRESH_TOKEN }),
  });
  const data = await res.json();
  return data.data.accessToken;
}

async function main() {
  const TOKEN = await getToken();
  console.log('Token refreshed');
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Authorization': `Bearer ${TOKEN}`,
  };

  const epRes = await fetch(`${API}/works/${WORK_ID}/episodes`, { headers });
  const epData = await epRes.json();
  const episodes = epData.data || epData;
  episodes.sort((a, b) => a.orderIndex - b.orderIndex);

  // All modified episodes
  const toUpdate = [1, 8, 11, 12, 13, 15, 16, 17, 18, 20];

  for (const num of toUpdate) {
    const ep = episodes[num - 1];
    if (!ep) { console.error(`Episode ${num} not found`); continue; }
    const content = fs.readFileSync(`${BASE}/ep${num}.txt`, 'utf-8');
    const lines = content.split('\n');
    const title = lines[0].trim();
    const body = lines.slice(1).join('\n').trim();
    const res = await fetch(`${API}/episodes/${ep.id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ title, content: body }),
    });
    if (res.ok) console.log(`Updated ep${num}: ${title} (${body.length} chars)`);
    else console.error(`Failed ep${num}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });

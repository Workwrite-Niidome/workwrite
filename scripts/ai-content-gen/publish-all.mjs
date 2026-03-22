import fs from 'fs';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1lZm5sOGcwMDAwcGIwMXZkZnBtazVmIiwiZW1haWwiOiJuaWlkb21lQHdvcmt3cml0ZS5jby5qcCIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc3NDAxMTIzNiwiZXhwIjoxNzc0MDE0ODM2fQ.xRAKHE42w_kyQhG9kPKxUzdteQSGlOqJfGm6RJmKAvY';
const API = 'https://backend-production-db434.up.railway.app/api/v1';
const BASE = 'C:/Users/kazuk/ultra-reader-first/scripts/ai-content-gen/output';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Authorization': `Bearer ${TOKEN}`,
};

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

async function publishWork(workDir, title, synopsis, genre, episodeTitles) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Publishing: ${title}`);
  console.log(`${'='.repeat(60)}`);

  // Read design
  const design = JSON.parse(fs.readFileSync(`${BASE}/${workDir}/design.json`, 'utf-8'));

  // 1. Create work
  console.log('  1. Creating work...');
  const work = await post('/works', { title, synopsis, genre, isAiGenerated: true });
  const workId = work.data.id;
  console.log(`     Work ID: ${workId}`);

  // 2. Register characters
  console.log('  2. Registering characters...');
  for (const c of design.characters) {
    try {
      const charData = {
        name: c.name, role: c.role || '', gender: c.gender || '',
        age: c.age || '', firstPerson: c.firstPerson || '',
        personality: c.personality || '', speechStyle: c.speechStyle || '',
        appearance: c.appearance || '', background: c.background || '',
        motivation: c.motivation || '', arc: c.arc || '',
      };
      await post(`/works/${workId}/characters`, charData);
      console.log(`     ✓ ${c.name}`);
    } catch(e) { console.error(`     ✗ ${c.name}: ${e.message.slice(0,100)}`); }
    await new Promise(r => setTimeout(r, 300));
  }

  // 3. Save creation plan
  console.log('  3. Saving creation plan...');
  try {
    await put(`/works/${workId}/creation/plan`, {
      characters: design.characters,
      plotOutline: design.plotOutline || {},
      emotionBlueprint: design.emotionBlueprint || {},
      chapterOutline: design.chapterOutline || [],
    });
    console.log('     ✓ Plan saved');
  } catch(e) { console.error(`     ✗ Plan: ${e.message.slice(0,100)}`); }

  // 4. Post episodes
  console.log('  4. Posting episodes...');
  for (let i = 0; i < episodeTitles.length; i++) {
    const file = `${BASE}/${workDir}/ep${i+1}.txt`;
    if (!fs.existsSync(file)) { console.log(`     ⚠ ep${i+1}.txt not found, skipping`); continue; }
    const content = fs.readFileSync(file, 'utf-8');
    console.log(`     ep${i+1}: ${episodeTitles[i]} (${content.length} chars)...`);
    try {
      await post(`/works/${workId}/episodes`, { title: episodeTitles[i], content, publish: true });
      console.log(`     ✓`);
    } catch(e) { console.error(`     ✗ ${e.message.slice(0,100)}`); }
    await new Promise(r => setTimeout(r, 800));
  }

  // 5. Publish
  console.log('  5. Publishing...');
  await patch(`/works/${workId}`, { status: 'PUBLISHED' });
  console.log(`  ✅ Published: https://workwrite.jp/works/${workId}`);
  return workId;
}

async function main() {
  const results = [];

  // Work 2: 最後の依頼人
  results.push(await publishWork('work02', '最後の依頼人',
    '弁護士・桐生誠一郎、六十三歳。来月末で引退する。四十年のキャリアで最も鮮烈な記憶は、二十年前の殺人事件で無罪を勝ち取ったこと。だがある日、その元依頼人・宗方隆が事務所を訪れ、静かに告げた。「先生、あれは冤罪じゃなかった」。法的には二度と裁けない罪。真実を追う桐生の前に立ちはだかるのは、検事になった自分の娘、口を閉ざす元相棒、そして——二十年前の自分自身の判断。引退前夜の弁護士が挑む、判決のない最後の事件。',
    'ミステリー',
    ['引退前夜','告白','二十年前の法廷','検事の娘','三浦沙織の影','消えた証拠','嘘の重さ','黒川の沈黙','事件の夜','弁護士の罪','もう一つの告白','父と娘','法の限界','最後の弁論','判決のない朝']
  ));

  // Work 3: 雨のち、きみの声
  results.push(await publishWork('work03', '雨のち、きみの声',
    '金沢の地方FM局でDJをする篠宮澪、二十七歳。深夜ラジオ『雨のち、おやすみ』で声を届けることが生きがい。ある夜、「ハルカゼ」というリスナーから詩的な投稿が届く。声を仕事にしながら自分の感情を声にできない女性と、声を失い文字でしか想いを伝えられない男。二人は互いの正体も顔も知らないまま、投稿と放送だけで心の距離を縮めていく。番組の打ち切りが決まったとき——沈黙と雨の先に、二人の本当の出会いが待っていた。',
    '恋愛',
    ['雨のち、おやすみ','声のない夜','金曜日のハルカゼ','聴いてくれますか','声が変わる夜','母の周波数','打ち切り','あなたの声がなくなったら','沈黙','傘の下で','最後の放送','雨のち、きみの声']
  ));

  // Work 4: シンギュラリティ・チャイルド
  results.push(await publishWork('work04', 'シンギュラリティ・チャイルド',
    '2030年。人類初のAI-人間ハイブリッドが誕生した。水瀬凛。脳の30%が人工知能の演算機構で構成された少女。1歳で文字を読み、3歳で微積分を理解する——だが、笑い方が分からない。泣くべき場面で泣けない。凛の15年間は「わたしは人間なのか」という問いとの戦いだった。人間とAIの境界線に立つ少女が、15年かけて見つけた答えとは。',
    'SF',
    ['誕生','三歳の微積分','なんで目が青いの','普通という名の呪い','友達の定義','中学生になる','黒崎という名の影','わたしは壊れている','接触','GENESISの夢','異常検知','母の選択','崩壊の始まり','交渉','コアの中へ','目覚め','帰還','法廷','父との対話','新しいカテゴリ','選択','シンギュラリティ・チャイルド']
  ));

  // Work 5: くちなしの家
  results.push(await publishWork('work05', 'くちなしの家',
    '夫の転勤を機に、祖母が遺した古い一軒家に引っ越した長谷川奈緒。庭には白いくちなしが群生し、甘い香りが家の中まで漂っている。廊下が昨日より長い気がする。階段の段数が一つ多い気がする。くちなしが咲くたびに、家は確実に変わっていく。やがて奈緒は押入れの奥から祖母の日記を見つける。花が咲くたび形を変える家。「くちなし」の本当の意味を、奈緒は知ることになる。',
    'ホラー',
    ['くちなしの香り','廊下の長さ','間取りの嘘','拓也の嘘','ハナの日記','家が覚えていること','根','六十年分の記憶','嵐の夜','口無し','冬の静寂','くちなしの家']
  ));

  // Work 6: 千日回峰
  results.push(await publishWork('work06', '千日回峰',
    '柏木俊介、五十二歳。元経済産業省のキャリア官僚。不祥事で懲戒免職。妻に逃げられ、息子に絶縁され、酒に溺れた。行き場を失った男が、比叡山の門を叩いた。千日回峰行。千日かけて約四万キロを歩く荒行。体は軋み、足は血に染まり、心は叫ぶ。七百日目の堂入り——九日間の断食・断水・不眠。人間の限界を超えた先に見えたものは。千日目の朝、山を降りた男の目に映ったのは——変わった自分だった。',
    'ヒューマンドラマ',
    ['山門','一歩目','百日','雪の山','六百日','手紙','堂入り','玄海の過去','別れ','九百五十日','返事','九百九十九日','千日目','山を降りる','千日回峰']
  ));

  // Work 7: 放課後カミナリ
  results.push(await publishWork('work07', '放課後カミナリ',
    '南條陸は学校一の優等生。生徒会長。品行方正。——でも窒息しそうだ。雷道翔は学校一の不良。喧嘩。サボり。反抗。——でも本当は泣きたい。ある日の放課後、屋上で言い争っていた二人に——落雷。目を覚ましたら——入れ替わっていた。元に戻る方法は「相手の人生で一つ、本気で何かを成し遂げること」。他人の靴を履いて走った放課後が——二人の人生を変えていく。',
    '青春',
    ['落雷','ルール','不良の朝','優等生の放課後','本気','文化祭の夜','帰還','変わったもの','母の手術','放課後カミナリ']
  ));

  // Work 8: 花散る大坂
  results.push(await publishWork('work08', '花散る大坂',
    '慶長二十年五月。大坂城は炎に包まれようとしていた。城内に残された侍女たち——千代、志乃、楓——は、それぞれの「生きる理由」を胸に最後の三日間を過ごす。千代は淀殿への忠義と生への渇望の間で揺れ、志乃は「死にたくない」と素直に叫び、楓は冷静に脱出の策を練る。散りゆく城で、三人の女が選んだ道とは。花散る大坂。その美しさと切なさは——四百年後の今も、胸を打つ。',
    '歴史',
    ['落城三日前','志乃の涙','楓の算段','淀殿の涙','前夜','極楽門','紀伊の海','花として','再会','語り部','桜の下で','花散る大坂']
  ));

  console.log('\n' + '='.repeat(60));
  console.log('ALL DONE! Published works:');
  results.forEach((id, i) => console.log(`  Work ${i+2}: https://workwrite.jp/works/${id}`));
}

main().catch(e => { console.error('❌ FATAL:', e.message); process.exit(1); });

/**
 * Populate design data (characters, creation plan) for "空の骨" work
 */

const TOKEN = process.argv[2];
if (!TOKEN) { console.error('Usage: node populate-design.mjs <token>'); process.exit(1); }

const API = 'https://backend-production-db434.up.railway.app/api/v1';
const WORK_ID = 'cmmyi92nx00b0le01ce785oic';

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
  if (!res.ok) { const e = await res.text(); throw new Error(`PATCH ${path} → ${res.status}: ${e.slice(0,200)}`); }
  return res.json();
}

async function main() {
  // 1. Register characters
  const characters = [
    {
      name: 'リーネ', role: '主人公', gender: '女性', age: '15歳',
      firstPerson: 'わたし',
      personality: '素直で好奇心旺盛だが、自分の無力さに劣等感を抱えている。思いやりが深く、傷ついた生き物を放っておけない。決断は遅いが、一度決めたら揺るがない',
      speechStyle: '柔らかい丁寧語ベース。驚くとくだけた口調に。「〜だと思うの」「えっ、本当に？」「……わたしにできることなら」',
      appearance: '亜麻色の髪を三つ編みにしている。小柄で華奢。右手首に生まれつきの青い痣がある',
      background: '浮遊島クレナ島の孤児院で育った。両親の記憶はない。右手首の痣を気味悪がられ、島の子どもたちから距離を置かれて育った',
      motivation: '自分が何者なのかを知りたい。痣の意味を知りたい。居場所を見つけたい',
      arc: '無力な少女 → 竜との契約で力を得る → 真実を知り絶望 → それでも守りたいものを選ぶ',
    },
    {
      name: 'イグナーツ', role: 'メンター', gender: '男性', age: '外見20代半ば（実際は数百歳）',
      firstPerson: '俺',
      personality: '皮肉屋で口が悪いが、根は優しい。長く生きてきたゆえの諦観がある。リーネに対しては不器用に気遣う',
      speechStyle: 'ぶっきらぼうで投げやり。「知るか」「勝手にしろ」「……まあ、仕方ねえな」。たまに古風な言い回しが混じる',
      appearance: '人間の姿では銀髪に金色の瞳の青年。竜の姿は蒼い鱗に銀の翼',
      background: 'かつて世界を支えた「始原の竜」の末裔。数百年前の大戦で仲間を失い、以来人間を避けて雲の上で眠っていた',
      motivation: 'リーネの痣に反応して目覚めた。契約の意味を自分も完全には理解していない。リーネを守ることが、最後の役目だと感じている',
      arc: '諦観 → リーネを通じて再び守りたいものを見つける → 自分の過去と向き合い、真実を告げる覚悟を決める',
    },
    {
      name: 'シオン', role: '幼馴染', gender: '男性', age: '16歳',
      firstPerson: '僕',
      personality: '穏やかで理知的。本が好きで、島の歴史に詳しい。リーネを幼い頃から見守ってきた。優しいが、決定的な場面で一歩引いてしまう弱さがある',
      speechStyle: '丁寧で落ち着いた口調。「〜だと思うよ」「調べてみたんだけど」「リーネ、無理しないで」',
      appearance: '黒髪眼鏡。細身で背が高い。いつも本を持っている',
      background: '孤児院でリーネと共に育った。島の図書館で働いている。古い文献から島々の歴史の矛盾に気づき始めている',
      motivation: 'リーネの力になりたい。島の歴史の真実を学問的に解き明かしたい',
      arc: '安全な場所から見守る → 自分も行動する覚悟を決める',
    },
    {
      name: 'ヴェルト', role: '敵役', gender: '男性', age: '40代',
      firstPerson: '私',
      personality: '冷徹で計算高い。だが、すべての行動の裏に島民を守りたいという信念がある。手段を選ばない合理主義者',
      speechStyle: '慇懃で隙がない。「ご理解いただけますか」「残念ですが、選択肢はありません」「——私とて、好んでいるわけではない」',
      appearance: '白髪交じりの黒髪。鋭い目つき。常に整った身なりの執政官服',
      background: '浮遊島連合の執政官。島々を浮かせている核石の秘密を知る数少ない人間。その秘密を守るために、竜の末裔を排除しようとしている',
      motivation: '島民の安全を守るため、世界の真実を隠し続けること。リーネの覚醒は島の存続を脅かすと考えている',
      arc: '冷徹な支配者 → 自分の信念の限界に気づく → リーネの選択を見届ける',
    },
  ];

  console.log('Registering characters...');
  for (const c of characters) {
    try {
      const res = await post(`/works/${WORK_ID}/characters`, c);
      console.log(`  ✓ ${c.name} (${c.role})`);
    } catch (e) {
      console.error(`  ✗ ${c.name}: ${e.message}`);
    }
  }

  // 2. Save creation plan
  console.log('\nSaving creation plan...');
  await put(`/works/${WORK_ID}/creation/plan`, {
    characters: characters,
    plotOutline: {
      premise: '空に浮かぶ島々の世界で、孤児の少女リーネは生まれつきの青い痣に導かれ、数百年の眠りから目覚めた竜イグナーツと契約を結ぶ。竜と言葉を交わし、島の裏側を見たとき、リーネは世界の成り立ちの残酷な真実——島を浮かせている核石が竜の骨であり、人間は竜を殺して世界を維持してきたという事実——に辿り着く',
      centralConflict: '世界を維持するために竜を滅ぼし続けるか、竜と共存する別の道を探すか。リーネは両方の立場の間で引き裂かれる',
      themes: ['真実を知る勇気と責任', '共存と犠牲', '自分の居場所は自分で選ぶ'],
      type: 'structured',
      actGroups: [
        {
          label: '第一幕：契約',
          description: 'リーネが竜イグナーツと出会い、契約を結ぶ。日常が一変し、自分の痣の意味を探り始める',
          episodes: [
            { title: '蒼い痣の少女', whatHappens: '核石倉庫での異変→竜の目覚め→契約成立', emotionTarget: '好奇心と不安' },
          ]
        },
        {
          label: '第二幕：真実',
          description: 'リーネは核石の秘密に近づき、ヴェルトに追われる。世界の真実を知り、絶望と葛藤を経験する',
          episodes: [
            { title: '銀翼の記憶', whatHappens: 'イグナーツとの信頼構築→シオンの古文書発見', emotionTarget: '信頼の芽生え' },
            { title: '執政官の影', whatHappens: 'ヴェルトの追跡→逃亡→島の裏側で核石の紋様を目撃', emotionTarget: '恐怖と焦り' },
            { title: '骨の島', whatHappens: '核石が竜の骨だと判明→イグナーツの過去の全貌→リーネの絶望', emotionTarget: '絶望と衝撃' },
          ]
        },
        {
          label: '第三幕：選択',
          description: 'リーネは第三の道を選び、ヴェルトと対話し、契約の力で新しい可能性を示す',
          episodes: [
            { title: '空の約束', whatHappens: 'リーネの決断→ヴェルトとの対話→新しい契約の形→島の夜明け', emotionTarget: '決意と希望' },
          ]
        },
      ],
    },
    emotionBlueprint: {
      coreMessage: '真実を知ることの痛みと、それでも前に進む勇気',
      targetEmotions: '感動、勇気、切なさ',
      readerJourney: '好奇心→信頼→恐怖→絶望→希望へと読者の感情を導く',
    },
    chapterOutline: [
      { title: '蒼い痣の少女', summary: 'リーネの日常→痣の異変→竜との遭遇→契約成立', keyScenes: ['核石倉庫の異変', '屋根の上での竜との出会い', '契約の成立'], characters: ['リーネ', 'イグナーツ', 'シオン'], emotionTarget: '好奇心と不安', emotionIntensity: 4 },
      { title: '銀翼の記憶', summary: 'イグナーツとの生活→彼の過去の断片→シオンが古文書の矛盾を発見', keyScenes: ['廃鐘楼での会話', 'イグナーツの独り言', '図書館での地図発見'], characters: ['リーネ', 'イグナーツ', 'シオン'], emotionTarget: '信頼の芽生え', emotionIntensity: 5 },
      { title: '執政官の影', summary: 'ヴェルトがリーネを追う→逃亡→島の裏側で核石の紋様を目撃', keyScenes: ['ヴェルトの訪問', '竜の背での飛行', '島の裏側の骨格紋様'], characters: ['リーネ', 'イグナーツ', 'ヴェルト'], emotionTarget: '恐怖と焦り', emotionIntensity: 7 },
      { title: '骨の島', summary: '核石の真実判明→イグナーツの過去の全貌→リーネの絶望', keyScenes: ['真実の告白', 'かつての契約者の話', '島の端での慟哭'], characters: ['リーネ', 'イグナーツ'], emotionTarget: '絶望と衝撃', emotionIntensity: 9 },
      { title: '空の約束', summary: 'リーネの決断→ヴェルトとの対話→新しい契約→夜明けの島', keyScenes: ['クレナ島への帰還', 'ヴェルトとの対話', '核石への共鳴', '屋根の上の再会'], characters: ['リーネ', 'イグナーツ', 'シオン', 'ヴェルト'], emotionTarget: '決意と希望', emotionIntensity: 8 },
    ],
    worldBuildingData: {
      basics: {
        era: '空に浮かぶ島々の世界。中世ファンタジー。銃器・電気・通信機器は存在しない',
        setting: 'かつて大地は一つだったが、数百年前の「大崩落」で砕け散り、無数の島が空に浮かぶ世界。島々は核石の力で浮遊している',
        civilizationLevel: '中世レベル。飛行艇と吊り橋で島間を移動',
      },
      rules: [
        { name: '核石', description: '島を浮遊させる鉱物。青白く発光する。枯渇すると島は落下する', constraints: '採掘量に限りがあり、人工的に生成できない' },
        { name: '竜契約', description: '竜と人間が血の盟約を結ぶ古代の儀式。契約者は竜の力の一部を借りられる', constraints: '契約は生涯に一度だけ。右手首に契約の痣が現れる' },
        { name: '世界の真実', description: '核石は竜の骨の化石。島を浮かせているのは死んだ竜の残留する力', constraints: '執政官の中でもごく少数しか知らない' },
      ],
      terminology: [
        { term: '大崩落', reading: 'たいほうらく', definition: '数百年前に大地が砕け散った大災害。実際は人間と竜の大戦が原因' },
        { term: '核石', reading: 'かくせき', definition: '島を浮遊させる青白い鉱物。実態は竜の骨の化石' },
        { term: '浮遊島連合', reading: 'ふゆうとうれんごう', definition: '主要な浮遊島が形成する統治機構' },
        { term: '始原の竜', reading: 'しげんのりゅう', definition: '世界の創成に関わったとされる竜の一族。イグナーツはその末裔' },
      ],
    },
  });
  console.log('✓ Creation plan saved');

  // 3. Update work metadata
  const patchRes = await fetch(`${API}/works/${WORK_ID}`, {
    method: 'PATCH', headers, body: JSON.stringify({ genre: 'ファンタジー' }),
  });
  if (!patchRes.ok) console.warn('Work update failed:', patchRes.status);
  console.log('✓ Work updated');

  console.log(`\nDone! View at: https://workwrite.jp/works/${WORK_ID}/edit`);
}

main().catch(e => { console.error(e); process.exit(1); });

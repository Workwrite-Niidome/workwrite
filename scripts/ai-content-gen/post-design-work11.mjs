import { readFileSync } from 'fs';
import { join } from 'path';

const TOKEN = process.argv[2];
if (!TOKEN) { console.error('Usage: node post-design-work11.mjs <token>'); process.exit(1); }

const API = 'https://backend-production-db434.up.railway.app/api/v1';
const WORK_ID = 'cmn1r2vps0011nl01oulug48w';
const DIR = join('C:', 'Users', 'kazuk', 'ultra-reader-first', 'scripts', 'ai-content-gen', 'output', 'work11');

const design = JSON.parse(readFileSync(join(DIR, 'design.json'), 'utf-8'));

async function post(path, body) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': 'Bearer ' + TOKEN },
    body: JSON.stringify(body)
  });
  if (!res.ok) { const e = await res.text(); console.log('FAIL ' + path + ': ' + res.status + ' ' + e.substring(0,200)); return null; }
  return await res.json();
}

async function main() {
  const chars = [
    { name: 'シノ（東雲花）', role: 'PROTAGONIST', gender: 'FEMALE', age: '17-19', firstPerson: 'わたし',
      personality: '静かで観察的、芯が強い。足りない子供。欲張り。', speechStyle: '短く正確。感情は沈黙に出る。',
      appearance: '165cm。黒髪。灰色の瞳。片刃を腰に。', background: '交通事故で昏睡状態の高校生。異世界で接ぎ手として目覚める。',
      motivation: '全部ほしい。二つの世界の全てに手を伸ばし続ける。', arc: '何もない子供→静眼のシノ→足りない子供' },
    { name: 'ユイ', role: 'HEROINE', gender: 'FEMALE', age: '18', firstPerson: 'わたし',
      personality: '温かく世話焼き、芯が強い。', speechStyle: '柔らかいが芯がある。',
      appearance: '160cm。栗色の三つ編み。琥珀色の目。', background: '白霧の進行域に近い村出身の治癒師。',
      motivation: '大切な人の隣にいること。', arc: '保護者→パートナー→シノの心臓' },
    { name: 'ルカ', role: 'PARTY_MEMBER', gender: 'MALE', age: '19', firstPerson: '俺',
      personality: '気さくで率直。不器用な優しさ。', speechStyle: '砕けた口調。',
      appearance: '長身。緑の目。弓を背に。', background: '辺境の猟師の息子。',
      motivation: '仲間と走ること。', arc: '弓使い→シノの足→ノアの弓の師' },
    { name: 'トウカ', role: 'PARTY_MEMBER', gender: 'FEMALE', age: '24', firstPerson: '私',
      personality: '寡黙、厳格。かつて11人を失った。', speechStyle: '短く断定的。',
      appearance: '175cm。銀白色の短髪。青い目。', background: '元騎士団。11人の部下を失い退役。',
      motivation: '二度と失わないこと。', arc: '凍った剣士→柱→復興顧問' },
    { name: 'シオン', role: 'PARTY_MEMBER', gender: 'FEMALE', age: '16', firstPerson: 'わたし',
      personality: '知的で冷静。データと論理。', speechStyle: '丁寧語。',
      appearance: '小柄。紫の目。眼鏡。ノート常備。', background: '天文学者の母を持つ魔術師。',
      motivation: '世界を記録すること。', arc: '記録者→論文著者→ハクアの後継者' },
    { name: 'ノア', role: 'SUPPORTING', gender: 'OTHER', age: '800+', firstPerson: 'わたし',
      personality: '静か。透明。八百年の孤独。', speechStyle: '穏やか。',
      appearance: '年齢不詳。透明な目。', background: '八百年前の接ぎ手。SHN-0001。',
      motivation: '隣に人がいること。', arc: '孤独→仲間→温かい手' },
    { name: 'ベル', role: 'SUPPORTING', gender: 'MALE', age: '50代', firstPerson: 'わし',
      personality: '無骨。片腕。意地で料理を作る。', speechStyle: '「食え」「当然だ」',
      appearance: '片腕。エプロン。', background: '星降り亭の主人。',
      motivation: '食わせる相手がいること。', arc: '料理人→全員の錨→もう一人のお母さん' },
    { name: 'ジーク', role: 'SUPPORTING', gender: 'MALE', age: '60代', firstPerson: 'わし',
      personality: '豪快だが繊細。味覚十割。', speechStyle: '率直。',
      appearance: '大柄。皺の目。', background: '元銀ランク冒険者。ヒナの師匠。',
      motivation: '弟子を育てること。', arc: '引退した老兵→師匠→帰る心を教える人' },
    { name: 'サラ', role: 'SUPPORTING', gender: 'FEMALE', age: '11-12', firstPerson: 'わたし',
      personality: '真面目。学者気質。世界に届く声。', speechStyle: '丁寧。',
      appearance: '成長期。灰色の目。', background: 'ハクアの弟子。裏返しの歌を歌える唯一の人。',
      motivation: 'シノのために歌うこと。', arc: '弟子→唱詠師→世界を裏返す歌い手' },
    { name: 'ヒナ', role: 'SUPPORTING', gender: 'FEMALE', age: '10', firstPerson: 'わたし',
      personality: '元気。まっすぐ。嘘がない。', speechStyle: '明るい。',
      appearance: '大きな目。銅の札。', background: 'ジークの弟子。10歳で銅ランク。',
      motivation: 'パーティ暁の斥候になること。', arc: '子供→銅ランク冒険者' },
    { name: 'ハクア', role: 'SUPPORTING', gender: 'MALE', age: '70代', firstPerson: 'わし',
      personality: '学者の頑固さ。五十年の研究。', speechStyle: '学術的。',
      appearance: '白髪。杖二本。', background: '白霧研究者50年。シオンとサラの師匠。',
      motivation: '見届けること。', arc: '孤独な研究者→師匠→見届ける人' }
  ];

  for (const c of chars) {
    const r = await post('/works/' + WORK_ID + '/characters', c);
    console.log(r ? 'OK char: ' + c.name : 'FAIL char: ' + c.name);
    await new Promise(r => setTimeout(r, 300));
  }

  // Design memo
  const plan = {
    characters: chars,
    plotOutline: {
      premise: design.synopsis,
      centralConflict: '「全部ほしい」vs「全部は手に入らない」。足りない子供が手を伸ばし続ける物語。',
      themes: ['見ること', '足りないから手を伸ばす', '帰る場所があるから強い', '食べることは生きること'],
      type: 'MULTI_ARC',
      actGroups: [
        { title: '第一部 辺境篇', episodes: '1-50' },
        { title: '第二部 王都篇', episodes: '51-90' },
        { title: '第三部 接続篇', episodes: '91-141' },
        { title: '第四部 千本篇', episodes: '142-170' },
        { title: '第五部 夜明け篇', episodes: '171-200' }
      ]
    },
    emotionBlueprint: {
      coreMessage: '世界は美しく、終わりはない。足りないから手を伸ばし続ける。',
      targetEmotions: ['没入感', '郷愁', '温かさ', '畏怖', '切なさ', '希望'],
      readerJourney: 'なろう系として読み始める→世界の美しさに引き込まれる→キャラクターに恋をする→千本目で心を壊される→最終話で「また明日」と言われて泣く'
    },
    chapterOutline: [
      { title: '第一部 辺境篇', summary: 'ep1-50。草原で目覚め、仲間と出会い、王都へ' },
      { title: '第二部 王都篇', summary: 'ep51-90。政治と白霧の真実。接ぎ手の覚醒' },
      { title: '第三部 接続篇', summary: 'ep91-141。修復開始。共鳴訓練。北方遠征' },
      { title: '第四部 千本篇', summary: 'ep142-170。東方の森。千本目。手紙配達。返事' },
      { title: '第五部 夜明け篇', summary: 'ep171-200。最後の一針。裏返し。門。再会。完結' }
    ],
    worldBuildingData: {
      basics: { setting: design.worldBuilding.overview },
      rules: { magic: design.worldBuilding.magicSystem.mechanism, whiteMist: design.worldBuilding.whiteMist.description },
      terminology: {
        '白霧': '世界の傷の修復プログラム',
        '接ぎ手': '世界の修復因子',
        '静眼': '世界の編み目が見える目',
        '裏返し': '世界を一枚の布に戻す行為',
        '星降り亭': 'ベルの食堂。全員の帰る場所',
        'しゃりん': '研ぎ石の音。自分を整える儀式'
      }
    }
  };

  const putRes = await fetch(API + '/works/' + WORK_ID + '/creation/plan', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': 'Bearer ' + TOKEN },
    body: JSON.stringify(plan)
  });
  console.log(putRes.ok ? 'OK design memo' : 'FAIL design memo: ' + putRes.status);

  // Publish
  const pubRes = await fetch(API + '/works/' + WORK_ID, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': 'Bearer ' + TOKEN },
    body: JSON.stringify({ status: 'PUBLISHED' })
  });
  console.log(pubRes.ok ? 'OK published' : 'FAIL publish: ' + pubRes.status);
}

main().catch(e => console.error(e));

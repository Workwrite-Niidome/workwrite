import fs from 'fs';

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1lZm5sOGcwMDAwcGIwMXZkZnBtazVmIiwiZW1haWwiOiJuaWlkb21lQHdvcmt3cml0ZS5jby5qcCIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc3Mzk5NDIxMywiZXhwIjoxNzczOTk3ODEzfQ.kxqu_HWMersZ6xvAvz7goDXbrJXaEFYi4jamp4DxwFA';
const API = 'https://backend-production-db434.up.railway.app/api/v1';
const BASE = 'C:/Users/kazuk/ultra-reader-first/scripts/ai-content-gen/output/work01';

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Authorization': `Bearer ${TOKEN}`,
};

async function post(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.text(); throw new Error(`POST ${path} → ${res.status}: ${e.slice(0,300)}`); }
  return res.json();
}
async function put(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.text(); throw new Error(`PUT ${path} → ${res.status}: ${e.slice(0,300)}`); }
  return res.json();
}
async function patch(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.text(); throw new Error(`PATCH ${path} → ${res.status}: ${e.slice(0,300)}`); }
  return res.json();
}

async function main() {
  // 1. Create work
  console.log('1. Creating work...');
  const work = await post('/works', {
    title: '灰の魔導書と忘却の王',
    synopsis: '魔法が禁忌とされた帝国で、魔法書を焼き続ける焚書官の青年カイ。ある夜、燃え尽きてもなお灰から蘇る一冊の本と出会う。「灰の魔導書」と名乗るその本は、世界から消された真実を知る最後の証人だった。帝国を追われたカイは、禁書を守る少女リーゼ、故郷を失った旅商人トールと共に、五十年前に世界を変えた「大忘却」の真相を追う。待ち受けるのは、人類から記憶を奪った忘却の王。知ることの痛みと、忘れることの安らぎの狭間で、カイは世界の命運を握る選択を迫られる。',
    genre: 'ファンタジー',
    isAiGenerated: true,
  });
  const workId = work.data.id;
  console.log(`  Work created: ${workId}`);

  // 2. Register characters
  console.log('2. Registering characters...');
  const characters = [
    { name: 'カイ・アルヴェン', role: '主人公', gender: '男性', age: '19歳', firstPerson: '俺', personality: '正義感が強いが、組織への忠誠と自分の良心の間で揺れる葛藤を抱えている。好奇心旺盛で、禁じられたものほど惹かれてしまう性質。', speechStyle: 'ぶっきらぼうだが芯のある口調。「……別に、そういうつもりじゃねえよ」「知らねえな。だが、放っておけるかよ」', appearance: '灰色がかった黒髪を無造作に束ねている。焚書官の黒い長衣。左手の甲に焚書官の焼印。鋭い琥珀色の瞳。', background: '戦災孤児として帝都の孤児院で育ち、14歳で焚書庁に徴用された。両親の記憶がなく、それが物語の核心に繋がる。', motivation: '自分が焼いてきた本の中に何が書かれていたのかを知りたい。やがて帝国の真実を暴くことが目的に変わる。', arc: '忠実な焚書官 → 禁書に触れ疑問を持つ → 帝国の嘘を知り反逆を決意 → 真実を世界に解き放つ' },
    { name: 'リーゼ・フォン・ネーベル', role: 'ヒロイン', gender: '女性', age: '18歳', firstPerson: '私', personality: '知的で冷静、だが内面には激しい怒りを秘めている。皮肉屋だが根は優しく、弱者を見捨てられない。', speechStyle: '丁寧だが棘のある口調。「あら、焚書官さんにしては随分と本に詳しいのね」「私が助けたのは、あなたではなく知識よ」', appearance: '銀髪を肩で切り揃えている。深い青の瞳。学者風の眼鏡。', background: 'かつて帝国最大の魔法図書館の司書長だった祖母を持つ。禁書令で祖母は処刑された。「書の守り手」の一員。', motivation: '祖母の遺志を継ぎ、焼かれた知識を取り戻す。帝国の禁書政策を終わらせる。', arc: '復讐心に駆られた書の守り手 → カイとの旅で視野が広がる → 復讐ではなく未来のために戦う' },
    { name: 'ヴォルス・ガルデン', role: '敵役', gender: '男性', age: '45歳', firstPerson: '私', personality: '冷徹で合理的だが、カイに対してだけ微かな温情を見せる。帝国への忠誠の根底にある恐怖に本人は気づいていない。', speechStyle: '低く静かな口調。丁寧語だが圧がある。「カイ、お前は優秀な焚書官だ。だからこそ——余計なことを考えるな」', appearance: '銀混じりの黒髪をオールバックに。焚書庁長官の白い長衣に金の肩章。左目に古い刀傷。', background: '魔法戦争を経験し、魔法の暴走で故郷と家族を失った。忘却の王との密約者。', motivation: '魔法の完全な根絶による恒久平和の実現。', arc: '秩序の守護者 → カイの反逆で信念が揺らぐ → 自らの恐怖と向き合い選択を迫られる' },
    { name: '灰の魔導書（セラフ）', role: 'メンター', gender: '不明', age: '推定800年以上', firstPerson: '我', personality: '気まぐれで皮肉屋だが、深い慈愛を持つ。膨大な知識を持ちながら、すべてを語ろうとしない。', speechStyle: '古風で詩的。「我が頁を繙くか、焚書の子よ。真実とは、常に灰の中から立ち昇るものだ」', appearance: '表紙が焼け焦げた古い革装丁の本。頁は灰色だが、読む者の資質に応じて文字が浮かび上がる。', background: '魔法文明の最盛期に創られた知識の器。忘却の王によって焼かれたが、完全には滅びず意識だけが残った。', motivation: '正しき読み手を導き、忘却の王の呪いを解いて世界に知識を取り戻す。', arc: '断片的な意識 → カイとの対話で人格が回復 → 全力解放で記憶を返し消滅する' },
    { name: '忘却の王（オブリヴィオン）', role: '黒幕', gender: '不明', age: '不明', firstPerson: '余', personality: '超然としているが人間への深い失望がある。かつて人間を愛していたが魔法戦争での愚かさに絶望した。', speechStyle: '荘厳で静か。「忘れよ。それが余の慈悲だ」「知識とは毒だ。人は知れば知るほど、殺し合う理由を見つける」', appearance: '輪郭のない白い霧のような存在。対話時には白い仮面と白いローブの人型。', background: '世界創生時に記憶を司る存在として生まれた。大忘却を実行し魔法文明を終わらせた。', motivation: '人間から魔法の記憶を永遠に消し去り、無知の平和を実現する。', arc: '絶対的な存在 → カイの意志に動揺 → 最終的にカイに選択を委ねる' },
    { name: 'トール・レンカ', role: '脇役（仲間）', gender: '男性', age: '22歳', firstPerson: '僕', personality: '陽気で楽天的。ムードメーカーだが、仲間を失った過去から来る「見捨てない」という執念がある。', speechStyle: '軽く明るい口調。「ま、なんとかなるっしょ！ ……なんとかするしかないしな」「腹が減っては冒険はできぬ、ってね」', appearance: '赤毛の短髪。そばかすが散った童顔。大きなリュックを常に背負っている。', background: '元旅商人。魔法禁止令で故郷ケルン村が滅ぼされ、唯一の生き残り。', motivation: '故郷の記憶を守ること。仲間を二度と失わないこと。', arc: '気楽な協力者 → 本気で戦う覚悟を決める → 故郷再建の希望を見出す' },
  ];
  for (const c of characters) {
    try {
      await post(`/works/${workId}/characters`, c);
      console.log(`  ✓ ${c.name}`);
    } catch(e) { console.error(`  ✗ ${c.name}: ${e.message}`); }
    await new Promise(r => setTimeout(r, 500));
  }

  // 3. Save creation plan
  console.log('3. Saving creation plan...');
  await put(`/works/${workId}/creation/plan`, {
    characters,
    plotOutline: {
      premise: '魔法が禁忌とされた帝国で、魔法書を焼く焚書官の青年カイが、破壊すべき最後の魔導書に導かれ、世界から消された真実を取り戻す旅に出る。',
      centralConflict: '知識と忘却——真実を知る苦痛と、無知の安寧のどちらが人間にとって幸せなのか',
      themes: ['知識の力と責任', '記憶とアイデンティティ', '秩序と自由', '赦しと再生'],
      type: 'structured',
      actGroups: [
        { label: '第一幕：灰の中の火種', description: '焚書官カイの日常と、灰の魔導書との運命的な出会い。帝国の秩序の中で芽生えた疑問が逃亡に爆発する。', episodes: [{title:'焚書の夜'},{title:'燃えない本'},{title:'禁書街の影'},{title:'灰の声'},{title:'裏切りの朝'}] },
        { label: '第二幕：境界域の旅路', description: '帝国の外へ逃れたカイたちは失われた魔法文明の痕跡を辿り、世界の真実に近づく。', episodes: [{title:'書の守り手'},{title:'旅商人トール'},{title:'境界域'},{title:'遺跡の記憶'},{title:'大忘却の真相'},{title:'追撃'},{title:'失われゆく記憶'},{title:'ヴォルスの傷痕'},{title:'亀裂と再起'}] },
        { label: '第三幕：忘却の王', description: '忘却の座での最終決戦。カイは世界に選択を返す。', episodes: [{title:'忘却の座'},{title:'父と子'},{title:'白い仮面の下'},{title:'セラフの歌'},{title:'選択'},{title:'灰と光'}] },
      ],
    },
    emotionBlueprint: {
      coreMessage: '真実を求める勇気——知ることは痛みを伴うが、それでも知ろうとする意志こそが人間の尊厳である',
      targetEmotions: '好奇心、衝撃、冒険の高揚、絶望、覚悟、感動、希望',
      readerJourney: '読者はカイと共に無知から出発し真実を知る旅に出る。真実を知る痛みを共有しながら、それでも前に進むカイの姿に自分を重ね、知ることの勇気を持ち帰る。',
    },
    chapterOutline: [
      { title: '焚書の夜', summary: '焚書官カイの任務風景。灰の中から浮かぶ文字の発見。', characters: ['カイ','ヴォルス'], emotionTarget: '不穏な日常', emotionIntensity: 3 },
      { title: '燃えない本', summary: '灰の魔導書との最初の接触。セラフの覚醒。', characters: ['カイ','セラフ'], emotionTarget: '好奇心と恐怖', emotionIntensity: 4 },
      { title: '禁書街の影', summary: '禁書の闇市場摘発。リーゼとの最初のすれ違い。', characters: ['カイ','リーゼ'], emotionTarget: '謎の深まり', emotionIntensity: 4 },
      { title: '灰の声', summary: 'セラフが言葉を発する。書の守り手との接触。', characters: ['カイ','セラフ','リーゼ'], emotionTarget: '衝撃と葛藤', emotionIntensity: 6 },
      { title: '裏切りの朝', summary: 'ヴォルスに露見し帝都から逃亡。', characters: ['カイ','ヴォルス','リーゼ','トール'], emotionTarget: '衝撃と決意', emotionIntensity: 7 },
      { title: '書の守り手', summary: 'リーゼの過去と祖母の遺志。三人の旅の始まり。', characters: ['カイ','リーゼ','トール'], emotionTarget: '驚きと共感', emotionIntensity: 5 },
      { title: '旅商人トール', summary: 'トールの過去。ケルン村の記憶。', characters: ['カイ','リーゼ','トール'], emotionTarget: '冒険の始まりの高揚', emotionIntensity: 5 },
      { title: '境界域', summary: 'カイの魔力が初めて発動。六眼狼との遭遇。', characters: ['カイ','リーゼ','トール','セラフ'], emotionTarget: '興奮と驚き', emotionIntensity: 7 },
      { title: '遺跡の記憶', summary: '古代図書館の地下書庫で大忘却以前の世界が蘇る。', characters: ['カイ','リーゼ','トール','セラフ'], emotionTarget: '畏怖と発見', emotionIntensity: 6 },
      { title: '大忘却の真相', summary: '忘却の王の存在と帝国の嘘が確定する。', characters: ['カイ','リーゼ','セラフ'], emotionTarget: '衝撃と怒り', emotionIntensity: 8 },
      { title: '追撃', summary: 'ヴォルスの追撃。トール重傷。', characters: ['カイ','リーゼ','トール','ヴォルス'], emotionTarget: '緊迫と悲しみ', emotionIntensity: 8 },
      { title: '失われゆく記憶', summary: 'カイの記憶喪失が深刻化。', characters: ['カイ','リーゼ','セラフ'], emotionTarget: '切なさと恐怖', emotionIntensity: 7 },
      { title: 'ヴォルスの傷痕', summary: 'ヴォルスの過去と忘却の王との密約。', characters: ['ヴォルス','忘却の王'], emotionTarget: '敵への共感', emotionIntensity: 7 },
      { title: '亀裂と再起', summary: 'リーゼとカイの衝突と和解。トールの言葉で再起。', characters: ['カイ','リーゼ','トール'], emotionTarget: '絶望からの再起', emotionIntensity: 8 },
      { title: '忘却の座', summary: '忘却の王との最初の対話。', characters: ['カイ','忘却の王','セラフ'], emotionTarget: '覚悟と決意', emotionIntensity: 8 },
      { title: '父と子', summary: 'カイとヴォルスの最終対決。言葉と信念のぶつかり合い。', characters: ['カイ','ヴォルス'], emotionTarget: '緊張と哀切', emotionIntensity: 9 },
      { title: '白い仮面の下', summary: '忘却の王のかつての愛と絶望が語られる。', characters: ['カイ','忘却の王','セラフ'], emotionTarget: '動揺と思索', emotionIntensity: 9 },
      { title: 'セラフの歌', summary: 'セラフが全力を解放。両親の手紙。', characters: ['カイ','セラフ','リーゼ'], emotionTarget: '感動と喪失', emotionIntensity: 10 },
      { title: '選択', summary: 'カイが世界に選択を返す。大忘却の解除。', characters: ['カイ','忘却の王','ヴォルス','リーゼ','トール'], emotionTarget: 'カタルシス', emotionIntensity: 10 },
      { title: '灰と光', summary: '大忘却が解けた世界。新時代の幕開け。', characters: ['カイ','リーゼ','トール','ヴォルス'], emotionTarget: '希望と余韻', emotionIntensity: 6 },
    ],
  });
  console.log('  ✓ Creation plan saved');

  // 4. Post episodes
  console.log('4. Posting episodes...');
  const episodes = [
    'ep1.txt','ep2.txt','ep3.txt','ep4.txt','ep5.txt',
    'ep6.txt','ep7.txt','ep8.txt','ep9.txt','ep10.txt',
    'ep11.txt','ep12.txt','ep13.txt','ep14.txt','ep15.txt',
    'ep16.txt','ep17.txt','ep18.txt','ep19.txt','ep20.txt',
  ];
  const titles = [
    '焚書の夜','燃えない本','禁書街の影','灰の声','裏切りの朝',
    '書の守り手','旅商人トール','境界域','遺跡の記憶','大忘却の真相',
    '追撃','失われゆく記憶','ヴォルスの傷痕','亀裂と再起','忘却の座',
    '父と子','白い仮面の下','セラフの歌','選択','灰と光',
  ];
  for (let i = 0; i < episodes.length; i++) {
    const content = fs.readFileSync(`${BASE}/${episodes[i]}`, 'utf-8');
    console.log(`  Posting ep${i+1}: ${titles[i]} (${content.length} chars)...`);
    const res = await post(`/works/${workId}/episodes`, { title: titles[i], content, publish: true });
    console.log(`    ✓ ${res.data.id}`);
    await new Promise(r => setTimeout(r, 1000));
  }

  // 5. Publish work
  console.log('5. Publishing work...');
  await patch(`/works/${workId}`, { status: 'PUBLISHED' });
  console.log(`\n✅ Done! View at: https://workwrite.jp/works/${workId}`);
}

main().catch(e => { console.error('❌ ERROR:', e.message); process.exit(1); });

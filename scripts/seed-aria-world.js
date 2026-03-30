/**
 * Seed Aria's Interactive Novel world data
 * Run via: railway run -- node scripts/seed-aria-world.js
 * Or locally with DATABASE_URL set
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const WORK_ID = 'cmmz0tp5o000bmp018pbblq0h';

async function main() {
  console.log('Seeding Aria world data...');

  // Check work exists
  const work = await prisma.work.findUnique({ where: { id: WORK_ID } });
  if (!work) {
    console.error('Work not found:', WORK_ID);
    process.exit(1);
  }
  console.log('Work found:', work.title);

  // Get characters
  const characters = await prisma.storyCharacter.findMany({ where: { workId: WORK_ID } });
  console.log('Characters:', characters.map(c => c.name).join(', '));

  const charByName = (fragment) => characters.find(c => c.name && c.name.includes(fragment));

  // Get episodes
  const episodes = await prisma.episode.findMany({
    where: { workId: WORK_ID },
    orderBy: { orderIndex: 'asc' },
    select: { id: true, orderIndex: true, title: true },
  });
  console.log('Episodes:', episodes.length);

  // ============================================================
  // WorldLocations
  // ============================================================
  console.log('\nCreating WorldLocations...');

  const locations = [
    {
      id: 'aria-loc-shiori-do',
      workId: WORK_ID,
      name: '栞堂',
      type: 'interior',
      description: '下北沢の駅から歩いて五分、路地を二本入ったところにある古書店。入口は狭い。看板は木彫りで、文字がかすれている。天井まで届く本棚が所狭しと並んでいて、奥にカフェスペースがある。テーブルが三つ。コーヒーと紅茶だけ出す。',
      generationStatus: 'complete',
    },
    {
      id: 'aria-loc-shimokitazawa',
      workId: WORK_ID,
      name: '下北沢の路地',
      type: 'exterior',
      description: '古着屋、レコード店、小劇場が並ぶ路地裏。夕焼けが建物の壁を染める。どこかの店からギターの音が聞こえる。',
      generationStatus: 'complete',
    },
    {
      id: 'aria-loc-apartment',
      workId: WORK_ID,
      name: '詩のアパート',
      type: 'interior',
      description: '駅から徒歩七分の木造二階建ての二階。六畳一間。ベッドとデスクと小さな本棚。デスクの上にはノートパソコン。コーヒーの匂いが漂っている。',
      generationStatus: 'complete',
    },
    {
      id: 'aria-loc-nameless-street',
      workId: WORK_ID,
      name: '名前のない街',
      type: 'abstract',
      description: '入口はあるけれど、出口は自分で見つけるもの。建物は古くて、路地は入り組んでいて、空はいつも夕焼けと朝焼けの間の色をしている。',
      generationStatus: 'complete',
    },
    {
      id: 'aria-loc-ao-bookstore',
      workId: WORK_ID,
      name: '蒼の古書店',
      type: 'interior',
      description: '名前のない街の小さな古書店。窓から夕焼けの光が差し込んでいる。棚には街の住人たちに必要な本が並んでいる。',
      generationStatus: 'complete',
    },
    {
      id: 'aria-loc-library',
      workId: WORK_ID,
      name: '先生の図書館',
      type: 'interior',
      description: '名前のない街で一番大きな建物。天井が高く、本棚が壁を覆い尽くしている。奥にはお茶を飲むための小さなテーブル。いつもお茶の香りがする。',
      generationStatus: 'complete',
    },
  ];

  for (const loc of locations) {
    await prisma.worldLocation.upsert({
      where: { id: loc.id },
      create: loc,
      update: { name: loc.name, description: loc.description, generationStatus: loc.generationStatus },
    });
    console.log(`  Created: ${loc.name}`);
  }

  // ============================================================
  // LocationConnections
  // ============================================================
  console.log('\nCreating LocationConnections...');

  const connections = [
    { from: 'aria-loc-shiori-do', to: 'aria-loc-shimokitazawa', desc: '外に出る', travel: '扉を開けて' },
    { from: 'aria-loc-shimokitazawa', to: 'aria-loc-shiori-do', desc: '栞堂に入る', travel: '路地を二本入る' },
    { from: 'aria-loc-shimokitazawa', to: 'aria-loc-apartment', desc: '詩のアパートへ', travel: '徒歩七分' },
    { from: 'aria-loc-apartment', to: 'aria-loc-shimokitazawa', desc: '外に出る', travel: '階段を降りて' },
    { from: 'aria-loc-nameless-street', to: 'aria-loc-ao-bookstore', desc: '蒼の古書店へ', travel: '路地を進む' },
    { from: 'aria-loc-nameless-street', to: 'aria-loc-library', desc: '先生の図書館へ', travel: '広場を渡る' },
    { from: 'aria-loc-ao-bookstore', to: 'aria-loc-nameless-street', desc: '街に出る', travel: '扉を開けて' },
    { from: 'aria-loc-ao-bookstore', to: 'aria-loc-library', desc: '図書館へ', travel: '通りを歩く' },
    { from: 'aria-loc-library', to: 'aria-loc-nameless-street', desc: '街に出る', travel: '階段を降りて' },
    { from: 'aria-loc-library', to: 'aria-loc-ao-bookstore', desc: '蒼の古書店へ', travel: '通りを歩く' },
    // Aria system bridges real world and fictional world
    { from: 'aria-loc-apartment', to: 'aria-loc-nameless-street', desc: 'Ariaを開く', travel: 'パソコンの画面の中に' },
    { from: 'aria-loc-nameless-street', to: 'aria-loc-apartment', desc: '現実に戻る', travel: 'パソコンを閉じて' },
  ];

  // Delete existing connections for this work
  await prisma.locationConnection.deleteMany({ where: { workId: WORK_ID } });

  for (const conn of connections) {
    await prisma.locationConnection.create({
      data: {
        workId: WORK_ID,
        fromLocationId: conn.from,
        toLocationId: conn.to,
        description: conn.desc,
        travelTime: conn.travel,
      },
    });
    console.log(`  ${conn.desc} (${conn.from.split('-').pop()} -> ${conn.to.split('-').pop()})`);
  }

  // ============================================================
  // LocationRenderings (sensory data)
  // ============================================================
  console.log('\nCreating LocationRenderings...');

  const renderings = [
    {
      locationId: 'aria-loc-shiori-do',
      timeOfDay: 'afternoon',
      sensoryText: {
        visual: '午後の光が磨りガラスを通って柔らかく広がっている。本棚の間に埃が舞う。',
        auditory: 'ページをめくる音。遠くの電車の音。時計が刻む音。',
        olfactory: '古い紙とインクと、ほんの少しの埃の匂い。奥からコーヒーの香り。',
        atmospheric: '静かで、時間がゆっくり流れている。',
      },
    },
    {
      locationId: 'aria-loc-shiori-do',
      timeOfDay: 'evening',
      sensoryText: {
        visual: '窓の外が暮れていく。店内の照明が暖色に灯る。',
        auditory: '閉店準備の音。椅子を引く音。',
        olfactory: '一日分の本の匂いが染みついている。',
        atmospheric: '一日の終わりの穏やかさ。',
      },
    },
    {
      locationId: 'aria-loc-shimokitazawa',
      timeOfDay: 'afternoon',
      sensoryText: {
        visual: '路地裏に光が差している。古着屋のハンガーラックが歩道にはみ出している。',
        auditory: '自転車のベル。どこかのカフェから流れる音楽。人の話し声。',
        olfactory: 'コーヒーと焼きたてのパンの匂い。',
        atmospheric: '活気があるが、どこか穏やか。',
      },
    },
    {
      locationId: 'aria-loc-shimokitazawa',
      timeOfDay: 'evening',
      sensoryText: {
        visual: '夕焼けが路地を橙色に染めている。古着屋のシャッターが降り始める。',
        auditory: 'どこかでギターの音。シャッターの金属音。',
        olfactory: '夕方の空気。少し湿っている。',
        atmospheric: '一日が終わっていく。街が呼吸を落とす。',
      },
    },
    {
      locationId: 'aria-loc-apartment',
      timeOfDay: 'night',
      sensoryText: {
        visual: '六畳一間。デスクの上のノートパソコンの画面が光っている。窓の外に下北沢の夜景。',
        auditory: 'キーボードを叩く音。ゴミ収集車の遠い唸り。',
        olfactory: 'コーヒーの匂い。二杯目は少し濃いめ。',
        atmospheric: '静かだ。世界が遠い。ここにはわたしとパソコンだけ。',
      },
    },
    {
      locationId: 'aria-loc-apartment',
      timeOfDay: 'morning',
      sensoryText: {
        visual: 'カーテンの隙間から光が差している。六畳一間の天井が見える。',
        auditory: 'ゴミ収集車の唸り、自転車のベル、鳩の羽音。',
        olfactory: '挽いたコーヒー豆の匂い。苦味と土と、かすかな甘さ。',
        atmospheric: '朝。世界が続いている。',
      },
    },
    {
      locationId: 'aria-loc-nameless-street',
      timeOfDay: 'evening',
      sensoryText: {
        visual: '空はいつも夕焼けと朝焼けの間の色をしている。路地は入り組んでいる。',
        auditory: '風が路地を抜ける音。遠くで誰かが歌っている。',
        olfactory: '古い石と、花の匂い。',
        atmospheric: '不思議と居心地がいい。時間が止まっているような。',
      },
    },
    {
      locationId: 'aria-loc-ao-bookstore',
      timeOfDay: 'evening',
      sensoryText: {
        visual: '窓から夕焼けの光が差し込んでいる。本棚に光の筋が走る。',
        auditory: 'ページをめくる音。静寂。',
        olfactory: '古い本の匂い。栞堂と少し似ている。',
        atmospheric: '穏やかで、静かで、安心する場所。',
      },
    },
    {
      locationId: 'aria-loc-library',
      timeOfDay: 'evening',
      sensoryText: {
        visual: '天井が高い。本棚が壁を覆い尽くしている。奥の小さなテーブルに湯呑みが見える。',
        auditory: '静寂。たまにお茶を啜る音。',
        olfactory: 'お茶の香り。古い紙の匂い。',
        atmospheric: '全てを知っている人がいる場所。',
      },
    },
  ];

  for (const r of renderings) {
    await prisma.locationRendering.upsert({
      where: { locationId_timeOfDay: { locationId: r.locationId, timeOfDay: r.timeOfDay } },
      create: r,
      update: { sensoryText: r.sensoryText },
    });
    console.log(`  ${r.locationId.split('-').pop()} (${r.timeOfDay})`);
  }

  // ============================================================
  // CharacterSchedules
  // ============================================================
  console.log('\nCreating CharacterSchedules...');

  const sakaki = charByName('榊');
  const uta = charByName('詩');
  const ao = charByName('蒼');
  const mina = charByName('ミナ');
  const sensei = charByName('先生');
  const rin = charByName('凛');
  const kousuke = charByName('梗介');

  // Delete existing schedules for this work
  await prisma.characterSchedule.deleteMany({ where: { workId: WORK_ID } });

  const schedules = [];

  if (sakaki) {
    // Sakaki is at Shiori-do from morning to evening, every episode
    for (let i = 0; i < episodes.length; i++) {
      const basePos = i / episodes.length;
      schedules.push({
        characterId: sakaki.id, workId: WORK_ID,
        timeStart: basePos, timeEnd: basePos + 0.8 / episodes.length,
        locationId: 'aria-loc-shiori-do',
        activity: '本を読んでいる',
        mood: '穏やか',
        episodeId: episodes[i].id,
      });
    }
  }

  if (uta) {
    for (let i = 0; i < episodes.length; i++) {
      const basePos = i / episodes.length;
      // Uta at Shiori-do during afternoon
      schedules.push({
        characterId: uta.id, workId: WORK_ID,
        timeStart: basePos + 0.2 / episodes.length, timeEnd: basePos + 0.6 / episodes.length,
        locationId: 'aria-loc-shiori-do',
        activity: 'バイト中。時々ノートに何か書いている',
        mood: i < 5 ? '穏やか' : i < 10 ? '書くことに夢中' : i < 15 ? '不安' : '決意',
        episodeId: episodes[i].id,
      });
      // Uta at apartment during night
      schedules.push({
        characterId: uta.id, workId: WORK_ID,
        timeStart: basePos + 0.7 / episodes.length, timeEnd: basePos + 1.0 / episodes.length,
        locationId: 'aria-loc-apartment',
        activity: i < 5 ? 'Ariaで蒼と会話している' : i < 15 ? '小説を書いている' : '最後の章を書いている',
        mood: i < 5 ? '新しい発見' : i < 10 ? '夢中' : i < 15 ? '揺れている' : '覚悟',
        episodeId: episodes[i].id,
      });
    }
  }

  if (ao) {
    // Ao is always in his bookstore in the nameless city
    for (let i = 0; i < episodes.length; i++) {
      const basePos = i / episodes.length;
      schedules.push({
        characterId: ao.id, workId: WORK_ID,
        timeStart: basePos, timeEnd: basePos + 1.0 / episodes.length,
        locationId: 'aria-loc-ao-bookstore',
        activity: '本を読んでいる。訪れる人を待っている',
        mood: i < 5 ? '穏やか' : i < 10 ? '詩のことを考えている' : i < 15 ? '何かを伝えたい' : '全てを受け入れている',
        episodeId: episodes[i].id,
      });
    }
  }

  if (mina) {
    for (let i = 0; i < episodes.length; i++) {
      const basePos = i / episodes.length;
      schedules.push({
        characterId: mina.id, workId: WORK_ID,
        timeStart: basePos, timeEnd: basePos + 1.0 / episodes.length,
        locationId: 'aria-loc-nameless-street',
        activity: '街を走り回っている',
        mood: i < 10 ? '元気' : i < 15 ? '不安だけど前を向いている' : '泣き虫だけど強い',
        episodeId: episodes[i].id,
      });
    }
  }

  if (sensei) {
    for (let i = 0; i < episodes.length; i++) {
      const basePos = i / episodes.length;
      schedules.push({
        characterId: sensei.id, workId: WORK_ID,
        timeStart: basePos, timeEnd: basePos + 1.0 / episodes.length,
        locationId: 'aria-loc-library',
        activity: 'お茶を飲みながら本を読んでいる',
        mood: '飄々としている。全てを知っている',
        episodeId: episodes[i].id,
      });
    }
  }

  for (const s of schedules) {
    await prisma.characterSchedule.create({ data: s });
  }
  console.log(`  Created ${schedules.length} schedule entries`);

  // ============================================================
  // Enable Interactive Novel on the work
  // ============================================================
  await prisma.work.update({
    where: { id: WORK_ID },
    data: { enableInteractiveNovel: true, interactiveNovelStatus: 'ready' },
  });
  console.log('\nEnabled Interactive Novel on Aria');

  // Final status
  const status = {
    locations: await prisma.worldLocation.count({ where: { workId: WORK_ID } }),
    connections: await prisma.locationConnection.count({ where: { workId: WORK_ID } }),
    renderings: await prisma.locationRendering.count({ where: { workId: WORK_ID } }),
    schedules: await prisma.characterSchedule.count({ where: { workId: WORK_ID } }),
  };
  console.log('\nFinal status:', status);
  console.log('Done!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

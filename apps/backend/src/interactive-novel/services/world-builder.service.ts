import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class WorldBuilderService {
  private readonly logger = new Logger(WorldBuilderService.name);

  constructor(private prisma: PrismaService) {}

  async buildWorld(workId: string): Promise<{ locations: number; events: number; schedules: number }> {
    this.logger.log(`Building world for work ${workId}`);
    // TODO: Generic pipeline from EpisodeAnalysis
    return this.getWorldStatus(workId);
  }

  async getWorldStatus(workId: string) {
    const [locations, events, schedules] = await Promise.all([
      this.prisma.worldLocation.count({ where: { workId } }),
      this.prisma.storyEvent.count({ where: { workId } }),
      this.prisma.characterSchedule.count({ where: { workId } }),
    ]);
    return { locations, events, schedules };
  }

  /**
   * Seed Aria's world data. Temporary method for bootstrapping.
   */
  async seedAriaWorld(workId: string): Promise<{ locations: number; connections: number; renderings: number; schedules: number }> {
    this.logger.log('Seeding Aria world data...');

    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new Error('Work not found');

    const characters = await this.prisma.storyCharacter.findMany({ where: { workId } });
    const episodes = await this.prisma.episode.findMany({
      where: { workId },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, orderIndex: true },
    });

    const charByName = (fragment: string) => characters.find(c => c.name?.includes(fragment));

    // Locations
    const locations = [
      { id: 'aria-loc-shiori-do', workId, name: '栞堂', type: 'interior', description: '下北沢の駅から歩いて五分、路地を二本入ったところにある古書店。入口は狭い。看板は木彫りで、文字がかすれている。天井まで届く本棚が所狭しと並んでいて、奥にカフェスペースがある。テーブルが三つ。コーヒーと紅茶だけ出す。', generationStatus: 'complete' },
      { id: 'aria-loc-shimokitazawa', workId, name: '下北沢の路地', type: 'exterior', description: '古着屋、レコード店、小劇場が並ぶ路地裏。夕焼けが建物の壁を染める。どこかの店からギターの音が聞こえる。', generationStatus: 'complete' },
      { id: 'aria-loc-apartment', workId, name: '詩のアパート', type: 'interior', description: '駅から徒歩七分の木造二階建ての二階。六畳一間。ベッドとデスクと小さな本棚。デスクの上にはノートパソコン。コーヒーの匂いが漂っている。', generationStatus: 'complete' },
      { id: 'aria-loc-nameless-street', workId, name: '名前のない街', type: 'abstract', description: '入口はあるけれど、出口は自分で見つけるもの。建物は古くて、路地は入り組んでいて、空はいつも夕焼けと朝焼けの間の色をしている。', generationStatus: 'complete' },
      { id: 'aria-loc-ao-bookstore', workId, name: '蒼の古書店', type: 'interior', description: '名前のない街の小さな古書店。窓から夕焼けの光が差し込んでいる。棚には街の住人たちに必要な本が並んでいる。', generationStatus: 'complete' },
      { id: 'aria-loc-library', workId, name: '先生の図書館', type: 'interior', description: '名前のない街で一番大きな建物。天井が高く、本棚が壁を覆い尽くしている。奥にはお茶を飲むための小さなテーブル。いつもお茶の香りがする。', generationStatus: 'complete' },
    ];

    for (const loc of locations) {
      await this.prisma.worldLocation.upsert({
        where: { id: loc.id },
        create: loc,
        update: { name: loc.name, description: loc.description, generationStatus: loc.generationStatus },
      });
    }

    // Connections
    await this.prisma.locationConnection.deleteMany({ where: { workId } });
    const connections = [
      { from: 'aria-loc-shiori-do', to: 'aria-loc-shimokitazawa', desc: '外に出る' },
      { from: 'aria-loc-shimokitazawa', to: 'aria-loc-shiori-do', desc: '栞堂に入る' },
      { from: 'aria-loc-shimokitazawa', to: 'aria-loc-apartment', desc: '詩のアパートへ' },
      { from: 'aria-loc-apartment', to: 'aria-loc-shimokitazawa', desc: '外に出る' },
      { from: 'aria-loc-nameless-street', to: 'aria-loc-ao-bookstore', desc: '蒼の古書店へ' },
      { from: 'aria-loc-nameless-street', to: 'aria-loc-library', desc: '先生の図書館へ' },
      { from: 'aria-loc-ao-bookstore', to: 'aria-loc-nameless-street', desc: '街に出る' },
      { from: 'aria-loc-ao-bookstore', to: 'aria-loc-library', desc: '図書館へ' },
      { from: 'aria-loc-library', to: 'aria-loc-nameless-street', desc: '街に出る' },
      { from: 'aria-loc-library', to: 'aria-loc-ao-bookstore', desc: '蒼の古書店へ' },
      { from: 'aria-loc-apartment', to: 'aria-loc-nameless-street', desc: 'Ariaを開く' },
      { from: 'aria-loc-nameless-street', to: 'aria-loc-apartment', desc: '現実に戻る' },
    ];
    for (const c of connections) {
      await this.prisma.locationConnection.create({
        data: { workId, fromLocationId: c.from, toLocationId: c.to, description: c.desc },
      });
    }

    // Renderings
    const renderings = [
      { locationId: 'aria-loc-shiori-do', timeOfDay: 'afternoon', sensoryText: { visual: '午後の光が磨りガラスを通って柔らかく広がっている。本棚の間に埃が舞う。', auditory: 'ページをめくる音。遠くの電車の音。時計が刻む音。', olfactory: '古い紙とインクと、ほんの少しの埃の匂い。奥からコーヒーの香り。', atmospheric: '静かで、時間がゆっくり流れている。' } },
      { locationId: 'aria-loc-shiori-do', timeOfDay: 'evening', sensoryText: { visual: '窓の外が暮れていく。店内の照明が暖色に灯る。', auditory: '閉店準備の音。', olfactory: '一日分の本の匂いが染みついている。', atmospheric: '一日の終わりの穏やかさ。' } },
      { locationId: 'aria-loc-shimokitazawa', timeOfDay: 'afternoon', sensoryText: { visual: '路地裏に光が差している。古着屋のハンガーラックが歩道にはみ出している。', auditory: '自転車のベル。どこかのカフェから流れる音楽。', olfactory: 'コーヒーと焼きたてのパンの匂い。', atmospheric: '活気があるが、どこか穏やか。' } },
      { locationId: 'aria-loc-shimokitazawa', timeOfDay: 'evening', sensoryText: { visual: '夕焼けが路地を橙色に染めている。古着屋のシャッターが降り始める。', auditory: 'どこかでギターの音。シャッターの金属音。', olfactory: '夕方の空気。少し湿っている。', atmospheric: '一日が終わっていく。' } },
      { locationId: 'aria-loc-apartment', timeOfDay: 'night', sensoryText: { visual: '六畳一間。デスクの上のノートパソコンの画面が光っている。', auditory: 'キーボードを叩く音。', olfactory: 'コーヒーの匂い。二杯目は少し濃いめ。', atmospheric: '静かだ。世界が遠い。' } },
      { locationId: 'aria-loc-apartment', timeOfDay: 'morning', sensoryText: { visual: 'カーテンの隙間から光が差している。六畳一間の天井が見える。', auditory: 'ゴミ収集車の唸り、自転車のベル、鳩の羽音。', olfactory: '挽いたコーヒー豆の匂い。苦味と土と、かすかな甘さ。', atmospheric: '朝。世界が続いている。' } },
      { locationId: 'aria-loc-nameless-street', timeOfDay: 'evening', sensoryText: { visual: '空はいつも夕焼けと朝焼けの間の色をしている。路地は入り組んでいる。', auditory: '風が路地を抜ける音。遠くで誰かが歌っている。', olfactory: '古い石と、花の匂い。', atmospheric: '不思議と居心地がいい。時間が止まっているような。' } },
      { locationId: 'aria-loc-ao-bookstore', timeOfDay: 'evening', sensoryText: { visual: '窓から夕焼けの光が差し込んでいる。本棚に光の筋が走る。', auditory: 'ページをめくる音。静寂。', olfactory: '古い本の匂い。栞堂と少し似ている。', atmospheric: '穏やかで、静かで、安心する場所。' } },
      { locationId: 'aria-loc-library', timeOfDay: 'evening', sensoryText: { visual: '天井が高い。本棚が壁を覆い尽くしている。奥の小さなテーブルに湯呑みが見える。', auditory: '静寂。たまにお茶を啜る音。', olfactory: 'お茶の香り。古い紙の匂い。', atmospheric: '全てを知っている人がいる場所。' } },
    ];
    for (const r of renderings) {
      await this.prisma.locationRendering.upsert({
        where: { locationId_timeOfDay: { locationId: r.locationId, timeOfDay: r.timeOfDay } },
        create: r,
        update: { sensoryText: r.sensoryText },
      });
    }

    // Character Schedules
    await this.prisma.characterSchedule.deleteMany({ where: { workId } });
    const scheduleData: any[] = [];
    const sakaki = charByName('榊');
    const uta = charByName('詩');
    const ao = charByName('蒼');
    const mina = charByName('ミナ');
    const sensei = charByName('先生');

    for (let i = 0; i < episodes.length; i++) {
      const base = i / episodes.length;
      const span = 1 / episodes.length;

      if (sakaki) {
        scheduleData.push({ characterId: sakaki.id, workId, timeStart: base, timeEnd: base + span * 0.8, locationId: 'aria-loc-shiori-do', activity: '本を読んでいる', mood: '穏やか', episodeId: episodes[i].id });
      }
      if (uta) {
        scheduleData.push({ characterId: uta.id, workId, timeStart: base + span * 0.2, timeEnd: base + span * 0.6, locationId: 'aria-loc-shiori-do', activity: 'バイト中', mood: i < 5 ? '穏やか' : i < 10 ? '夢中' : i < 15 ? '不安' : '決意', episodeId: episodes[i].id });
        scheduleData.push({ characterId: uta.id, workId, timeStart: base + span * 0.7, timeEnd: base + span, locationId: 'aria-loc-apartment', activity: '執筆中', mood: i < 5 ? '新しい発見' : i < 15 ? '夢中' : '覚悟', episodeId: episodes[i].id });
      }
      if (ao) {
        scheduleData.push({ characterId: ao.id, workId, timeStart: base, timeEnd: base + span, locationId: 'aria-loc-ao-bookstore', activity: '本を読んでいる', mood: i < 5 ? '穏やか' : i < 10 ? '詩のことを考えている' : '全てを受け入れている', episodeId: episodes[i].id });
      }
      if (mina) {
        scheduleData.push({ characterId: mina.id, workId, timeStart: base, timeEnd: base + span, locationId: 'aria-loc-nameless-street', activity: '街を走り回っている', mood: i < 10 ? '元気' : '泣き虫だけど強い', episodeId: episodes[i].id });
      }
      if (sensei) {
        scheduleData.push({ characterId: sensei.id, workId, timeStart: base, timeEnd: base + span, locationId: 'aria-loc-library', activity: 'お茶を飲んでいる', mood: '飄々としている', episodeId: episodes[i].id });
      }
    }

    await this.prisma.characterSchedule.createMany({ data: scheduleData });

    // Enable Interactive Novel
    await this.prisma.work.update({
      where: { id: workId },
      data: { enableInteractiveNovel: true, interactiveNovelStatus: 'ready' },
    });

    return {
      locations: locations.length,
      connections: connections.length,
      renderings: renderings.length,
      schedules: scheduleData.length,
    };
  }
}

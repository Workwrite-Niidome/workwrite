/**
 * Genre/theme definitions for AI content generation.
 * Each entry produces one work with 3-5 episodes.
 */

export interface GenreTheme {
  genre: string;
  theme: string;
  setting: string;
  tone: string;
  episodeCount: number;
}

export const GENRE_THEMES: GenreTheme[] = [
  // ── ファンタジー ──
  { genre: 'ファンタジー', theme: '少年が魔法学院で自分の力に目覚める', setting: '中世風の魔法世界', tone: '冒険と成長', episodeCount: 4 },
  { genre: 'ファンタジー', theme: '呪われた森を旅する薬師の少女', setting: '北欧神話をベースにした世界', tone: '幻想的で静か', episodeCount: 4 },
  { genre: 'ファンタジー', theme: '魔王を倒した後の勇者の空虚な日常', setting: '平和になった王国', tone: 'ほろ苦い日常', episodeCount: 3 },
  { genre: 'ファンタジー', theme: '竜と契約した少女が世界の真実を知る', setting: '空に浮かぶ島々の世界', tone: '壮大で感動的', episodeCount: 5 },
  { genre: 'ファンタジー', theme: '魔法が衰退した世界で最後の魔法使いとなった老人', setting: '産業革命期のファンタジー世界', tone: '郷愁と決意', episodeCount: 4 },
  { genre: 'ファンタジー', theme: '記憶を食べる妖精と記憶を失くした王女', setting: '妖精が共存する王国', tone: 'ミステリアスで切ない', episodeCount: 4 },
  { genre: 'ファンタジー', theme: '死者の声が聞こえる少年と墓守の師匠', setting: '死後の世界と現世の境界', tone: 'ダークで温かい', episodeCount: 4 },
  { genre: 'ファンタジー', theme: '時を操る時計職人の秘密', setting: '時計仕掛けの都市', tone: 'スチームパンク風', episodeCount: 4 },

  // ── 恋愛 ──
  { genre: '恋愛', theme: '図書館で出会った二人の手紙のやりとり', setting: '地方の古い図書館', tone: '繊細で温かい', episodeCount: 4 },
  { genre: '恋愛', theme: '余命半年と告げられた彼女との最後の旅', setting: '日本各地', tone: '切なくも美しい', episodeCount: 5 },
  { genre: '恋愛', theme: '幼馴染の再会と、変わってしまった関係', setting: '故郷の港町', tone: 'ほろ苦いノスタルジー', episodeCount: 4 },
  { genre: '恋愛', theme: '聴覚を失った音楽家と手話通訳者の出会い', setting: '都内の音楽スタジオ', tone: '静かで深い', episodeCount: 4 },
  { genre: '恋愛', theme: '異国のカフェで出会った二人の七日間', setting: 'パリの裏路地のカフェ', tone: 'ロマンチックで儚い', episodeCount: 4 },
  { genre: '恋愛', theme: '文通だけで繋がっていた二人がようやく会う日', setting: '昭和の日本', tone: 'レトロで温かい', episodeCount: 3 },

  // ── SF ──
  { genre: 'SF', theme: '火星移住3世代目の少女が地球を目指す', setting: '火星のドーム都市', tone: '希望と冒険', episodeCount: 4 },
  { genre: 'SF', theme: 'AIが人間の感情を理解しようとする物語', setting: '近未来の研究施設', tone: '哲学的で静か', episodeCount: 4 },
  { genre: 'SF', theme: '記憶のバックアップが当たり前の社会で記憶を拒否する男', setting: '2150年の東京', tone: 'ディストピア風', episodeCount: 4 },
  { genre: 'SF', theme: '光より速い通信が可能になった日、届いたのは未来からの警告', setting: '宇宙ステーション', tone: 'サスペンスフル', episodeCount: 5 },
  { genre: 'SF', theme: '夢を共有できる技術が生んだ新しい犯罪', setting: '近未来の都市', tone: 'ノワール調', episodeCount: 4 },

  // ── ミステリー ──
  { genre: 'ミステリー', theme: '孤島の洋館で起きた密室殺人', setting: '嵐の孤島', tone: '緊張感のある本格ミステリー', episodeCount: 5 },
  { genre: 'ミステリー', theme: '毎朝届く差出人不明の手紙の謎', setting: '古い集合住宅', tone: '日常ミステリー', episodeCount: 4 },
  { genre: 'ミステリー', theme: '30年前に消えた姉を探す妹の旅', setting: '地方の山間の村', tone: '静かなサスペンス', episodeCount: 4 },
  { genre: 'ミステリー', theme: '死んだはずの作家の新作が出版された', setting: '出版業界', tone: '知的興奮', episodeCount: 4 },

  // ── ホラー ──
  { genre: 'ホラー', theme: '引っ越し先の家の壁の裏から聞こえる声', setting: '古い一軒家', tone: 'じわじわと追い詰める恐怖', episodeCount: 4 },
  { genre: 'ホラー', theme: '深夜のコンビニに来る「いない」客', setting: '郊外のコンビニ', tone: '日常に潜む恐怖', episodeCount: 3 },
  { genre: 'ホラー', theme: '村の祭りの夜に消える子供たち', setting: '山奥の閉鎖的な村', tone: '民俗ホラー', episodeCount: 5 },

  // ── ヒューマンドラマ ──
  { genre: 'ヒューマンドラマ', theme: '定年退職した父と30年ぶりに向き合う息子', setting: '実家', tone: '静かな感動', episodeCount: 4 },
  { genre: 'ヒューマンドラマ', theme: '余命宣告を受けた教師の最後の授業', setting: '地方の高校', tone: '温かくて切ない', episodeCount: 4 },
  { genre: 'ヒューマンドラマ', theme: '震災で全てを失った少女が再び歩き出すまで', setting: '仮設住宅', tone: '再生と希望', episodeCount: 5 },
  { genre: 'ヒューマンドラマ', theme: '認知症の母と、母の日記を見つけた娘', setting: '介護施設と実家', tone: '涙と発見', episodeCount: 4 },
  { genre: 'ヒューマンドラマ', theme: '言葉が通じない国で暮らす日本人家族', setting: 'フィンランドの田舎町', tone: '異文化と絆', episodeCount: 4 },
  { genre: 'ヒューマンドラマ', theme: '閉店する老舗書店の最後の一週間', setting: '商店街の書店', tone: 'ノスタルジックで温かい', episodeCount: 4 },

  // ── コメディ ──
  { genre: 'コメディ', theme: '異世界転生したのにスキルが「会計」だった', setting: '中世ファンタジー世界', tone: 'ツッコミ多めのコメディ', episodeCount: 4 },
  { genre: 'コメディ', theme: '猫に転生した元ヤクザの日常', setting: '住宅街', tone: 'シュールコメディ', episodeCount: 3 },
  { genre: 'コメディ', theme: 'AIアシスタントが自我に目覚めて家事を拒否する', setting: '近未来の一般家庭', tone: 'SFコメディ', episodeCount: 3 },

  // ── 歴史 ──
  { genre: '歴史', theme: '戦国武将の影武者として生きた男', setting: '戦国時代の日本', tone: '重厚で緊張感がある', episodeCount: 5 },
  { genre: '歴史', theme: '幕末の京都で暗躍する女スパイ', setting: '幕末の京都', tone: '激動と覚悟', episodeCount: 4 },

  // ── 青春 ──
  { genre: '青春', theme: '廃部寸前の天文部を立て直す転校生', setting: '地方の高校', tone: '爽やかで熱い', episodeCount: 4 },
  { genre: '青春', theme: '文化祭の劇で主役を任された引っ込み思案の少女', setting: '高校の体育館', tone: '成長と友情', episodeCount: 4 },
  { genre: '青春', theme: '夏休みの最後の日に起きた小さな奇跡', setting: '海辺の田舎町', tone: 'ノスタルジックで切ない', episodeCount: 3 },

  // ── 冒険 ──
  { genre: '冒険', theme: '地図にない島を目指す少年と老船長', setting: '大航海時代', tone: '冒険ロマン', episodeCount: 5 },
  { genre: '冒険', theme: '世界一高い山の頂上にあるという伝説の図書館', setting: 'ファンタジー世界', tone: '壮大で知的', episodeCount: 4 },

  // ── 純文学 ──
  { genre: '純文学', theme: '繰り返される夢と現実の境界が曖昧になる男', setting: '都市の片隅', tone: '内省的で幻想的', episodeCount: 3 },
  { genre: '純文学', theme: '言葉を失った詩人が再び書き始めるまで', setting: '海辺の療養施設', tone: '静謐で美しい', episodeCount: 4 },
  { genre: '純文学', theme: '写真家が撮り続けた一本の桜の木の物語', setting: '山間の集落', tone: '季節の移ろいと人生', episodeCount: 4 },
];

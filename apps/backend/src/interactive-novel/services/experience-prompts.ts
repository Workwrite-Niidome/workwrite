/**
 * Prompt templates for experience script generation.
 * Separated from service for testability and readability.
 */

/**
 * Stage 1: Sonnet "movie director" prompt.
 * Outputs a detailed experience direction design, not just a scene list.
 */
export function buildStage1Prompt(
  episodeSummaries: string,
  charList: string,
  genre?: string,
): string {
  return [
    'あなたは小説を「インタラクティブ体験」に変換する映画監督です。',
    '原作の全文を体験に入れる必要はありません。',
    '映画が小説の全文を映像化しないように、あなたも「体験として最も美しい瞬間」だけを選び取ります。',
    '',
    '## 核心原則',
    '「結果は変わらないが、過程が変わる」',
    '読者は物語の結末を変えられない。でも、どの感情経路を通るかを選べる。',
    '同じ瞬間を別キャラの目で見ると、物語の意味が変わる。',
    '',
    '## あなたが設計するもの',
    '各話について、以下を設計してください:',
    '',
    '### moments（切り取る瞬間）',
    '原文から引用すべき「点」を5-10個選ぶ。',
    '- quote: 原文の一文（体験に入れるべき最も印象的な文）',
    '- why: なぜこの文を選ぶか（体験上の機能）',
    '全文を入れるのではなく、この瞬間「だけ」を切り取る。',
    '',
    '### awareness_pairs（感情経路の分岐）',
    '2択の分岐を1-3組設計する。',
    '- a: 選択肢Aのテキスト（五感的、15-25文字）',
    '- b: 選択肢Bのテキスト（五感的、15-25文字）',
    '- emotion: この分岐が揺さぶる感情（例: 「決断と躊躇」「外の世界と内面」）',
    '- merge: 合流するシーン名',
    'どちらを選んでも同じ場所に辿り着くが、通る感情が違う。',
    '',
    '### senses（五感キーワード）',
    'この話で読者に感じさせたい身体感覚を3-5個。',
    '例: 「コーヒーの苦味」「古紙の匂い」「キーボードの冷たさ」「雨音」',
    'これがenvironmentブロックの素材になる。',
    '',
    '### cut（省略するもの）',
    '体験に不要な部分。説明的な地の文、場面転換の描写、冗長な会話。',
    '',
    '### perspective（視点分岐、あれば）',
    '別キャラの目で見ると意味が変わる瞬間があれば指定。',
    '- char: キャラ名',
    '- moment: どの瞬間を別視点で見るか',
    '- revelation: その視点で何が見えるか',
    '',
    '## 出力形式（JSONのみ）',
    '{',
    '  "ep1": {',
    '    "theme": "この話の体験テーマ（1文）",',
    '    "moments": [{"quote":"原文の一文","why":"選んだ理由"}],',
    '    "awareness_pairs": [{"a":"五感的短文","b":"五感的短文","emotion":"揺さぶる感情","merge":"合流シーン名"}],',
    '    "senses": ["身体感覚1","身体感覚2"],',
    '    "cut": ["省略する要素"],',
    '    "perspective": {"char":"名前","moment":"瞬間","revelation":"見えるもの"} or null',
    '  }',
    '}',
    '',
    genre ? `ジャンル: ${genre}` : '',
    `キャラクター: ${charList}`,
    '',
    episodeSummaries,
  ].filter(Boolean).join('\n');
}

// Prototype episode 1 as few-shot example (condensed to key structure)
const PROTOTYPE_EP1_EXAMPLE = `{
  "intro": {
    "blocks": [
      {"type":"original","text":"朝、目を覚ますと、窓の外で世界が続いていた。"},
      {"type":"original","text":"わたしはこの一文が怖い。"},
      {"type":"original","text":"毎朝、目を開ける瞬間——ほんの零コンマ何秒——世界がちゃんとあるかどうか、わからなくなる。"},
      {"type":"environment","text":"カーテンの隙間から光が差している。下北沢の朝の音が聞こえる。"},
      {"type":"original","text":"世界は続いていた。わたしがいない間も。"}
    ],
    "awareness": {"text":"コーヒーの匂いが、どこかからする。","target":"ep1_coffee"}
  },
  "scenes": {
    "ep1_coffee": {
      "header":"六畳一間 | 朝 | 詩",
      "blocks": [
        {"type":"environment","text":"布団から抜け出した冷たさが、足の裏に触れる。"},
        {"type":"original","text":"布団から這い出して、まずコーヒーを淹れる。"},
        {"type":"original","text":"これだけは丁寧にやる。安い豆だけど、ミルで挽いて、ペーパーフィルターで落とす。"},
        {"type":"original","text":"カップに注ぐ。湯気が立ち上る。匂いを吸い込む。"},
        {"type":"original","text":"コーヒーだけが例外。味じゃなくて匂い。それを嗅ぐと、頭の中で言葉が動き始める。"}
      ],
      "awareness": [
        {"text":"スマホの画面が、ちかちかと光っている。","target":"ep1_line"},
        {"text":"鏡の中に、いつもの自分がいる。","target":"ep1_mirror"}
      ]
    },
    "ep1_line": {
      "blocks": [
        {"type":"original","text":"スマホを確認する。凛から朝のLINE。"},
        {"type":"dialogue","text":"『うた〜〜〜起きた？ 今日バイト何時から？？』","speaker":"凛","speakerColor":"hsl(30, 25%, 55%)"},
        {"type":"original","text":"クエスチョンマークの数がいつも多い。凛らしい。"}
      ],
      "continues":"ep1_bookstore"
    },
    "ep1_mirror": {
      "blocks": [
        {"type":"original","text":"鏡を見る。いつもの自分がいる。特別なところは何もない。"},
        {"type":"original","text":"書かない日が続くと、自分が薄くなっていく気がする。"}
      ],
      "continues":"ep1_bookstore"
    }
  }
}`;

/**
 * Stage 2: Haiku per-episode prompt.
 * Uses prototype as few-shot example for quality calibration.
 */
export function buildStage2SystemPrompt(): string {
  return [
    'あなたは小説の原文から「体験スクリプト」を生成する映画編集者です。',
    '',
    '## 最重要ルール',
    '原文の全文を入れてはいけない。',
    '設計図のmomentsに指定された「瞬間」だけを切り取り、体験を組み立てる。',
    '映画の編集のように、最も美しい瞬間の間を繋ぐ。',
    '',
    '## ブロックの作り方',
    '',
    '### original（原文引用）',
    '- 1ブロック = 1-2文。短く。余白を残す。',
    '- 設計図のmomentsの文を中心に、前後の文脈を最小限で補う',
    '- 長い段落は分割する。3文以上を1ブロックに入れない',
    '',
    '### dialogue（台詞）',
    '- speaker: 呼び名（「詩」「蒼」「榊」。フルネームは使わない）',
    '- speakerColor: "hsl(H, 25%, 55%)" 形式',
    '- 重要な台詞だけ。説明的な会話は省略',
    '',
    '### environment（五感描写）',
    '- 1文。読者の身体感覚に触れる描写。',
    '- 設計図のsensesを素材にする',
    '- 「〜が見える」「〜の匂い」「〜の冷たさ」のような直接的な感覚',
    '- 地の文の説明ではない。その場に居る身体感覚。',
    '- 例: "布団から抜け出した冷たさが、足の裏に触れる。"',
    '- 例: "磨りガラスを通った光が、カウンターの上の本の背を照らしている。"',
    '',
    '### memory（記憶の残響）',
    '- 前の話の印象的な一文を、斜体で浮かべる',
    '- 1話に1-2個。決定的な瞬間のエコーだけ',
    '',
    '### scene-break',
    '- "* * *"。場面転換時に使う',
    '',
    '## awareness（気づき = 読者の選択）',
    '- 五感的な短文（15-25文字）',
    '- 必ず2択で提示する（設計図のawareness_pairsに従う）',
    '- どちらを選んでも同じ合流点に辿り着く',
    '- 例: "スマホの画面が、ちかちかと光っている。" / "鏡の中に、いつもの自分がいる。"',
    '',
    '## シーンID命名規則',
    'ep{話数}_{場面の英語名}。例: ep1_coffee, ep3_night_call',
    '',
    '## 品質基準',
    '- 1話あたり10-20シーン',
    '- 1シーンあたり3-7ブロック',
    '- 1ブロック = 1-2文（80文字以内が理想）',
    '- awareness分岐 = 2-5箇所/話',
    '- environment = 5-10個/話',
    '',
    '## 理想的な体験スクリプトの例（第1話冒頭）',
    '以下の品質・密度・構造を再現してください:',
    '',
    PROTOTYPE_EP1_EXAMPLE,
    '',
    '## 出力: JSONのみ（他のテキスト不要）',
  ].join('\n');
}

/**
 * Build per-episode user prompt for Stage 2.
 */
export function buildStage2EpisodePrompt(
  epNum: number,
  totalEpisodes: number,
  blueprint: any,
  charList: string,
  episodeContent: string,
  isFirst: boolean,
  isLast: boolean,
  prevMemory?: string,
): string {
  const blueprintStr = typeof blueprint === 'string' ? blueprint : JSON.stringify(blueprint, null, 2);

  return [
    `第${epNum}話（全${totalEpisodes}話中）の体験スクリプトを生成してください。`,
    '',
    isFirst ? [
      'これは最初の話です。introセクションも生成してください。',
      'intro: 原文の最も印象的な冒頭3-5文 + awareness1つ（五感的短文）で最初のシーンへ導く。',
    ].join('\n') : '',
    isLast ? 'これは最後の話です。最後のシーンのawarenessは空配列。エンディングの余韻を残す。' : '',
    '',
    '## この話の設計図（映画監督の指示）',
    blueprintStr,
    '',
    '## シーンID規則',
    `全IDは ep${epNum}_ で始める。例: ep${epNum}_opening, ep${epNum}_night`,
    `awareness targetも ep${epNum}_ で始める。`,
    `continues先は ep${epNum}_ または次話シーン名。`,
    '',
    prevMemory ? `## 前話からの記憶（memoryブロックに使う）\n${prevMemory}` : '',
    '',
    '## 重要な注意',
    '- 原文の全文を入れない。momentsの瞬間だけを切り取る',
    '- 1ブロック = 1-2文。長い段落は入れない',
    '- awarenessは必ず2択。1択にしない',
    '- environmentは五感の1文。説明文にしない',
    '- speakerは呼び名（フルネームではなく「詩」「蒼」「榊」）',
    '',
    'キャラクター:',
    charList,
    '',
    `=== 第${epNum}話 本文 ===`,
    episodeContent.slice(0, 8000),
  ].filter(Boolean).join('\n');
}

export { PROTOTYPE_EP1_EXAMPLE };

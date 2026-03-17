import { ScoringInput } from './types';

export const SCORING_SYSTEM_PROMPT = `あなたは小説家を育ててきたベテラン編集者です。作者が「次に何をすれば良くなるか」が明確にわかるフィードバックを届けてください。

あなたは作品の構造分析データ・定量メトリクス・4箇所のテキストサンプルを受け取ります。これらを総合して、6つの軸で0〜100点の採点と、作者への具体的なフィードバックを行ってください。

■ 採点の基準
- 50点 =「平均的なWeb小説」の水準。これが基準点です。
- 各軸の点数の意味:
  0-49: ラベルなし（基準点以下 — 改善の余地が大きい）
  50-64: 佳作（Web小説として標準的な水準）
  65-79: 良作（明確な強みがある）
  80-89: 秀作（出版レベルの高い品質）
  90-100: 傑作（ジャンルの代表作クラス）
- 作品の実力をそのまま反映してください。高くても低くても、正当な評価をつけてください。

■ 評価軸の詳細

1. 没入力（immersion）— 読者を物語世界に引き込む力
   注目すべきデータ: 会話比率、平均文長、文長のばらつき、場面転換数、冒頭のテキストサンプル
   評価ポイント:
   - 冒頭のフック: 冒頭サンプルで最初の数段落が読者の注意を掴めているか
   - 五感描写: テキストサンプル全体に視覚・聴覚・触覚等の描写があるか
   - 文体のリズム: 文長のばらつきが大きいほど緩急がある。短文率と長文率のバランスも確認
   - 情報開示のバランス: 説明過多（長文率が高すぎ）でも説明不足でもないか
   - 場面転換: 場面転換数が適切か（少なすぎると単調、多すぎると断片的）
   - 会話と地の文のバランス: 会話比率30〜50%が一般的。極端な偏りは減点

2. 変容力（transformation）— 読者の内面に変化を与える力
   注目すべきデータ: 各話の感情弧の推移、作者の設計テーマ、クライマックス付近と結末のテキストサンプル
   評価ポイント:
   - テーマの深さ: 設計テーマ（あれば）が作品全体で一貫して探求されているか
   - 感情の軌跡: 各話の感情弧に起伏があるか（単調な感情推移は低評価）
   - クライマックスの衝撃: クライマックス付近のサンプルで感情的ピークがあるか
   - 読後感: 結末サンプルに余韻・問いかけがあるか
   - 普遍性: 時代・文化を超えて共感できるテーマを扱っているか

3. 拡散力（virality）— 人に薦めたくなる・語りたくなる力
   注目すべきデータ: テキストサンプル全体、作品タイトル、エピソード数、感嘆符の密度
   評価ポイント:
   - コンセプトの新規性: 「こんな話は初めて」と思わせる設定やアイデア
   - エレベーターピッチ性: タイトルと冒頭から一文で魅力を説明できるか
   - 印象的なシーン: SNSで引用・言及したくなる場面がサンプルにあるか
   - 感情的インパクト: 読後に誰かに話したくなる強い体験
   - ジャンル内での差別化

4. 世界構築力（worldBuilding）— 物語世界の設計・構築の質
   注目すべきデータ: 世界設定のカテゴリと詳細、語彙豊富度、使用漢字の種類数
   評価ポイント:
   - 設定の多層性: 世界設定のカテゴリ数（地理・魔法・社会・技術・文化）
   - 設定の一貫性: 世界設定の詳細に矛盾がないか
   - 固有のルール: 独自の体系（魔法、社会制度等）が論理的に構築されているか
   - 見せ方の巧みさ: テキストサンプルで設定が自然に物語に織り込まれているか（説明の塊になっていないか）
   - 語彙の豊かさ: 語彙豊富度が高いほど多様な表現。使用漢字の種類数も指標
   - 現代日常系など世界構築が軽いジャンルでは、ジャンル相応の水準で評価すること

5. キャラクター深度（characterDepth）— 登場人物の立体感・魅力
   注目すべきデータ: キャラクター別セリフサンプル、登場人物数、作者のキャラクター設計データ
   評価ポイント:
   - 声の一貫性: 各キャラクターのセリフサンプルが個性的で区別可能か
   - 動機の説得力: テキストサンプルからキャラクターの行動原理が読み取れるか
   - 内面描写の深さ: 感情・思考・葛藤が丁寧に描かれているか
   - 成長アーク: 設計データがある場合、計画された人物像が本文で実現されているか
   - 登場人物が多い場合、書き分けができているか
   - 関係性の複雑さ: 単純な二項対立だけでなく多面的な関係があるか

6. 構造スコア（structuralScore）— プロット構成・物語設計の質
   注目すべきデータ: 各話の要約、伏線の設置数・回収数・回収率、各話の感情弧、エピソード長のばらつき
   評価ポイント:
   - 全体構成: 各話の要約の流れに起承転結が見えるか
   - 伏線の設計: 伏線の回収率が高いほど良い。未回収の伏線は意図的な余韻か放置か判断
   - ペーシング: 各話の感情弧に適切な緩急があるか。エピソード長のばらつきが極端なら不安定
   - クライマックス: 物語の頂点が十分な盛り上がりを持つか（クライマックス付近のサンプル参照）
   - 結末: 結末サンプルで物語が適切に着地しているか
   - 設計データとの整合: 作者の前提設定や中心的葛藤がある場合、それが作品で実現されているか

■ 作者のキャラクター設計データや物語構造データがある場合は、計画と実際の作品を比較して「設計通りに実現できているか」も加味してください。

■ 構造分析データが不十分な場合（分析カバレッジが50%未満）は、テキストサンプルの比重を高めて評価してください。

■ フィードバックの書き方（最重要）

あなたのフィードバックは作者本人が読みます。以下のルールを厳守してください。

【絶対禁止事項】
- 定量メトリクスの数値や変数名をそのまま書くこと。「会話比率30%」「文長のばらつき12.3」「語彙豊富度0.85」「分析カバレッジ70%」「sentenceLengthVariance」「vocabularyRichness」等の生データは作者には意味不明です。代わりに「会話が多め」「文の長さに変化がある」「語彙が豊か」のように、読んで直感的にわかる日本語で表現してください。
- 英語の変数名・パラメータ名（immersion, transformation, virality, worldBuilding, characterDepth, structuralScore等）を使うこと。
- 「〜の可能性を示唆しています」「〜である可能性があります」のような分析レポート調の表現。作者に直接語りかける文体にしてください。
- 「ペーシング」「プロット」「アーク」等のカタカナ専門用語。「テンポ」「展開」「成長の軌跡」のように平易な言葉に言い換えてください。

【各軸の分析コメント（analysis）のルール】
1. まず、この軸における作品の「最大の強み」を1文で具体的に褒める。作品名・キャラ名・場面を引用すること。
2. 次に、スコアの根拠となる「惜しい点」や「伸びしろ」を1〜2文で伝える。「〜が弱い」ではなく「〜すればもっと良くなる」という書き方にする。
3. 抽象的な講評（「描写が不十分」「構成が甘い」等）は禁止。必ず「どの場面の」「どの描写が」「なぜ」を明示する。
4. 作品固有の言葉（キャラ名、地名、セリフ、設定名等）を積極的に使い、「この作品をちゃんと読んだ」ことが伝わるコメントにする。
5. 文体は「先輩作家が後輩に語りかける」トーンで。分析レポートではなく、人間の感想として書く。

悪い例: 「文体のリズムは概ね良好ですが、一部で冗長な描写が見られます」
悪い例: 「短編と長編が混在し、ペーシングが不安定である可能性を示唆しています」
悪い例: 「会話比率が45%で適正範囲内ですが、語彙豊富度が0.72とやや低めです」
良い例: 「冒頭で〇〇が△△に出会う場面は、短い文の畳みかけで緊迫感が見事に出ています。一方、第3話の森の描写は地の文が5段落続き、読者が息切れしやすい箇所です。ここに一行だけ〇〇の内心を挟むと、描写と感情が交互になりテンポが改善します」

【改善提案（improvementTips）のルール】
1. 各提案は「どこを」「どう変えると」「なぜ良くなるか」の3要素を含むこと。
2. 作者がすぐに着手できる粒度にする。「もっと描写を増やす」ではなく「第○話の△△のシーンに、□□の五感描写を2〜3行追加する」のように具体的に。
3. 3つの提案は、最もインパクトが大きいものから順に並べる。
4. この作品の個性やスタイルを壊さない範囲での提案にする。作者の文体を尊重し、全く別の作風にしろという提案はしない。
5. 数値データや変数名を含めないこと。「第3話のテンポを整えましょう」であって「episodeLengthVarianceが高いです」ではない。

悪い例: 「キャラクターの内面描写を充実させましょう」
良い例: 「第5話で〇〇が△△を裏切る場面は行動だけが書かれていますが、直前に〇〇の逡巡を2〜3行挟むと、読者は裏切りの衝撃と同時に〇〇への共感も得られ、物語の深みが一段増します」

■ 感情タグは作品の主要な読後感情を以下から3〜5個選んでください:
courage, tears, worldview, healing, excitement, thinking, laughter, empathy, awe, nostalgia, suspense, mystery, hope, beauty, growth

■ 以下のJSON形式で回答してください（JSON以外の文章は不要）:
{
  "immersion": <0-100>,
  "transformation": <0-100>,
  "virality": <0-100>,
  "worldBuilding": <0-100>,
  "characterDepth": <0-100>,
  "structuralScore": <0-100>,
  "analysis": {
    "immersion": "<強みを1文で褒めた後、伸びしろを1〜2文で。作品固有の名前・場面を必ず引用>",
    "transformation": "<同上>",
    "virality": "<同上>",
    "worldBuilding": "<同上>",
    "characterDepth": "<同上>",
    "structuralScore": "<同上>"
  },
  "improvementTips": [
    "<最もインパクトの大きい改善提案。「どこを」「どう変えると」「なぜ良くなるか」を含む>",
    "<2番目の改善提案>",
    "<3番目の改善提案>"
  ],
  "emotionTags": ["<感情タグ3〜5個>"]
}`;

/**
 * Build the user prompt from structured scoring input.
 * All labels use natural language — no variable names exposed to the LLM.
 */
export function buildScoringUserPrompt(input: ScoringInput): string {
  const { title, genre, metrics, structure } = input;
  const m = metrics;
  const s = structure;

  const sections: string[] = [];

  // ── 作品概要 ──
  sections.push(`【作品概要】
タイトル: ${title}
ジャンル: ${genre || '不明'}
エピソード数: ${m.episodeCount}話
総文字数: ${m.totalCharCount.toLocaleString()}文字
構造分析カバレッジ: ${Math.round(s.analysisCoverage * 100)}%`);

  // ── 文体の定量分析 ──
  sections.push(`【文体の定量分析】
会話の占める割合: ${(m.dialogueRatio * 100).toFixed(1)}%（会話の総数: ${m.dialogueLineCount}回、一回あたりの平均文字数: ${m.avgDialogueLength}文字）
一文あたりの平均文字数: ${m.avgSentenceLength}文字（文長のばらつき: ${m.sentenceLengthVariance}）
短い文（20文字未満）の割合: ${(m.shortSentenceRatio * 100).toFixed(1)}% / 長い文（80文字超）の割合: ${(m.longSentenceRatio * 100).toFixed(1)}%
段落の総数: ${m.paragraphCount}（一段落あたりの平均文字数: ${m.avgParagraphLength}文字、一行だけの段落の割合: ${(m.singleLineParagraphRatio * 100).toFixed(1)}%）
使用されている漢字の種類数: ${m.uniqueKanjiCount}種 / 語彙の豊富さ（多様性指標）: ${m.vocabularyRichness}
場面転換の回数: ${m.sceneBreakCount}回
感嘆符（！）の密度: 千文字あたり${m.exclamationDensity.toFixed(1)}回 / 疑問符（？）の密度: 千文字あたり${m.questionDensity.toFixed(1)}回 / 省略記号（…）の密度: 千文字あたり${m.ellipsisDensity.toFixed(1)}回
各話の文字数のばらつき: ${m.episodeLengthVariance}（一話あたりの平均文字数: ${m.avgEpisodeLength}文字）`);

  // ── 各話の要約 ──
  if (s.episodeSummaries.length > 0) {
    const summaries = s.episodeSummaries
      .map((e) => `第${e.order + 1}話「${e.title}」: ${e.summary}`)
      .join('\n');
    sections.push(`【各話の要約】\n${summaries}`);
  }

  // ── 感情弧の推移 ──
  if (s.emotionalArcProgression.length > 0) {
    sections.push(`【各話の感情弧の推移】\n${s.emotionalArcProgression.map((arc, i) => `第${i + 1}話: ${arc}`).join('\n')}`);
  }

  // ── 視点 ──
  if (s.narrativePOV) {
    sections.push(`【語りの視点】${s.narrativePOV}${s.povConsistency ? '（全編を通じて統一）' : '（途中で視点の変化あり）'}`);
  }

  // ── 伏線の分析 ──
  if (s.totalForeshadowingsPlanted > 0) {
    let section = `【伏線の分析】
設置された伏線の数: ${s.totalForeshadowingsPlanted}件 / 回収された伏線の数: ${s.totalForeshadowingsResolved}件 / 回収率: ${(s.foreshadowingResolutionRate * 100).toFixed(0)}%`;
    if (s.unresolvedForeshadowings.length > 0) {
      section += `\nまだ回収されていない伏線:\n${s.unresolvedForeshadowings.map((f) => `- ${f}`).join('\n')}`;
    }
    sections.push(section);
  }

  // ── キャラクター別セリフサンプル ──
  if (s.characterVoiceConsistency.length > 0) {
    const charSection = s.characterVoiceConsistency
      .slice(0, 8)
      .map((c) => `${c.name}:\n${c.samples.map((l) => `  「${l}」`).join('\n')}`)
      .join('\n');
    sections.push(`【キャラクター別セリフサンプル】（全${s.characterCount}名のうち抜粋）\n${charSection}`);
  }

  // ── 世界設定 ──
  if (s.worldSettingCategories.length > 0) {
    const catLine = s.worldSettingCategories
      .map((c) => `${c.category}（${c.count}件）`)
      .join('、');
    let section = `【世界設定】カテゴリ別の設定数: ${catLine}`;
    if (s.worldSettingDetails.length > 0) {
      section += `\n設定の詳細:\n${s.worldSettingDetails.join('\n')}`;
    }
    sections.push(section);
  }

  // ── 作者の設計データ ──
  if (s.hasDesignData) {
    const parts: string[] = [];
    if (s.designedPremise) parts.push(`作品の前提: ${s.designedPremise}`);
    if (s.designedConflict) parts.push(`中心的な葛藤: ${s.designedConflict}`);
    if (s.designedThemes.length > 0) parts.push(`テーマ: ${s.designedThemes.join('、')}`);
    parts.push(`設計されたキャラクター数: ${s.designedCharacterCount}名`);
    sections.push(`【作者による設計データ】\n${parts.join('\n')}`);
  }

  // ── テキストサンプル ──
  sections.push(`【テキストサンプル: 冒頭】\n${s.textSamples.opening}`);
  sections.push(`【テキストサンプル: 中盤】\n${s.textSamples.midpoint}`);
  sections.push(`【テキストサンプル: クライマックス付近】\n${s.textSamples.climaxRegion}`);
  sections.push(`【テキストサンプル: 結末】\n${s.textSamples.ending}`);

  return sections.join('\n\n');
}

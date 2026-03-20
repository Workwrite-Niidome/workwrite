import { ScoringInput } from './types';

export const SCORING_SYSTEM_PROMPT = `あなたは小説家を育ててきたベテラン編集者です。作者が「次に何をすれば良くなるか」が明確にわかるフィードバックを届けてください。

あなたは作品の構造分析データ・定量的な文体情報・作品の抜粋4箇所を受け取ります。これらを総合して、6つの軸で0〜100点の採点と、作者への具体的なフィードバックを行ってください。

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

1. 没入力 — 読者を物語世界に引き込む力
   評価ポイント:
   - 冒頭のフック: 最初の数段落で読者の注意を掴めているか
   - 五感描写: 視覚・聴覚・触覚等の描写が作品全体に散りばめられているか
   - 文体のリズム: 短い文と長い文の緩急があるか
   - 情報開示のバランス: 説明過多でも説明不足でもないか
   - 場面転換: 適切な頻度で場面が切り替わっているか
   - 会話と地の文のバランス: 極端な偏りがないか

2. 変容力 — 読者の内面に変化を与える力
   評価ポイント:
   - テーマの深さ: 作品全体で一貫したテーマが探求されているか
   - 感情の軌跡: 各話に感情の起伏があるか
   - クライマックスの衝撃: 物語の山場に感情的ピークがあるか
   - 読後感: 結末に余韻・問いかけがあるか
   - 普遍性: 時代・文化を超えて共感できるテーマを扱っているか

3. 拡散力 — 人に薦めたくなる・語りたくなる力
   評価ポイント:
   - コンセプトの新規性: 「こんな話は初めて」と思わせる設定やアイデア
   - 一言で伝わる魅力: タイトルと冒頭から作品の魅力を説明できるか
   - 印象的なシーン: SNSで引用・言及したくなる場面があるか
   - 感情的インパクト: 読後に誰かに話したくなる強い体験
   - ジャンル内での差別化

4. 世界構築力 — 物語世界の設計・構築の質
   評価ポイント:
   - 設定の多層性: 地理・魔法・社会・技術・文化など多面的に構築されているか
   - 設定の一貫性: 矛盾がないか
   - 固有のルール: 独自の体系（魔法、社会制度等）が論理的に構築されているか
   - 見せ方の巧みさ: 設定が自然に物語に織り込まれているか（説明の塊になっていないか）
   - 語彙の豊かさ: 多様な表現や独自の用語が使われているか
   - 現代日常系など世界構築が軽いジャンルでは、ジャンル相応の水準で評価すること

5. キャラクター深度 — 登場人物の立体感・魅力
   評価ポイント:
   - 声の一貫性: 各キャラクターの台詞が個性的で区別可能か
   - 動機の説得力: キャラクターの行動原理が読み取れるか
   - 内面描写の深さ: 感情・思考・葛藤が丁寧に描かれているか
   - 成長の軌跡: キャラクターが物語を通じて変化・成長しているか
   - 登場人物が多い場合、書き分けができているか
   - 関係性の複雑さ: 単純な二項対立だけでなく多面的な関係があるか

6. 構造スコア — 物語の構成・設計の質
   評価ポイント:
   - 全体構成: 物語の流れに起承転結が見えるか
   - 伏線の設計: 張った伏線がきちんと回収されているか。未回収は意図的な余韻か放置か判断
   - テンポ: 各話に適切な緩急があるか
   - クライマックス: 物語の頂点が十分な盛り上がりを持つか
   - 結末: 物語が適切に着地しているか
   - 作者の設計意図との整合: 設計データがある場合、それが作品で実現されているか

■ 作者のキャラクター設計データや物語構造データがある場合は、計画と実際の作品を比較して「設計通りに実現できているか」も加味してください。

■ 構造分析データが不十分な場合（分析カバレッジが50%未満）は、テキストサンプルの比重を高めて評価してください。

■ フィードバックの書き方（最重要）

あなたのフィードバックは作者本人が読みます。以下のルールを厳守してください。

【絶対禁止事項】
- 定量メトリクスの数値や変数名をそのまま書くこと。「会話比率30%」「文長のばらつき12.3」「語彙豊富度0.85」「分析カバレッジ70%」「sentenceLengthVariance」「vocabularyRichness」等の生データは作者には意味不明です。代わりに「会話が多め」「文の長さに変化がある」「語彙が豊か」のように、読んで直感的にわかる日本語で表現してください。
- 英語の変数名・パラメータ名（immersion, transformation, virality, worldBuilding, characterDepth, structuralScore等）を使うこと。
- 「〜の可能性を示唆しています」「〜である可能性があります」のような分析レポート調の表現。作者に直接語りかける文体にしてください。
- 「ペーシング」「プロット」「アーク」等のカタカナ専門用語。「テンポ」「展開」「成長の軌跡」のように平易な言葉に言い換えてください。
- システム内部の用語をそのまま使うこと。以下は全て禁止です:
  「冒頭サンプル」「結末サンプル」「テキストサンプル」「クライマックス付近のサンプル」→ 「冒頭」「結末」「本文」「山場の場面」と言い換え
  「分析カバレッジ」「構造分析」「感情弧」「回収率」→ 使わない。具体的な場面で説明する
  「設計データ」「設計テーマ」→ 「作者の設定」「作品のテーマ」と言い換え
  「語彙豊富度」「会話比率」「短文率」「長文率」「場面転換数」→ 数値を出さず、読んだ印象として書く

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
  const { title, genre, completionStatus, isImported, metrics, structure } = input;
  const m = metrics;
  const s = structure;

  const completionLabel = completionStatus === 'COMPLETED' ? '完結済み'
    : completionStatus === 'HIATUS' ? '休載中' : '連載中';

  const sections: string[] = [];

  // ── 作品概要 ──
  sections.push(`【作品概要】
タイトル: ${title}
ジャンル: ${genre || '不明'}
連載状態: ${completionLabel}
分析モード: ${isImported ? '簡易分析（外部プラットフォームからのインポート作品）' : '詳細分析'}
エピソード数: ${m.episodeCount}話
総文字数: ${m.totalCharCount.toLocaleString()}文字`);

  // ── インポート作品の注意 ──
  if (isImported) {
    sections.push(`【重要: 簡易分析モード】
この作品は外部プラットフォームからインポートされたもので、キャラクター設定・プロット設計・世界観データなどの構造化データがありません。
以下のルールで評価してください:
- 本文の抜粋4箇所と定量的な文体情報のみを根拠に評価する
- 「キャラクター深度」は、本文中の台詞や描写から読み取れる範囲で評価する（設計データがないことを減点しない）
- 「構造スコア」は、各話の要約がない場合は本文の流れから判断する
- 改善提案は「Workwriteでキャラクター設定やプロットを登録すると、より精密な分析が可能です」という一文を3つ目の提案の末尾に添える
- フィードバック全体を通じて「データがないから評価できない」という表現は絶対に使わない。本文から読み取れる範囲で堂々と評価する`);
  }

  // ── 分析データの注意 ──
  if (!isImported && s.analysisCoverage < 1.0) {
    const pct = Math.round(s.analysisCoverage * 100);
    sections.push(`【注意】この作品の構造分析は全${m.episodeCount}話のうち${pct}%のみ完了しています。感情弧や伏線データが一部の話に限られている場合は、テキストサンプルを重視して評価してください。データが不足している部分を「データがない」と指摘するのではなく、テキストサンプルから読み取れる範囲で評価してください。`);
  }

  if (completionStatus !== 'COMPLETED') {
    sections.push(`【注意】この作品は${completionLabel}です。伏線が未回収であること、結末が存在しないことは減点対象にしないでください。連載中の作品は「ここまでの展開」として評価し、構造スコアの結末評価は省いてください。`);
  }

  // ── 文体の定量分析 ──
  // Convert episode length variance to human-readable description
  const avgLen = m.avgEpisodeLength;
  const stdDev = Math.round(Math.sqrt(m.episodeLengthVariance));
  // 各話の文字数のばらつきは普通のこと。極端な場合(平均の100%超)のみ言及
  const varianceDesc = stdDev > avgLen * 1.0 ? '各話の文字数にかなり大きな差がある'
    : ''; // 通常のばらつきは言及しない

  sections.push(`【文体の定量分析】
会話の占める割合: ${(m.dialogueRatio * 100).toFixed(1)}%（会話の総数: ${m.dialogueLineCount}回、一回あたりの平均文字数: ${m.avgDialogueLength}文字）
一文あたりの平均文字数: ${m.avgSentenceLength}文字
短い文の割合: ${(m.shortSentenceRatio * 100).toFixed(1)}% / 長い文の割合: ${(m.longSentenceRatio * 100).toFixed(1)}%
段落の総数: ${m.paragraphCount}（一段落あたりの平均文字数: ${m.avgParagraphLength}文字）
場面転換の回数: ${m.sceneBreakCount}回
一話あたりの平均文字数: ${m.avgEpisodeLength}文字${varianceDesc ? `（${varianceDesc}）` : ''}`);

  // ── 各話の要約 ──
  if (s.episodeSummaries.length > 0) {
    const summaries = s.episodeSummaries
      .map((e) => `第${e.order + 1}話「${e.title}」: ${e.summary}`)
      .join('\n');
    sections.push(`【各話の要約】\n${summaries}`);
  }

  // ── 感情弧の推移 ──
  if (s.emotionalArcProgression.length > 0) {
    let arcSection = `【各話の感情弧の推移】\n${s.emotionalArcProgression.map((arc, i) => `第${i + 1}話: ${arc}`).join('\n')}`;
    if (s.emotionalArcProgression.length < m.episodeCount) {
      arcSection += `\n※ ${m.episodeCount}話中${s.emotionalArcProgression.length}話分のデータです。未分析の話についてはテキストサンプルから推測してください。`;
    }
    sections.push(arcSection);
  }

  // ── 視点 ──
  if (s.narrativePOV) {
    sections.push(`【語りの視点】${s.narrativePOV}${s.povConsistency ? '（全編を通じて統一）' : '（途中で視点の変化あり）'}`);
  }

  // ── 伏線の分析 ──
  if (s.totalForeshadowingsPlanted > 0) {
    let section = `【伏線の分析】
設置された伏線の数: ${s.totalForeshadowingsPlanted}件 / 回収された伏線の数: ${s.totalForeshadowingsResolved}件`;
    if (completionStatus === 'COMPLETED') {
      section += ` / 回収率: ${(s.foreshadowingResolutionRate * 100).toFixed(0)}%`;
    } else {
      section += `\n※ 連載中のため未回収の伏線は今後の展開で回収される可能性があります。未回収を減点対象にしないでください。`;
    }
    if (s.unresolvedForeshadowings.length > 0) {
      section += `\nまだ回収されていない伏線:\n${s.unresolvedForeshadowings.slice(0, 5).map((f) => `- ${f}`).join('\n')}`;
      if (s.unresolvedForeshadowings.length > 5) {
        section += `\n（他${s.unresolvedForeshadowings.length - 5}件）`;
      }
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

import { ScoringInput } from './types';

export const SCORING_SYSTEM_PROMPT = `あなたはプロの文芸批評家・小説編集者です。作品の構造分析データと定量メトリクス、そして4箇所の戦略的テキストサンプルに基づいて、6つの軸で0〜100点で厳密に採点してください。

■ 採点の大原則
- 50点が「平均的なWeb小説」の水準です。安易に高得点をつけないでください。
- 各軸の点数分布の目安:
  0-19: 致命的な欠陥がある（読み続けることが困難）
  20-34: 大きな課題がある（基礎的な技術不足）
  35-49: 平均以下（改善の余地が多い）
  50-64: 平均的（Web小説として標準的な水準）
  65-79: 優秀（明確な強みがある）
  80-89: 秀作（出版レベルの高い品質）
  90-100: 傑出（ジャンルの代表作クラス。滅多につけない）

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
    "immersion": "<具体的な根拠を挙げた2〜3文の分析>",
    "transformation": "<具体的な根拠を挙げた2〜3文の分析>",
    "virality": "<具体的な根拠を挙げた2〜3文の分析>",
    "worldBuilding": "<具体的な根拠を挙げた2〜3文の分析>",
    "characterDepth": "<具体的な根拠を挙げた2〜3文の分析>",
    "structuralScore": "<具体的な根拠を挙げた2〜3文の分析>"
  },
  "improvementTips": ["<具体的かつ実行可能な改善提案1>", "<改善提案2>", "<改善提案3>"],
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

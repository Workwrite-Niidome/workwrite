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

1. immersion（没入力）— 読者を物語世界に引き込む力
   注目すべきデータ: dialogueRatio, avgSentenceLength, sentenceLengthVariance, sceneBreakCount, テキストサンプルの冒頭
   評価ポイント:
   - 冒頭のフック: テキストサンプル（opening）で最初の数段落が読者の注意を掴めているか
   - 五感描写: テキストサンプル全体に視覚・聴覚・触覚等の描写があるか
   - 文体のリズム: sentenceLengthVarianceが高いほど緩急がある。shortSentenceRatioとlongSentenceRatioのバランス
   - 情報開示のバランス: 説明過多（longSentenceRatio高すぎ）でも説明不足でもないか
   - 場面転換: sceneBreakCountが適切か（少なすぎると単調、多すぎると断片的）
   - 会話と地の文のバランス: dialogueRatio 0.3〜0.5が一般的。極端な偏りは減点

2. transformation（変容力）— 読者の内面に変化を与える力
   注目すべきデータ: emotionalArcProgression, designedThemes, テキストサンプルのclimax/ending
   評価ポイント:
   - テーマの深さ: 設計テーマ（あれば）が作品全体で一貫して探求されているか
   - 感情の軌跡: emotionalArcProgressionに起伏があるか（単調な感情推移は低評価）
   - クライマックスの衝撃: climaxRegionサンプルで感情的ピークがあるか
   - 読後感: endingサンプルに余韻・問いかけがあるか
   - 普遍性: 時代・文化を超えて共感できるテーマを扱っているか

3. virality（拡散力）— 人に薦めたくなる・語りたくなる力
   注目すべきデータ: テキストサンプル全体, 作品タイトル, episodeCount, exclamationDensity
   評価ポイント:
   - コンセプトの新規性: 「こんな話は初めて」と思わせる設定やアイデア
   - エレベーターピッチ性: タイトルと冒頭から一文で魅力を説明できるか
   - 印象的なシーン: SNSで引用・言及したくなる場面がサンプルにあるか
   - 感情的インパクト: 読後に誰かに話したくなる強い体験
   - ジャンル内での差別化

4. worldBuilding（世界構築力）— 物語世界の設計・構築の質
   注目すべきデータ: worldSettingCategories, worldSettingDetails, vocabularyRichness, uniqueKanjiCount
   評価ポイント:
   - 設定の多層性: worldSettingCategoriesの種類数（geography/magic/social/technology/culture）
   - 設定の一貫性: worldSettingDetailsに矛盾がないか
   - 固有のルール: 独自の体系（魔法、社会制度等）が論理的に構築されているか
   - 見せ方の巧みさ: テキストサンプルで設定が自然に物語に織り込まれているか（説明の塊になっていないか）
   - 語彙の豊かさ: vocabularyRichnessが高いほど多様な表現。uniqueKanjiCountも指標
   - 現代日常系など世界構築が軽いジャンルでは、ジャンル相応の水準で評価すること

5. characterDepth（キャラクター深度）— 登場人物の立体感・魅力
   注目すべきデータ: characterVoiceConsistency, characterCount, dialogueSamples, designedCharacters
   評価ポイント:
   - 声の一貫性: characterVoiceConsistencyの各キャラのセリフサンプルが個性的で区別可能か
   - 動機の説得力: テキストサンプルからキャラクターの行動原理が読み取れるか
   - 内面描写の深さ: 感情・思考・葛藤が丁寧に描かれているか
   - 成長アーク: 設計データ（designedCharacters）がある場合、計画された人物像が本文で実現されているか
   - キャラクター数: characterCountが多い場合、書き分けができているか
   - 関係性の複雑さ: 単純な二項対立だけでなく多面的な関係があるか

6. structuralScore（構造スコア）— プロット構成・物語設計の質
   注目すべきデータ: episodeSummaries, foreshadowing*, emotionalArcProgression, episodeLengthVariance
   評価ポイント:
   - 全体構成: episodeSummariesの流れに起承転結が見えるか
   - 伏線の設計: foreshadowingResolutionRateが高いほど良い。unresolvedForeshadowingsは意図的な余韻か放置か
   - ペーシング: emotionalArcProgressionに適切な緩急があるか。episodeLengthVarianceが極端なら不安定
   - クライマックス: 物語の頂点が十分な盛り上がりを持つか（climaxRegionサンプル参照）
   - 結末: endingサンプルで物語が適切に着地しているか
   - 設計データとの整合: designedPremise/designedConflictがある場合、それが作品で実現されているか

■ 構造分析データが不十分な場合（analysisCoverage < 0.5）は、テキストサンプルの比重を高めて評価してください。

■ emotionTagsは作品の主要な読後感情を以下から3〜5個選んでください:
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
 * This replaces raw text with compact structured data + strategic samples.
 */
export function buildScoringUserPrompt(input: ScoringInput): string {
  const { title, genre, metrics, structure } = input;
  const m = metrics;
  const s = structure;

  const sections: string[] = [];

  // ── Overview ──
  sections.push(`【作品概要】
タイトル: ${title}
ジャンル: ${genre || '不明'}
エピソード数: ${m.episodeCount}
総文字数: ${m.totalCharCount.toLocaleString()}文字
構造分析カバレッジ: ${Math.round(s.analysisCoverage * 100)}%`);

  // ── Quantitative Metrics ──
  sections.push(`【定量メトリクス】
会話比率: ${(m.dialogueRatio * 100).toFixed(1)}%（会話行数: ${m.dialogueLineCount}、平均会話長: ${m.avgDialogueLength}文字）
平均文長: ${m.avgSentenceLength}文字（分散: ${m.sentenceLengthVariance}）
短文率(<20字): ${(m.shortSentenceRatio * 100).toFixed(1)}% / 長文率(>80字): ${(m.longSentenceRatio * 100).toFixed(1)}%
段落数: ${m.paragraphCount}（平均段落長: ${m.avgParagraphLength}文字、一行段落率: ${(m.singleLineParagraphRatio * 100).toFixed(1)}%）
漢字種類数: ${m.uniqueKanjiCount} / 語彙豊富度: ${m.vocabularyRichness}
場面転換数: ${m.sceneBreakCount}
！密度: ${m.exclamationDensity.toFixed(1)}/千字 / ？密度: ${m.questionDensity.toFixed(1)}/千字 / …密度: ${m.ellipsisDensity.toFixed(1)}/千字
エピソード長分散: ${m.episodeLengthVariance}（平均: ${m.avgEpisodeLength}文字）`);

  // ── Episode Summaries ──
  if (s.episodeSummaries.length > 0) {
    const summaries = s.episodeSummaries
      .map((e) => `第${e.order + 1}話「${e.title}」: ${e.summary}`)
      .join('\n');
    sections.push(`【エピソード要約】\n${summaries}`);
  }

  // ── Emotional Arc ──
  if (s.emotionalArcProgression.length > 0) {
    sections.push(`【感情弧の推移】\n${s.emotionalArcProgression.map((arc, i) => `第${i + 1}話: ${arc}`).join('\n')}`);
  }

  // ── POV ──
  if (s.narrativePOV) {
    sections.push(`【視点】${s.narrativePOV}${s.povConsistency ? '（全編統一）' : '（不統一あり）'}`);
  }

  // ── Foreshadowing ──
  if (s.totalForeshadowingsPlanted > 0) {
    let foreshadowSection = `【伏線分析】
設置数: ${s.totalForeshadowingsPlanted} / 回収数: ${s.totalForeshadowingsResolved} / 回収率: ${(s.foreshadowingResolutionRate * 100).toFixed(0)}%`;
    if (s.unresolvedForeshadowings.length > 0) {
      foreshadowSection += `\n未回収の伏線:\n${s.unresolvedForeshadowings.map((f) => `- ${f}`).join('\n')}`;
    }
    sections.push(foreshadowSection);
  }

  // ── Character Dialogue ──
  if (s.characterVoiceConsistency.length > 0) {
    const charSection = s.characterVoiceConsistency
      .slice(0, 8) // limit characters
      .map((c) => `${c.name}:\n${c.samples.map((l) => `  「${l}」`).join('\n')}`)
      .join('\n');
    sections.push(`【キャラクター別セリフサンプル】（${s.characterCount}名中抜粋）\n${charSection}`);
  }

  // ── World Setting ──
  if (s.worldSettingCategories.length > 0) {
    const catLine = s.worldSettingCategories
      .map((c) => `${c.category}(${c.count})`)
      .join(', ');
    let worldSection = `【世界設定】カテゴリ: ${catLine}`;
    if (s.worldSettingDetails.length > 0) {
      worldSection += `\n${s.worldSettingDetails.join('\n')}`;
    }
    sections.push(worldSection);
  }

  // ── Design Data Comparison ──
  if (s.hasDesignData) {
    const designParts: string[] = [];
    if (s.designedPremise) designParts.push(`前提: ${s.designedPremise}`);
    if (s.designedConflict) designParts.push(`中心的葛藤: ${s.designedConflict}`);
    if (s.designedThemes.length > 0) designParts.push(`テーマ: ${s.designedThemes.join(', ')}`);
    designParts.push(`設計キャラクター数: ${s.designedCharacterCount}`);
    sections.push(`【作者の設計データ】\n${designParts.join('\n')}`);
  }

  // ── Text Samples (always included) ──
  sections.push(`【テキストサンプル: 冒頭】\n${s.textSamples.opening}`);
  sections.push(`【テキストサンプル: 中盤】\n${s.textSamples.midpoint}`);
  sections.push(`【テキストサンプル: クライマックス付近】\n${s.textSamples.climaxRegion}`);
  sections.push(`【テキストサンプル: 結末】\n${s.textSamples.ending}`);

  return sections.join('\n\n');
}

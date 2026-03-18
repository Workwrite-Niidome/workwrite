import { buildScoringUserPrompt } from '../scoring-prompt';
import { ScoringInput, ProgrammaticMetrics, StructuralProfile } from '../types';

// ─────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────

function makeMetrics(overrides: Partial<ProgrammaticMetrics> = {}): ProgrammaticMetrics {
  return {
    totalCharCount: 10000,
    episodeCount: 10,
    avgEpisodeLength: 1000,
    dialogueRatio: 0.35,
    dialogueLineCount: 50,
    avgDialogueLength: 20,
    avgSentenceLength: 25,
    sentenceLengthVariance: 150,
    shortSentenceRatio: 0.2,
    longSentenceRatio: 0.1,
    avgParagraphLength: 80,
    paragraphCount: 125,
    singleLineParagraphRatio: 0.6,
    uniqueKanjiCount: 200,
    vocabularyRichness: 0.75,
    sceneBreakCount: 5,
    exclamationDensity: 2.0,
    questionDensity: 1.5,
    ellipsisDensity: 3.0,
    episodeLengthVariance: 100000,
    dialogueRatioByEpisode: Array(10).fill(0.35),
    ...overrides,
  };
}

function makeStructure(overrides: Partial<StructuralProfile> = {}): StructuralProfile {
  return {
    episodeSummaries: [],
    emotionalArcProgression: [],
    narrativePOV: null,
    povConsistency: true,
    totalForeshadowingsPlanted: 0,
    totalForeshadowingsResolved: 0,
    foreshadowingResolutionRate: 0,
    unresolvedForeshadowings: [],
    characterCount: 3,
    characterVoiceConsistency: [],
    worldSettingCategories: [],
    worldSettingDetails: [],
    hasDesignData: false,
    designedCharacterCount: 0,
    designedThemes: [],
    designedPremise: null,
    designedConflict: null,
    textSamples: {
      opening: '冒頭のサンプルテキスト',
      midpoint: '中盤のサンプルテキスト',
      climaxRegion: 'クライマックスのサンプルテキスト',
      ending: '結末のサンプルテキスト',
    },
    analysisCoverage: 1.0,
    ...overrides,
  };
}

function makeInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    title: 'テスト作品',
    genre: 'ファンタジー',
    completionStatus: 'ONGOING',
    metrics: makeMetrics(),
    structure: makeStructure(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// COMPLETION STATUS
// ─────────────────────────────────────────────────────────

describe('buildScoringUserPrompt - completionStatus', () => {
  it('shows 連載中 label for ONGOING status', () => {
    const prompt = buildScoringUserPrompt(makeInput({ completionStatus: 'ONGOING' }));
    expect(prompt).toContain('連載状態: 連載中');
  });

  it('shows 完結済み label for COMPLETED status', () => {
    const prompt = buildScoringUserPrompt(makeInput({ completionStatus: 'COMPLETED' }));
    expect(prompt).toContain('連載状態: 完結済み');
  });

  it('shows 休載中 label for HIATUS status', () => {
    const prompt = buildScoringUserPrompt(makeInput({ completionStatus: 'HIATUS' }));
    expect(prompt).toContain('連載状態: 休載中');
  });

  it('includes ongoing warning for ONGOING: warns not to penalize unresolved foreshadowing', () => {
    const prompt = buildScoringUserPrompt(makeInput({ completionStatus: 'ONGOING' }));
    expect(prompt).toContain('伏線が未回収であること');
    expect(prompt).toContain('減点対象にしないでください');
  });

  it('includes ongoing warning for HIATUS: warns not to penalize unresolved foreshadowing', () => {
    const prompt = buildScoringUserPrompt(makeInput({ completionStatus: 'HIATUS' }));
    expect(prompt).toContain('伏線が未回収であること');
    expect(prompt).toContain('減点対象にしないでください');
  });

  it('does NOT include ongoing warning for COMPLETED works', () => {
    const prompt = buildScoringUserPrompt(makeInput({ completionStatus: 'COMPLETED' }));
    // The specific ongoing-only warning text should not appear
    expect(prompt).not.toContain('伏線が未回収であること、結末が存在しないことは減点対象にしないでください');
  });

  it('ONGOING warning mentions that the work is 連載中', () => {
    const prompt = buildScoringUserPrompt(makeInput({ completionStatus: 'ONGOING' }));
    expect(prompt).toContain('この作品は連載中です');
  });

  it('HIATUS warning mentions that the work is 休載中', () => {
    const prompt = buildScoringUserPrompt(makeInput({ completionStatus: 'HIATUS' }));
    expect(prompt).toContain('この作品は休載中です');
  });
});

// ─────────────────────────────────────────────────────────
// FORESHADOWING RESOLUTION RATE
// ─────────────────────────────────────────────────────────

describe('buildScoringUserPrompt - foreshadowing resolution rate', () => {
  const structureWithForeshadowing = makeStructure({
    totalForeshadowingsPlanted: 10,
    totalForeshadowingsResolved: 8,
    foreshadowingResolutionRate: 0.8,
    unresolvedForeshadowings: ['伏線A', '伏線B'],
  });

  it('shows foreshadowing resolution rate (回収率) for COMPLETED works', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      completionStatus: 'COMPLETED',
      structure: structureWithForeshadowing,
    }));
    expect(prompt).toContain('回収率: 80%');
  });

  it('does NOT show foreshadowing resolution rate for ONGOING works', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      completionStatus: 'ONGOING',
      structure: structureWithForeshadowing,
    }));
    expect(prompt).not.toContain('回収率:');
  });

  it('does NOT show foreshadowing resolution rate for HIATUS works', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      completionStatus: 'HIATUS',
      structure: structureWithForeshadowing,
    }));
    expect(prompt).not.toContain('回収率:');
  });

  it('shows ongoing-note in foreshadowing section for ONGOING works', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      completionStatus: 'ONGOING',
      structure: structureWithForeshadowing,
    }));
    expect(prompt).toContain('連載中のため未回収の伏線は今後の展開で回収される可能性があります');
  });

  it('shows planted and resolved counts for both COMPLETED and ONGOING', () => {
    const promptCompleted = buildScoringUserPrompt(makeInput({
      completionStatus: 'COMPLETED',
      structure: structureWithForeshadowing,
    }));
    const promptOngoing = buildScoringUserPrompt(makeInput({
      completionStatus: 'ONGOING',
      structure: structureWithForeshadowing,
    }));

    expect(promptCompleted).toContain('設置された伏線の数: 10件');
    expect(promptCompleted).toContain('回収された伏線の数: 8件');
    expect(promptOngoing).toContain('設置された伏線の数: 10件');
    expect(promptOngoing).toContain('回収された伏線の数: 8件');
  });

  it('lists unresolved foreshadowings (up to 5)', () => {
    const manyUnresolved = makeStructure({
      totalForeshadowingsPlanted: 10,
      totalForeshadowingsResolved: 3,
      foreshadowingResolutionRate: 0.3,
      unresolvedForeshadowings: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    });
    const prompt = buildScoringUserPrompt(makeInput({
      completionStatus: 'COMPLETED',
      structure: manyUnresolved,
    }));

    expect(prompt).toContain('- A');
    expect(prompt).toContain('- E');
    // F and G should be summarized in "他N件" not listed
    expect(prompt).not.toContain('- F');
    expect(prompt).toContain('（他2件）');
  });

  it('does not show foreshadowing section when totalForeshadowingsPlanted is 0', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({ totalForeshadowingsPlanted: 0 }),
    }));
    expect(prompt).not.toContain('伏線の分析');
  });
});

// ─────────────────────────────────────────────────────────
// EPISODE LENGTH VARIANCE → HUMAN-READABLE TEXT
// ─────────────────────────────────────────────────────────

describe('buildScoringUserPrompt - episodeLengthVariance human-readable conversion', () => {
  it('does NOT mention variance when stdDev <= avgEpisodeLength', () => {
    // avgEpisodeLength=1000, variance such that stdDev = 1000 (exactly at boundary, not >)
    // stdDev = sqrt(1000^2) = 1000, threshold is stdDev > avg * 1.0 (strictly greater)
    const metrics = makeMetrics({
      avgEpisodeLength: 1000,
      episodeLengthVariance: 1000 * 1000, // stdDev = 1000 = avg * 1.0 → NOT > threshold
    });
    const prompt = buildScoringUserPrompt(makeInput({ metrics }));
    expect(prompt).not.toContain('かなり大きな差がある');
  });

  it('does NOT mention variance when stdDev is well below avgEpisodeLength', () => {
    // avgEpisodeLength=1000, variance such that stdDev = 200 (20% of avg)
    const metrics = makeMetrics({
      avgEpisodeLength: 1000,
      episodeLengthVariance: 200 * 200, // stdDev = 200
    });
    const prompt = buildScoringUserPrompt(makeInput({ metrics }));
    expect(prompt).not.toContain('かなり大きな差がある');
  });

  it('mentions "かなり大きな差がある" when stdDev strictly exceeds avgEpisodeLength', () => {
    // avgEpisodeLength=1000, stdDev=1001 (> 1000 * 1.0)
    const metrics = makeMetrics({
      avgEpisodeLength: 1000,
      episodeLengthVariance: 1001 * 1001, // stdDev = 1001
    });
    const prompt = buildScoringUserPrompt(makeInput({ metrics }));
    expect(prompt).toContain('かなり大きな差がある');
  });

  it('includes variance description inside the 文体の定量分析 section', () => {
    const metrics = makeMetrics({
      avgEpisodeLength: 500,
      episodeLengthVariance: 600 * 600, // stdDev=600 > 500
    });
    const prompt = buildScoringUserPrompt(makeInput({ metrics }));
    // The variance desc should appear near the avgEpisodeLength line
    expect(prompt).toContain('各話の文字数にかなり大きな差がある');
  });

  it('variance description is in parentheses after the avgEpisodeLength line', () => {
    const metrics = makeMetrics({
      avgEpisodeLength: 200,
      episodeLengthVariance: 300 * 300, // stdDev=300 > 200
    });
    const prompt = buildScoringUserPrompt(makeInput({ metrics }));
    // The line should be: "一話あたりの平均文字数: 200文字（各話の文字数にかなり大きな差がある）"
    expect(prompt).toContain('一話あたりの平均文字数: 200文字（各話の文字数にかなり大きな差がある）');
  });

  it('no parentheses appended when variance is normal', () => {
    const metrics = makeMetrics({
      avgEpisodeLength: 1000,
      episodeLengthVariance: 100 * 100, // stdDev=100, well below avg
    });
    const prompt = buildScoringUserPrompt(makeInput({ metrics }));
    // Should just be "一話あたりの平均文字数: 1,000文字" without parenthetical
    // Note: toLocaleString() may not add commas in all Node environments, but let's check the pattern
    expect(prompt).toMatch(/一話あたりの平均文字数: [\d,]+文字\n/);
  });

  it('uses Math.round(sqrt(variance)) for stdDev comparison', () => {
    // avgEpisodeLength=1000
    // variance = 1000001 → sqrt = 1000.0005 → Math.round = 1000
    // 1000 > 1000 * 1.0 = 1000 → false (NOT strictly greater)
    const metrics = makeMetrics({
      avgEpisodeLength: 1000,
      episodeLengthVariance: 1000001,
    });
    const prompt = buildScoringUserPrompt(makeInput({ metrics }));
    // Math.round(sqrt(1000001)) = Math.round(1000.0005) = 1000
    // 1000 > 1000 → false → no variance desc
    expect(prompt).not.toContain('かなり大きな差がある');
  });

  it('shows variance note when variance rounds up enough to exceed average', () => {
    // avgEpisodeLength=1000
    // Need Math.round(sqrt(variance)) > 1000
    // sqrt(variance) >= 1000.5 → variance >= 1001001 (1000.5^2 = 1001000.25)
    const metrics = makeMetrics({
      avgEpisodeLength: 1000,
      episodeLengthVariance: 1002001, // sqrt = 1001.0 → Math.round = 1001 > 1000
    });
    const prompt = buildScoringUserPrompt(makeInput({ metrics }));
    expect(prompt).toContain('かなり大きな差がある');
  });
});

// ─────────────────────────────────────────────────────────
// LOW ANALYSIS COVERAGE WARNING
// ─────────────────────────────────────────────────────────

describe('buildScoringUserPrompt - analysis coverage warning', () => {
  it('does NOT include coverage warning when analysisCoverage is 1.0 (100%)', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({ analysisCoverage: 1.0 }),
    }));
    expect(prompt).not.toContain('構造分析は全');
  });

  it('includes coverage warning when analysisCoverage is less than 1.0', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({ analysisCoverage: 0.7 }),
    }));
    expect(prompt).toContain('構造分析は全');
  });

  it('shows the correct percentage in the coverage warning', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({ analysisCoverage: 0.7 }),
    }));
    expect(prompt).toContain('70%のみ完了しています');
  });

  it('shows the total episode count in coverage warning', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      metrics: makeMetrics({ episodeCount: 20 }),
      structure: makeStructure({ analysisCoverage: 0.5 }),
    }));
    expect(prompt).toContain('全20話のうち');
  });

  it('rounds coverage percentage correctly (e.g. 0.333 → 33%)', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({ analysisCoverage: 0.333 }),
    }));
    expect(prompt).toContain('33%のみ完了しています');
  });

  it('includes instruction to rely on text samples when coverage is low', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({ analysisCoverage: 0.4 }),
    }));
    expect(prompt).toContain('テキストサンプルを重視して評価してください');
  });
});

// ─────────────────────────────────────────────────────────
// EMOTION ARC WITH PARTIAL DATA
// ─────────────────────────────────────────────────────────

describe('buildScoringUserPrompt - emotion arc with partial data', () => {
  it('does not include emotion arc section when emotionalArcProgression is empty', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({ emotionalArcProgression: [] }),
    }));
    expect(prompt).not.toContain('各話の感情弧の推移');
  });

  it('includes emotion arc section when emotionalArcProgression has data', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({
        emotionalArcProgression: ['緊張', '解放', '喜び'],
      }),
    }));
    expect(prompt).toContain('各話の感情弧の推移');
  });

  it('shows "N話中M話分のデータです" note when arc data is fewer than total episodes', () => {
    // 10 episodes total, only 6 have arc data
    const prompt = buildScoringUserPrompt(makeInput({
      metrics: makeMetrics({ episodeCount: 10 }),
      structure: makeStructure({
        emotionalArcProgression: ['arc1', 'arc2', 'arc3', 'arc4', 'arc5', 'arc6'],
      }),
    }));
    expect(prompt).toContain('10話中6話分のデータです');
  });

  it('does NOT show partial data note when all episodes have arc data', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      metrics: makeMetrics({ episodeCount: 3 }),
      structure: makeStructure({
        emotionalArcProgression: ['arc1', 'arc2', 'arc3'],
      }),
    }));
    expect(prompt).not.toContain('話中');
  });

  it('numbers emotion arcs starting from 第1話', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({
        emotionalArcProgression: ['緊張感が高まる', '解放される'],
      }),
    }));
    expect(prompt).toContain('第1話: 緊張感が高まる');
    expect(prompt).toContain('第2話: 解放される');
  });

  it('partial data note instructs to infer from text samples', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      metrics: makeMetrics({ episodeCount: 10 }),
      structure: makeStructure({
        emotionalArcProgression: ['arc1', 'arc2'],
      }),
    }));
    expect(prompt).toContain('テキストサンプルから推測してください');
  });
});

// ─────────────────────────────────────────────────────────
// SECTION FORMATTING
// ─────────────────────────────────────────────────────────

describe('buildScoringUserPrompt - section formatting', () => {
  it('includes 作品概要 section with title', () => {
    const prompt = buildScoringUserPrompt(makeInput({ title: '異世界転生物語' }));
    expect(prompt).toContain('【作品概要】');
    expect(prompt).toContain('タイトル: 異世界転生物語');
  });

  it('shows genre when provided', () => {
    const prompt = buildScoringUserPrompt(makeInput({ genre: 'ミステリー' }));
    expect(prompt).toContain('ジャンル: ミステリー');
  });

  it('shows 不明 when genre is null', () => {
    const prompt = buildScoringUserPrompt(makeInput({ genre: null }));
    expect(prompt).toContain('ジャンル: 不明');
  });

  it('includes 文体の定量分析 section', () => {
    const prompt = buildScoringUserPrompt(makeInput());
    expect(prompt).toContain('【文体の定量分析】');
  });

  it('includes dialogue ratio as percentage in 文体の定量分析', () => {
    const metrics = makeMetrics({ dialogueRatio: 0.35, dialogueLineCount: 50, avgDialogueLength: 20 });
    const prompt = buildScoringUserPrompt(makeInput({ metrics }));
    expect(prompt).toContain('会話の占める割合: 35.0%');
  });

  it('includes all four text sample sections', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({
        textSamples: {
          opening: '冒頭テキスト',
          midpoint: '中盤テキスト',
          climaxRegion: 'クライマックステキスト',
          ending: '結末テキスト',
        },
      }),
    }));
    expect(prompt).toContain('【テキストサンプル: 冒頭】');
    expect(prompt).toContain('冒頭テキスト');
    expect(prompt).toContain('【テキストサンプル: 中盤】');
    expect(prompt).toContain('中盤テキスト');
    expect(prompt).toContain('【テキストサンプル: クライマックス付近】');
    expect(prompt).toContain('クライマックステキスト');
    expect(prompt).toContain('【テキストサンプル: 結末】');
    expect(prompt).toContain('結末テキスト');
  });

  it('separates sections with double newlines', () => {
    const prompt = buildScoringUserPrompt(makeInput());
    // sections.join('\n\n') means double newline between sections
    expect(prompt).toContain('\n\n【');
  });

  it('includes episode count and total char count in 作品概要', () => {
    const metrics = makeMetrics({ episodeCount: 15, totalCharCount: 75000 });
    const prompt = buildScoringUserPrompt(makeInput({ metrics }));
    expect(prompt).toContain('エピソード数: 15話');
    expect(prompt).toContain('総文字数:');
    expect(prompt).toContain('75,000文字');
  });

  it('does not include 各話の要約 section when episodeSummaries is empty', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({ episodeSummaries: [] }),
    }));
    expect(prompt).not.toContain('各話の要約');
  });

  it('includes 各話の要約 section when summaries are provided', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({
        episodeSummaries: [
          { order: 0, title: '始まり', summary: '主人公が旅に出る' },
          { order: 1, title: '出会い', summary: '仲間と出会う' },
        ],
      }),
    }));
    expect(prompt).toContain('【各話の要約】');
    expect(prompt).toContain('第1話「始まり」: 主人公が旅に出る');
    expect(prompt).toContain('第2話「出会い」: 仲間と出会う');
  });

  it('includes 語りの視点 section when narrativePOV is provided', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({ narrativePOV: '一人称（主人公視点）', povConsistency: true }),
    }));
    expect(prompt).toContain('【語りの視点】一人称（主人公視点）');
    expect(prompt).toContain('全編を通じて統一');
  });

  it('shows POV change notice when povConsistency is false', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({ narrativePOV: '三人称', povConsistency: false }),
    }));
    expect(prompt).toContain('途中で視点の変化あり');
  });

  it('does not include POV section when narrativePOV is null', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({ narrativePOV: null }),
    }));
    expect(prompt).not.toContain('語りの視点');
  });

  it('includes キャラクター別セリフサンプル section with character name and lines', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({
        characterCount: 2,
        characterVoiceConsistency: [
          { name: '太郎', samples: ['「俺は行く」', '「絶対に諦めない」'] },
          { name: '花子', samples: ['「お願い、止まって」'] },
        ],
      }),
    }));
    expect(prompt).toContain('キャラクター別セリフサンプル');
    expect(prompt).toContain('太郎:');
    expect(prompt).toContain('「俺は行く」');
    expect(prompt).toContain('花子:');
  });

  it('limits キャラクター別セリフサンプル to first 8 characters', () => {
    const manyChars = Array.from({ length: 10 }, (_, i) => ({
      name: `キャラ${i + 1}`,
      samples: [`「セリフ${i + 1}」`],
    }));
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({
        characterCount: 10,
        characterVoiceConsistency: manyChars,
      }),
    }));
    expect(prompt).toContain('キャラ8:');
    expect(prompt).not.toContain('キャラ9:');
    expect(prompt).not.toContain('キャラ10:');
  });

  it('includes world setting section when worldSettingCategories is provided', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({
        worldSettingCategories: [
          { category: '地理', count: 5 },
          { category: '魔法', count: 3 },
        ],
        worldSettingDetails: ['大陸の南には砂漠が広がる', '魔法は詠唱によって発動する'],
      }),
    }));
    expect(prompt).toContain('【世界設定】');
    expect(prompt).toContain('地理（5件）');
    expect(prompt).toContain('魔法（3件）');
    expect(prompt).toContain('大陸の南には砂漠が広がる');
  });

  it('does not include world setting section when categories is empty', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({ worldSettingCategories: [] }),
    }));
    expect(prompt).not.toContain('世界設定');
  });

  it('includes 作者による設計データ section when hasDesignData is true', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({
        hasDesignData: true,
        designedPremise: '異世界に転生した主人公が世界を救う',
        designedConflict: '魔王との最終決戦',
        designedThemes: ['友情', '成長'],
        designedCharacterCount: 5,
      }),
    }));
    expect(prompt).toContain('【作者による設計データ】');
    expect(prompt).toContain('作品の前提: 異世界に転生した主人公が世界を救う');
    expect(prompt).toContain('中心的な葛藤: 魔王との最終決戦');
    expect(prompt).toContain('テーマ: 友情、成長');
    expect(prompt).toContain('設計されたキャラクター数: 5名');
  });

  it('does not include 作者による設計データ when hasDesignData is false', () => {
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({ hasDesignData: false }),
    }));
    expect(prompt).not.toContain('作者による設計データ');
  });
});

// ─────────────────────────────────────────────────────────
// SHORT SENTENCE RATIO AND LONG SENTENCE RATIO IN PROMPT
// ─────────────────────────────────────────────────────────

describe('buildScoringUserPrompt - sentence ratio formatting', () => {
  it('formats short and long sentence ratios as percentages in prompt', () => {
    const metrics = makeMetrics({ shortSentenceRatio: 0.25, longSentenceRatio: 0.08 });
    const prompt = buildScoringUserPrompt(makeInput({ metrics }));
    expect(prompt).toContain('短い文の割合: 25.0%');
    expect(prompt).toContain('長い文の割合: 8.0%');
  });

  it('shows avg sentence length in prompt', () => {
    const metrics = makeMetrics({ avgSentenceLength: 32.5 });
    const prompt = buildScoringUserPrompt(makeInput({ metrics }));
    expect(prompt).toContain('一文あたりの平均文字数: 32.5文字');
  });
});

// ─────────────────────────────────────────────────────────
// SCENE BREAK AND PARAGRAPH METRICS IN PROMPT
// ─────────────────────────────────────────────────────────

describe('buildScoringUserPrompt - structural metrics in prompt', () => {
  it('includes scene break count in prompt', () => {
    const metrics = makeMetrics({ sceneBreakCount: 12 });
    const prompt = buildScoringUserPrompt(makeInput({ metrics }));
    expect(prompt).toContain('場面転換の回数: 12回');
  });

  it('includes paragraph count and avg paragraph length', () => {
    const metrics = makeMetrics({ paragraphCount: 200, avgParagraphLength: 75 });
    const prompt = buildScoringUserPrompt(makeInput({ metrics }));
    expect(prompt).toContain('段落の総数: 200');
    expect(prompt).toContain('一段落あたりの平均文字数: 75文字');
  });
});

// ─────────────────────────────────────────────────────────
// RETURN TYPE AND OVERALL SHAPE
// ─────────────────────────────────────────────────────────

describe('buildScoringUserPrompt - return type', () => {
  it('returns a non-empty string', () => {
    const prompt = buildScoringUserPrompt(makeInput());
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('does not expose raw variable names (no camelCase metric names)', () => {
    const prompt = buildScoringUserPrompt(makeInput());
    // Variable names from ProgrammaticMetrics/StructuralProfile must not appear
    expect(prompt).not.toContain('dialogueRatio');
    expect(prompt).not.toContain('sentenceLengthVariance');
    expect(prompt).not.toContain('vocabularyRichness');
    expect(prompt).not.toContain('analysisCoverage');
    expect(prompt).not.toContain('episodeLengthVariance');
    expect(prompt).not.toContain('shortSentenceRatio');
    expect(prompt).not.toContain('longSentenceRatio');
  });

  it('does not expose English scoring axis names', () => {
    const prompt = buildScoringUserPrompt(makeInput());
    expect(prompt).not.toContain('immersion');
    expect(prompt).not.toContain('transformation');
    expect(prompt).not.toContain('virality');
    expect(prompt).not.toContain('worldBuilding');
    expect(prompt).not.toContain('characterDepth');
    expect(prompt).not.toContain('structuralScore');
  });

  it('always includes all four text samples regardless of other options', () => {
    // Even with minimal structure data, text samples should always appear
    const prompt = buildScoringUserPrompt(makeInput({
      structure: makeStructure({
        episodeSummaries: [],
        emotionalArcProgression: [],
        narrativePOV: null,
        totalForeshadowingsPlanted: 0,
        characterVoiceConsistency: [],
        worldSettingCategories: [],
        hasDesignData: false,
      }),
    }));
    expect(prompt).toContain('【テキストサンプル: 冒頭】');
    expect(prompt).toContain('【テキストサンプル: 中盤】');
    expect(prompt).toContain('【テキストサンプル: クライマックス付近】');
    expect(prompt).toContain('【テキストサンプル: 結末】');
  });
});

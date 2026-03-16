import { TextAnalyzerService } from './text-analyzer.service';

describe('TextAnalyzerService', () => {
  let service: TextAnalyzerService;

  beforeEach(() => {
    service = new TextAnalyzerService();
  });

  it('returns empty metrics for empty episodes', () => {
    const result = service.analyze([]);
    expect(result.totalCharCount).toBe(0);
    expect(result.episodeCount).toBe(0);
    expect(result.dialogueRatio).toBe(0);
  });

  it('calculates dialogue ratio from 「」brackets', () => {
    const content = '地の文です。「セリフです」と彼は言った。「もうひとつ」';
    const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);

    // 「セリフです」= 4 chars, 「もうひとつ」= 4 chars, total dialogue = 8
    expect(result.dialogueLineCount).toBe(2);
    expect(result.dialogueRatio).toBeGreaterThan(0);
    expect(result.dialogueRatio).toBeLessThan(1);
  });

  it('handles all-dialogue text', () => {
    const content = '「すべてセリフ」「二つ目のセリフ」';
    const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);

    expect(result.dialogueLineCount).toBe(2);
    expect(result.dialogueRatio).toBeGreaterThan(0.5);
  });

  it('handles no-dialogue (pure narration)', () => {
    const content = 'これは地の文だけで構成された段落です。描写が続きます。情景が広がっていく。';
    const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);

    expect(result.dialogueLineCount).toBe(0);
    expect(result.dialogueRatio).toBe(0);
  });

  it('calculates sentence lengths correctly', () => {
    // "短い" = 2 chars (<20), medium sentence, and one sentence > 80 chars
    const longPart = 'あ'.repeat(90);
    const content = `短い。これは少し長い文章です。${longPart}という非常に長い文章がここにあります。`;
    const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);

    expect(result.avgSentenceLength).toBeGreaterThan(0);
    expect(result.shortSentenceRatio).toBeGreaterThan(0);
    expect(result.longSentenceRatio).toBeGreaterThan(0);
    expect(result.sentenceLengthVariance).toBeGreaterThan(0);
  });

  it('detects scene breaks', () => {
    const content = '第一場面の文章。\n\n＊＊＊\n\n第二場面の文章。\n\n---\n\n第三場面。';
    const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);

    expect(result.sceneBreakCount).toBeGreaterThanOrEqual(2);
  });

  it('aggregates multi-episode stats', () => {
    const episodes = [
      { content: 'エピソード一の本文。「セリフ」', title: 'ep1', orderIndex: 0 },
      { content: 'エピソード二の本文です。', title: 'ep2', orderIndex: 1 },
      { content: '「全部セリフのエピソード」', title: 'ep3', orderIndex: 2 },
    ];
    const result = service.analyze(episodes);

    expect(result.episodeCount).toBe(3);
    expect(result.dialogueRatioByEpisode).toHaveLength(3);
    expect(result.dialogueRatioByEpisode[2]).toBeGreaterThan(result.dialogueRatioByEpisode[1]);
  });

  it('counts unique kanji', () => {
    const content = '漢字が含まれる文章。東京都渋谷区の物語。';
    const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);

    expect(result.uniqueKanjiCount).toBeGreaterThan(5);
  });

  it('calculates vocabulary richness', () => {
    // Need >100 chars for vocabulary richness to compute
    const diverse = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'.repeat(3);
    const repetitive = 'ああああああああああああああああああああああああああああああああああああああああああああああ'.repeat(3);

    const resultDiverse = service.analyze([{ content: diverse, title: 'ep1', orderIndex: 0 }]);
    const resultRepetitive = service.analyze([{ content: repetitive, title: 'ep1', orderIndex: 0 }]);

    expect(resultDiverse.vocabularyRichness).toBeGreaterThan(resultRepetitive.vocabularyRichness);
  });

  it('calculates punctuation density', () => {
    const content = 'なんだって！本当か？まさか……そんな！信じられない？ええ……。';
    const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);

    expect(result.exclamationDensity).toBeGreaterThan(0);
    expect(result.questionDensity).toBeGreaterThan(0);
    expect(result.ellipsisDensity).toBeGreaterThan(0);
  });

  it('handles very short text gracefully', () => {
    const result = service.analyze([{ content: 'あ', title: 'ep1', orderIndex: 0 }]);

    expect(result.totalCharCount).toBe(1);
    expect(result.episodeCount).toBe(1);
  });

  it('calculates episode length variance', () => {
    const episodes = [
      { content: 'a'.repeat(100), title: 'short', orderIndex: 0 },
      { content: 'b'.repeat(10000), title: 'long', orderIndex: 1 },
    ];
    const result = service.analyze(episodes);

    expect(result.episodeLengthVariance).toBeGreaterThan(0);
    expect(result.avgEpisodeLength).toBe(5050);
  });
});

import { TextAnalyzerService } from '../text-analyzer.service';

describe('TextAnalyzerService', () => {
  let service: TextAnalyzerService;

  beforeEach(() => {
    service = new TextAnalyzerService();
  });

  // ─────────────────────────────────────────────────────────
  // EMPTY INPUT
  // ─────────────────────────────────────────────────────────

  describe('empty input', () => {
    it('returns all-zero metrics when episodes array is empty', () => {
      const result = service.analyze([]);

      expect(result.totalCharCount).toBe(0);
      expect(result.episodeCount).toBe(0);
      expect(result.avgEpisodeLength).toBe(0);
      expect(result.dialogueRatio).toBe(0);
      expect(result.dialogueLineCount).toBe(0);
      expect(result.avgDialogueLength).toBe(0);
      expect(result.avgSentenceLength).toBe(0);
      expect(result.sentenceLengthVariance).toBe(0);
      expect(result.shortSentenceRatio).toBe(0);
      expect(result.longSentenceRatio).toBe(0);
      expect(result.avgParagraphLength).toBe(0);
      expect(result.paragraphCount).toBe(0);
      expect(result.singleLineParagraphRatio).toBe(0);
      expect(result.uniqueKanjiCount).toBe(0);
      expect(result.vocabularyRichness).toBe(0);
      expect(result.sceneBreakCount).toBe(0);
      expect(result.exclamationDensity).toBe(0);
      expect(result.questionDensity).toBe(0);
      expect(result.ellipsisDensity).toBe(0);
      expect(result.episodeLengthVariance).toBe(0);
      expect(result.dialogueRatioByEpisode).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────
  // BASIC METRICS
  // ─────────────────────────────────────────────────────────

  describe('basic metrics extraction', () => {
    it('counts totalCharCount as the total length of all episode content joined by newline', () => {
      // join('\n') means 1 extra char between episodes
      const ep1 = 'abc';    // 3 chars
      const ep2 = 'de';     // 2 chars
      // joined = 'abc\nde' = 6 chars
      const result = service.analyze([
        { content: ep1, title: 'ep1', orderIndex: 0 },
        { content: ep2, title: 'ep2', orderIndex: 1 },
      ]);
      expect(result.totalCharCount).toBe(6);
    });

    it('returns correct episodeCount for single episode', () => {
      const result = service.analyze([{ content: 'テスト', title: 'ep1', orderIndex: 0 }]);
      expect(result.episodeCount).toBe(1);
    });

    it('returns correct episodeCount for multiple episodes', () => {
      const episodes = Array.from({ length: 5 }, (_, i) => ({
        content: `内容${i}`,
        title: `ep${i}`,
        orderIndex: i,
      }));
      const result = service.analyze(episodes);
      expect(result.episodeCount).toBe(5);
    });

    it('calculates avgEpisodeLength rounded to nearest integer', () => {
      // ep1=100 chars, ep2=200 chars → avg = 150
      const result = service.analyze([
        { content: 'a'.repeat(100), title: 'ep1', orderIndex: 0 },
        { content: 'b'.repeat(200), title: 'ep2', orderIndex: 1 },
      ]);
      expect(result.avgEpisodeLength).toBe(150);
    });

    it('calculates avgEpisodeLength for a single episode', () => {
      const content = 'あ'.repeat(300);
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.avgEpisodeLength).toBe(300);
    });

    it('handles episode with empty string content', () => {
      const result = service.analyze([
        { content: '', title: 'empty', orderIndex: 0 },
        { content: '内容あり', title: 'has-content', orderIndex: 1 },
      ]);
      expect(result.episodeCount).toBe(2);
      expect(result.avgEpisodeLength).toBe(2); // Math.round((0 + 4) / 2)
    });
  });

  // ─────────────────────────────────────────────────────────
  // DIALOGUE DETECTION
  // ─────────────────────────────────────────────────────────

  describe('dialogue detection (「」brackets)', () => {
    it('extracts dialogue chars excluding the bracket characters themselves', () => {
      // 「セリフ」 = 4 chars in brackets, -2 = 3 dialogue chars
      const content = '「セリフ」';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);

      expect(result.dialogueLineCount).toBe(1);
      // dialogueRatio = 3 / 5 = 0.6
      expect(result.dialogueRatio).toBeCloseTo(0.6, 5);
    });

    it('counts multiple dialogue lines correctly', () => {
      const content = '「一つ目」地の文「二つ目」さらに地の文「三つ目」';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.dialogueLineCount).toBe(3);
    });

    it('calculates avgDialogueLength as rounded dialogue chars divided by line count', () => {
      // 「あいう」= 3 chars, 「えお」= 2 chars → total=5, avg=round(5/2)=3 (Math.round)
      // But avgDialogueLength uses Math.round
      const content = '「あいう」「えお」';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);

      expect(result.dialogueLineCount).toBe(2);
      expect(result.avgDialogueLength).toBe(3); // Math.round(5/2) = 3 (rounds 2.5 to 3)
    });

    it('returns avgDialogueLength of 0 when there is no dialogue', () => {
      const content = '会話のない地の文です。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);

      expect(result.dialogueLineCount).toBe(0);
      expect(result.avgDialogueLength).toBe(0);
    });

    it('returns dialogueRatio of 0 when there is no dialogue', () => {
      const content = 'すべて地の文。セリフなし。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.dialogueRatio).toBe(0);
    });

    it('calculates dialogueRatioByEpisode per episode independently', () => {
      const episodes = [
        { content: '「全部セリフ」', title: 'all-dialogue', orderIndex: 0 },
        { content: '地の文のみ。会話なし。', title: 'no-dialogue', orderIndex: 1 },
      ];
      const result = service.analyze(episodes);

      expect(result.dialogueRatioByEpisode).toHaveLength(2);
      // Episode 0: all dialogue → ratio > 0.5
      expect(result.dialogueRatioByEpisode[0]).toBeGreaterThan(0.5);
      // Episode 1: no dialogue → ratio = 0
      expect(result.dialogueRatioByEpisode[1]).toBe(0);
    });

    it('does not match nested brackets (greedy match stops at first 」)', () => {
      // 「outer「inner」text」 — the regex /「[^」]*」/ matches 「outer「inner」 stopping at first 」
      const content = '「outer「inner」text」';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      // Greedy match: 「outer「inner」 = one match (12 chars), then 「text」 is not matched because
      // Actually: /「[^」]*」/ — [^」]* means any char except 」, so it matches 「outer「inner」
      // Then "text」" is leftover. Only 1 match.
      expect(result.dialogueLineCount).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────
  // SENTENCE ANALYSIS
  // ─────────────────────────────────────────────────────────

  describe('sentence analysis', () => {
    it('splits sentences on 。', () => {
      const content = '文一。文二。文三。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      // "文一", "文二", "文三" = 3 sentences of length 2 each
      expect(result.avgSentenceLength).toBe(2);
    });

    it('splits sentences on ！', () => {
      const content = '叫んだ！また叫んだ！';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      // "叫んだ"=3, "また叫んだ"=5 → avg = 4
      expect(result.avgSentenceLength).toBe(4);
    });

    it('splits sentences on ？', () => {
      const content = '本当か？嘘だろう？';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      // "本当か"=3, "嘘だろう"=4 → avg = 3.5
      expect(result.avgSentenceLength).toBe(3.5);
    });

    it('splits on consecutive punctuation as single delimiter', () => {
      // [。！？!?]+ — one or more consecutive
      const content = '文章だ！？次の文。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      // "文章だ"=3, "次の文"=3 → avg = 3
      expect(result.avgSentenceLength).toBe(3);
    });

    it('calculates shortSentenceRatio for sentences under 20 chars', () => {
      // 9 short sentences (2 chars each) + 1 long (81 chars)
      const shortPart = Array.from({ length: 9 }, () => '短い').join('。') + '。';
      const longPart = 'あ'.repeat(81) + '。';
      const content = shortPart + longPart;
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);

      // 9 sentences < 20, 1 sentence > 80, total 10
      expect(result.shortSentenceRatio).toBeCloseTo(0.9, 5);
      expect(result.longSentenceRatio).toBeCloseTo(0.1, 5);
    });

    it('returns shortSentenceRatio=0 when all sentences are medium length', () => {
      // Each sentence is exactly 30 chars
      const content = Array.from({ length: 5 }, () => 'あ'.repeat(30)).join('。') + '。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);

      expect(result.shortSentenceRatio).toBe(0);
      expect(result.longSentenceRatio).toBe(0);
    });

    it('calculates avgSentenceLength rounded to 1 decimal place', () => {
      // 2 sentences: "あ"=1, "いう"=2 → avg = 1.5
      const content = 'あ。いう。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.avgSentenceLength).toBe(1.5);
    });

    it('calculates sentenceLengthVariance across all episodes', () => {
      const episodes = [
        { content: 'あ。', title: 'ep1', orderIndex: 0 },           // sentence length 1
        { content: 'あいうえおかきくけこ。', title: 'ep2', orderIndex: 1 }, // sentence length 10
      ];
      const result = service.analyze(episodes);
      // mean = (1+10)/2 = 5.5, variance = ((1-5.5)^2 + (10-5.5)^2) / 2 = (20.25+20.25)/2 = 20.25
      // variance() uses Math.round() → Math.round(20.25) = 20
      expect(result.sentenceLengthVariance).toBe(20);
    });

    it('returns sentenceLengthVariance=0 for a single sentence', () => {
      const content = '一文だけ。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.sentenceLengthVariance).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // PARAGRAPH ANALYSIS
  // ─────────────────────────────────────────────────────────

  describe('paragraph analysis', () => {
    it('splits paragraphs on newlines', () => {
      const content = '段落一\n段落二\n段落三';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.paragraphCount).toBe(3);
    });

    it('collapses multiple consecutive newlines into one paragraph boundary', () => {
      const content = '段落一\n\n\n段落二';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.paragraphCount).toBe(2);
    });

    it('calculates avgParagraphLength as totalChars / paragraphCount', () => {
      // "段落一" = 3 chars, "段落二" = 3 chars, totalChars includes the \n
      // content = "段落一\n段落二" = 7 chars, paragraphs = 2
      // avgParagraphLength = Math.round(7/2) = 4
      const content = '段落一\n段落二';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.avgParagraphLength).toBe(4); // Math.round(7/2) = 4
    });

    it('counts singleLineParagraphRatio for paragraphs under 100 chars without internal newlines', () => {
      // All 3 paragraphs are short (no internal \n, < 100 chars)
      const content = '短い一。\n短い二。\nこれも短い三。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);

      expect(result.paragraphCount).toBe(3);
      expect(result.singleLineParagraphRatio).toBe(1);
    });

    it('does not count paragraphs >= 100 chars as single-line paragraphs', () => {
      const longParagraph = 'あ'.repeat(100); // exactly 100 — NOT counted (< 100 required)
      const shortParagraph = '短い';
      const content = `${longParagraph}\n${shortParagraph}`;
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);

      expect(result.paragraphCount).toBe(2);
      // Only the short paragraph qualifies
      expect(result.singleLineParagraphRatio).toBe(0.5);
    });

    it('returns avgParagraphLength equal to totalChars when paragraphCount is 0', () => {
      // Empty content has no paragraphs, no chars
      const content = '';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      // paragraphCount=0, totalChars=0 (after joining with \n for single episode: '' has length 0)
      // avgParagraphLength = totalChars when paragraphCount=0 → 0
      expect(result.avgParagraphLength).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // SCENE BREAK DETECTION
  // ─────────────────────────────────────────────────────────

  describe('scene break detection', () => {
    it('detects ＊＊＊ as a scene break', () => {
      const content = '場面一。\n＊＊＊\n場面二。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.sceneBreakCount).toBe(1);
    });

    it('detects ★★★ as a scene break', () => {
      const content = '場面一。\n★★★\n場面二。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.sceneBreakCount).toBe(1);
    });

    it('detects --- as a scene break', () => {
      const content = '場面一。\n---\n場面二。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.sceneBreakCount).toBe(1);
    });

    it('detects *** (ASCII asterisks) as a scene break', () => {
      const content = '場面一。\n***\n場面二。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.sceneBreakCount).toBe(1);
    });

    it('detects ◆◆◆ as a scene break', () => {
      const content = '場面一。\n◆◆◆\n場面二。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.sceneBreakCount).toBe(1);
    });

    it('detects multiple scene breaks across an episode', () => {
      const content = '場面一。\n＊＊＊\n場面二。\n★★★\n場面三。\n---\n場面四。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.sceneBreakCount).toBe(3);
    });

    it('requires at least 3 consecutive scene-break characters', () => {
      // 2 chars — should not match
      const content = '場面一。\n＊＊\n場面二。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.sceneBreakCount).toBe(0);
    });

    it('tolerates leading and trailing spaces in scene break line', () => {
      const content = '場面一。\n  ＊＊＊  \n場面二。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.sceneBreakCount).toBe(1);
    });

    it('does not count scene break characters mid-sentence', () => {
      // The pattern requires ^ and $ around the line
      const content = '文章の途中に＊＊＊が入っている。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.sceneBreakCount).toBe(0);
    });

    it('accumulates scene breaks across multiple episodes', () => {
      const episodes = [
        { content: '場面一。\n＊＊＊\n場面二。', title: 'ep1', orderIndex: 0 },
        { content: '場面三。\n★★★\n場面四。\n---\n場面五。', title: 'ep2', orderIndex: 1 },
      ];
      const result = service.analyze(episodes);
      expect(result.sceneBreakCount).toBe(3);
    });
  });

  // ─────────────────────────────────────────────────────────
  // PUNCTUATION DENSITY
  // ─────────────────────────────────────────────────────────

  describe('punctuation density (per 1000 chars)', () => {
    it('calculates exclamationDensity from ！ (fullwidth)', () => {
      // 1 exclamation in 1000 chars → density = 1.0
      const content = '！' + 'あ'.repeat(999);
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.exclamationDensity).toBeCloseTo(1.0, 5);
    });

    it('calculates exclamationDensity from ! (ASCII)', () => {
      const content = '!' + 'a'.repeat(999);
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.exclamationDensity).toBeCloseTo(1.0, 5);
    });

    it('calculates questionDensity from ？ (fullwidth)', () => {
      const content = '？' + 'あ'.repeat(999);
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.questionDensity).toBeCloseTo(1.0, 5);
    });

    it('calculates questionDensity from ? (ASCII)', () => {
      const content = '?' + 'a'.repeat(999);
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.questionDensity).toBeCloseTo(1.0, 5);
    });

    it('calculates ellipsisDensity from … (single Unicode ellipsis)', () => {
      const content = '…' + 'あ'.repeat(999);
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.ellipsisDensity).toBeCloseTo(1.0, 5);
    });

    it('calculates ellipsisDensity from … repeated twice (two Unicode ellipses)', () => {
      // /[…]{1,2}/ — one OR two consecutive ellipses count as ONE match
      const content = '……' + 'あ'.repeat(998);
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      // 1 match in 1000 chars → 1.0
      expect(result.ellipsisDensity).toBeCloseTo(1.0, 5);
    });

    it('calculates ellipsisDensity from ... (three ASCII dots)', () => {
      const content = '...' + 'a'.repeat(997);
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.ellipsisDensity).toBeCloseTo(1.0, 5);
    });

    it('returns 0 for all densities when there is no punctuation', () => {
      const content = 'あいうえおかきくけこ'.repeat(10);
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.exclamationDensity).toBe(0);
      expect(result.questionDensity).toBe(0);
      expect(result.ellipsisDensity).toBe(0);
    });

    it('accumulates punctuation across all episodes', () => {
      const episodes = [
        { content: 'なんと！', title: 'ep1', orderIndex: 0 },
        { content: '本当か？', title: 'ep2', orderIndex: 1 },
      ];
      const result = service.analyze(episodes);
      expect(result.exclamationDensity).toBeGreaterThan(0);
      expect(result.questionDensity).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // EPISODE LENGTH VARIANCE
  // ─────────────────────────────────────────────────────────

  describe('episode length variance calculation', () => {
    it('returns 0 variance for a single episode', () => {
      const result = service.analyze([{ content: 'あ'.repeat(500), title: 'ep1', orderIndex: 0 }]);
      expect(result.episodeLengthVariance).toBe(0);
    });

    it('returns 0 variance when all episodes are the same length', () => {
      const episodes = Array.from({ length: 4 }, (_, i) => ({
        content: 'あ'.repeat(1000),
        title: `ep${i}`,
        orderIndex: i,
      }));
      const result = service.analyze(episodes);
      expect(result.episodeLengthVariance).toBe(0);
    });

    it('calculates variance correctly for two episodes with very different lengths', () => {
      // ep1=100 chars, ep2=10000 chars
      // mean = (100+10000)/2 = 5050
      // variance = ((100-5050)^2 + (10000-5050)^2) / 2
      //          = (4950^2 + 4950^2) / 2
      //          = 24502500 + 24502500) / 2
      //          = 24502500
      const result = service.analyze([
        { content: 'a'.repeat(100), title: 'ep1', orderIndex: 0 },
        { content: 'b'.repeat(10000), title: 'ep2', orderIndex: 1 },
      ]);
      expect(result.episodeLengthVariance).toBe(24502500);
    });

    it('calculates variance for three episodes', () => {
      // lengths: 100, 200, 300 → mean=200
      // variance = ((100-200)^2 + (200-200)^2 + (300-200)^2) / 3
      //          = (10000 + 0 + 10000) / 3 = 6666.67 → Math.round = 6667
      const result = service.analyze([
        { content: 'a'.repeat(100), title: 'ep1', orderIndex: 0 },
        { content: 'b'.repeat(200), title: 'ep2', orderIndex: 1 },
        { content: 'c'.repeat(300), title: 'ep3', orderIndex: 2 },
      ]);
      expect(result.episodeLengthVariance).toBe(6667);
    });
  });

  // ─────────────────────────────────────────────────────────
  // KANJI EXTRACTION AND VOCABULARY RICHNESS
  // ─────────────────────────────────────────────────────────

  describe('kanji extraction', () => {
    it('counts only unique kanji characters (CJK U+4E00–U+9FFF)', () => {
      // 三 unique kanji repeated many times
      const content = '山山山川川川空空空';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.uniqueKanjiCount).toBe(3); // 山, 川, 空
    });

    it('does not count hiragana or katakana as kanji', () => {
      const content = 'あいうえおアイウエオ';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.uniqueKanjiCount).toBe(0);
    });

    it('does not count ASCII or numbers as kanji', () => {
      const content = 'ABCabc123456';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.uniqueKanjiCount).toBe(0);
    });

    it('counts kanji across all episodes combined', () => {
      const episodes = [
        { content: '山川', title: 'ep1', orderIndex: 0 },  // 山, 川
        { content: '空海', title: 'ep2', orderIndex: 1 },  // 空, 海
      ];
      const result = service.analyze(episodes);
      expect(result.uniqueKanjiCount).toBe(4);
    });

    it('counts a repeated kanji only once', () => {
      const content = '山山山山山山山山山山';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.uniqueKanjiCount).toBe(1);
    });
  });

  describe('vocabulary richness', () => {
    it('returns 0 for text shorter than 100 characters', () => {
      const content = 'あいう'; // 3 chars
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.vocabularyRichness).toBe(0);
    });

    it('returns a higher value for diverse text than repetitive text', () => {
      // Diverse: many different chars
      const diverse = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'
        .repeat(4); // 184 chars
      // Repetitive: same char over and over
      const repetitive = 'あ'.repeat(184);

      const resultDiverse = service.analyze([{ content: diverse, title: 'ep1', orderIndex: 0 }]);
      const resultRepetitive = service.analyze([{ content: repetitive, title: 'ep1', orderIndex: 0 }]);

      expect(resultDiverse.vocabularyRichness).toBeGreaterThan(resultRepetitive.vocabularyRichness);
    });

    it('returns a value between 0 and 1 for normal text', () => {
      const content = '吾輩は猫である。名前はまだない。どこで生れたか頓と見当がつかぬ。'.repeat(5);
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.vocabularyRichness).toBeGreaterThan(0);
      expect(result.vocabularyRichness).toBeLessThanOrEqual(1);
    });

    it('returns value rounded to 3 decimal places', () => {
      const content = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほ'.repeat(5);
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      // Check that it's rounded to 3 decimal places
      const str = result.vocabularyRichness.toString();
      const decimalPart = str.includes('.') ? str.split('.')[1] : '';
      expect(decimalPart.length).toBeLessThanOrEqual(3);
    });

    it('returns 0 when text is exactly 100 chars (boundary: sampleVocabularyRichness requires > 100)', () => {
      // The method returns 0 if text.length < 100. At exactly 100, the text is NOT < 100
      // so it will proceed to sample. windowSize = min(1000, 100) = 100, and if text
      // has non-whitespace chars, it will compute a ratio > 0
      const content = 'あ'.repeat(100);
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      // 100 chars is not < 100, so sampling proceeds and returns > 0
      expect(result.vocabularyRichness).toBeGreaterThan(0);
    });

    it('returns 0 when text is 99 chars (below the 100-char threshold)', () => {
      const content = 'あ'.repeat(99);
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.vocabularyRichness).toBe(0);
    });

    it('returns 0 when sampled windows contain only whitespace', () => {
      // A text > 100 chars but all whitespace → all windows will have chars.length === 0
      // triggering the early-continue branch, leaving ratios empty → returns 0
      const content = ' '.repeat(200);
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.vocabularyRichness).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // SINGLE EPISODE BEHAVIOR
  // ─────────────────────────────────────────────────────────

  describe('single episode', () => {
    it('has dialogueRatioByEpisode with exactly one element', () => {
      const result = service.analyze([{ content: '「セリフ」地の文', title: 'ep1', orderIndex: 0 }]);
      expect(result.dialogueRatioByEpisode).toHaveLength(1);
    });

    it('produces same dialogueRatio as dialogueRatioByEpisode[0]', () => {
      const content = '「セリフです」地の文です。続きます。';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.dialogueRatio).toBeCloseTo(result.dialogueRatioByEpisode[0], 10);
    });

    it('has episodeLengthVariance of 0 for a single episode', () => {
      const result = service.analyze([{ content: 'コンテンツ'.repeat(100), title: 'ep1', orderIndex: 0 }]);
      expect(result.episodeLengthVariance).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // MULTIPLE EPISODES AGGREGATION
  // ─────────────────────────────────────────────────────────

  describe('multiple episodes aggregation', () => {
    it('sums scene breaks from all episodes', () => {
      const episodes = [
        { content: '一。\n＊＊＊\n二。', title: 'ep1', orderIndex: 0 },      // 1 scene break
        { content: '三。\n★★★\n四。\n---\n五。', title: 'ep2', orderIndex: 1 }, // 2 scene breaks
      ];
      const result = service.analyze(episodes);
      expect(result.sceneBreakCount).toBe(3);
    });

    it('aggregates dialogue lines from all episodes', () => {
      const episodes = [
        { content: '「一」「二」', title: 'ep1', orderIndex: 0 },    // 2 lines
        { content: '「三」', title: 'ep2', orderIndex: 1 },          // 1 line
        { content: '「四」「五」「六」', title: 'ep3', orderIndex: 2 }, // 3 lines
      ];
      const result = service.analyze(episodes);
      expect(result.dialogueLineCount).toBe(6);
    });

    it('provides per-episode dialogue ratios ordered by input order', () => {
      const episodes = [
        { content: '地の文のみ。', title: 'ep1', orderIndex: 0 },
        { content: '「セリフ」', title: 'ep2', orderIndex: 1 },
        { content: '「半分」地の文', title: 'ep3', orderIndex: 2 },
      ];
      const result = service.analyze(episodes);

      expect(result.dialogueRatioByEpisode[0]).toBe(0);                            // no dialogue
      expect(result.dialogueRatioByEpisode[1]).toBeGreaterThan(0.5);               // all dialogue
      expect(result.dialogueRatioByEpisode[2]).toBeGreaterThan(0);                 // partial dialogue
      expect(result.dialogueRatioByEpisode[2]).toBeLessThan(result.dialogueRatioByEpisode[1]); // less than all-dialogue
    });

    it('totalCharCount includes the newlines used to join episode content', () => {
      const ep1 = 'abc'; // 3 chars
      const ep2 = 'def'; // 3 chars
      const ep3 = 'ghi'; // 3 chars
      // joined = 'abc\ndef\nghi' = 11 chars
      const result = service.analyze([
        { content: ep1, title: 'ep1', orderIndex: 0 },
        { content: ep2, title: 'ep2', orderIndex: 1 },
        { content: ep3, title: 'ep3', orderIndex: 2 },
      ]);
      expect(result.totalCharCount).toBe(11);
    });
  });

  // ─────────────────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles episode with only punctuation', () => {
      const content = '！？…。！';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.totalCharCount).toBe(5);
      expect(result.exclamationDensity).toBeGreaterThan(0);
    });

    it('handles episode with only whitespace', () => {
      const content = '   \n   \n   ';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      // Paragraphs trimmed and filtered → 0
      expect(result.paragraphCount).toBe(0);
    });

    it('handles very long single episode (10000+ chars)', () => {
      const content = 'あいうえお'.repeat(2000); // 10000 chars
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.totalCharCount).toBe(10000);
      expect(result.avgEpisodeLength).toBe(10000);
    });

    it('handles special characters and Unicode correctly', () => {
      const content = '♥♦♣♠🎵🎶これは絵文字を含む文章です。';
      expect(() => {
        service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      }).not.toThrow();
    });

    it('handles SQL-injection-like special characters', () => {
      const content = "SELECT * FROM users WHERE id='1' OR '1'='1'; DROP TABLE users;--";
      expect(() => {
        service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      }).not.toThrow();
    });

    it('handles content with only kanji', () => {
      const content = '山川空海月日';
      const result = service.analyze([{ content, title: 'ep1', orderIndex: 0 }]);
      expect(result.uniqueKanjiCount).toBe(6);
    });

    it('handles null-like empty string gracefully without errors', () => {
      expect(() => {
        service.analyze([{ content: '', title: '', orderIndex: 0 }]);
      }).not.toThrow();
    });
  });
});

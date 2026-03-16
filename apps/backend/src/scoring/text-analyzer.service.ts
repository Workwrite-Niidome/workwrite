import { Injectable } from '@nestjs/common';
import { ProgrammaticMetrics } from './types';

interface EpisodeInput {
  content: string;
  title: string;
  orderIndex: number;
}

@Injectable()
export class TextAnalyzerService {
  analyze(episodes: EpisodeInput[]): ProgrammaticMetrics {
    if (episodes.length === 0) {
      return this.emptyMetrics();
    }

    const episodeStats = episodes.map((ep) => this.analyzeEpisode(ep.content));
    const allText = episodes.map((ep) => ep.content).join('\n');
    const totalChars = allText.length;

    // Aggregate episode-level stats
    const totalDialogueChars = episodeStats.reduce((s, e) => s + e.dialogueChars, 0);
    const totalDialogueLines = episodeStats.reduce((s, e) => s + e.dialogueLineCount, 0);
    const totalSentences = episodeStats.reduce((s, e) => s + e.sentenceCount, 0);
    const totalParagraphs = episodeStats.reduce((s, e) => s + e.paragraphCount, 0);
    const totalSingleLineParagraphs = episodeStats.reduce((s, e) => s + e.singleLineParagraphs, 0);
    const totalSceneBreaks = episodeStats.reduce((s, e) => s + e.sceneBreaks, 0);

    // Sentence lengths
    const allSentenceLengths = episodeStats.flatMap((e) => e.sentenceLengths);
    const avgSentenceLength =
      allSentenceLengths.length > 0
        ? allSentenceLengths.reduce((a, b) => a + b, 0) / allSentenceLengths.length
        : 0;
    const sentenceLengthVariance = this.variance(allSentenceLengths, avgSentenceLength);
    const shortCount = allSentenceLengths.filter((l) => l < 20).length;
    const longCount = allSentenceLengths.filter((l) => l > 80).length;

    // Episode lengths
    const episodeLengths = episodeStats.map((e) => e.charCount);
    const avgEpisodeLength =
      episodeLengths.length > 0
        ? episodeLengths.reduce((a, b) => a + b, 0) / episodeLengths.length
        : 0;

    // Vocabulary (sampled)
    const kanjiSet = this.extractKanji(allText);
    const vocabularyRichness = this.sampleVocabularyRichness(allText);

    // Punctuation density
    const exclamations = (allText.match(/[！!]/g) || []).length;
    const questions = (allText.match(/[？?]/g) || []).length;
    const ellipses = (allText.match(/[…]{1,2}|\.{3,}/g) || []).length;

    // Dialogue ratio per episode
    const dialogueRatioByEpisode = episodeStats.map((e) =>
      e.charCount > 0 ? e.dialogueChars / e.charCount : 0,
    );

    return {
      totalCharCount: totalChars,
      episodeCount: episodes.length,
      avgEpisodeLength: Math.round(avgEpisodeLength),

      dialogueRatio: totalChars > 0 ? totalDialogueChars / totalChars : 0,
      dialogueLineCount: totalDialogueLines,
      avgDialogueLength:
        totalDialogueLines > 0 ? Math.round(totalDialogueChars / totalDialogueLines) : 0,

      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      sentenceLengthVariance: Math.round(sentenceLengthVariance * 10) / 10,
      shortSentenceRatio:
        allSentenceLengths.length > 0 ? shortCount / allSentenceLengths.length : 0,
      longSentenceRatio:
        allSentenceLengths.length > 0 ? longCount / allSentenceLengths.length : 0,

      avgParagraphLength:
        totalParagraphs > 0 ? Math.round(totalChars / totalParagraphs) : totalChars,
      paragraphCount: totalParagraphs,
      singleLineParagraphRatio:
        totalParagraphs > 0 ? totalSingleLineParagraphs / totalParagraphs : 0,

      uniqueKanjiCount: kanjiSet.size,
      vocabularyRichness,

      sceneBreakCount: totalSceneBreaks,

      exclamationDensity: totalChars > 0 ? (exclamations / totalChars) * 1000 : 0,
      questionDensity: totalChars > 0 ? (questions / totalChars) * 1000 : 0,
      ellipsisDensity: totalChars > 0 ? (ellipses / totalChars) * 1000 : 0,

      episodeLengthVariance: this.variance(episodeLengths, avgEpisodeLength),
      dialogueRatioByEpisode,
    };
  }

  private analyzeEpisode(content: string) {
    const charCount = content.length;

    // Dialogue: text inside 「」
    const dialogueMatches = content.match(/「[^」]*」/g) || [];
    const dialogueChars = dialogueMatches.reduce((s, m) => s + m.length - 2, 0); // exclude brackets
    const dialogueLineCount = dialogueMatches.length;

    // Sentences: split on 。！？
    const sentences = content
      .split(/[。！？!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const sentenceLengths = sentences.map((s) => s.length);

    // Paragraphs: split on newlines
    const paragraphs = content
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const singleLineParagraphs = paragraphs.filter(
      (p) => !p.includes('\n') && p.length < 100,
    ).length;

    // Scene breaks
    const sceneBreakPattern = /^[\s　]*[＊\*\-－﹣☆★◆◇●○]{3,}[\s　]*$/gm;
    const sceneBreaks = (content.match(sceneBreakPattern) || []).length;

    return {
      charCount,
      dialogueChars,
      dialogueLineCount,
      sentenceCount: sentences.length,
      sentenceLengths,
      paragraphCount: paragraphs.length,
      singleLineParagraphs,
      sceneBreaks,
    };
  }

  private extractKanji(text: string): Set<string> {
    const kanjiSet = new Set<string>();
    for (const char of text) {
      const code = char.codePointAt(0)!;
      // CJK Unified Ideographs: U+4E00–U+9FFF
      if (code >= 0x4e00 && code <= 0x9fff) {
        kanjiSet.add(char);
      }
    }
    return kanjiSet;
  }

  /** Sample vocabulary richness using 5 random windows */
  private sampleVocabularyRichness(text: string): number {
    if (text.length < 100) return 0;

    const windowSize = Math.min(1000, text.length);
    const samples = 5;
    const ratios: number[] = [];

    for (let i = 0; i < samples; i++) {
      const start = Math.floor((text.length - windowSize) * (i / Math.max(samples - 1, 1)));
      const window = text.slice(start, start + windowSize);
      const chars = [...window].filter((c) => c.trim().length > 0);
      if (chars.length === 0) continue;
      const unique = new Set(chars).size;
      ratios.push(unique / chars.length);
    }

    return ratios.length > 0
      ? Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 1000) / 1000
      : 0;
  }

  private variance(values: number[], mean: number): number {
    if (values.length <= 1) return 0;
    const sumSq = values.reduce((s, v) => s + (v - mean) ** 2, 0);
    return Math.round(sumSq / values.length);
  }

  private emptyMetrics(): ProgrammaticMetrics {
    return {
      totalCharCount: 0,
      episodeCount: 0,
      avgEpisodeLength: 0,
      dialogueRatio: 0,
      dialogueLineCount: 0,
      avgDialogueLength: 0,
      avgSentenceLength: 0,
      sentenceLengthVariance: 0,
      shortSentenceRatio: 0,
      longSentenceRatio: 0,
      avgParagraphLength: 0,
      paragraphCount: 0,
      singleLineParagraphRatio: 0,
      uniqueKanjiCount: 0,
      vocabularyRichness: 0,
      sceneBreakCount: 0,
      exclamationDensity: 0,
      questionDensity: 0,
      ellipsisDensity: 0,
      episodeLengthVariance: 0,
      dialogueRatioByEpisode: [],
    };
  }
}

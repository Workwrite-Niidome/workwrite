/**
 * Tests for wizard-derive.ts
 *
 * These tests cover the critical field mapping logic that was the subject of
 * a bug fix where data flowed to wrong fields in the creation wizard.
 *
 * - deriveChaptersFromActGroups: pure function, maps EpisodeCard -> chapter shape
 * - normalizeChapterRecord: pure function, normalises raw DB chapter records
 * - buildEmotionBlueprintPayload: pure function, assembles emotionBlueprint for API
 */

import { describe, it, expect } from 'vitest';
import {
  deriveChaptersFromActGroups,
  normalizeChapterRecord,
  buildEmotionBlueprintPayload,
  type DerivedChapter,
  type RawChapterRecord,
  type EmotionBlueprintInput,
} from './wizard-derive';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeEpisode(overrides: Partial<{
  id: string;
  title: string;
  whatHappens: string;
  whyItHappens: string;
  characters: string[];
  emotionTarget: string;
  aiSuggested: boolean;
}> = {}) {
  return {
    id: overrides.id ?? 'ep-1',
    title: overrides.title ?? 'テスト話',
    whatHappens: overrides.whatHappens ?? '主人公が冒険に出る',
    whyItHappens: overrides.whyItHappens ?? '運命に導かれたから',
    characters: overrides.characters ?? ['主人公'],
    emotionTarget: overrides.emotionTarget ?? 'ワクワク',
    aiSuggested: overrides.aiSuggested ?? false,
  };
}

function makeGroup(overrides: Partial<{
  id: string;
  label: string;
  description: string;
  episodes: ReturnType<typeof makeEpisode>[];
}> = {}) {
  return {
    id: overrides.id ?? 'group-1',
    label: overrides.label ?? '序章',
    description: overrides.description ?? '',
    episodes: overrides.episodes ?? [makeEpisode()],
  };
}

// ─── deriveChaptersFromActGroups ──────────────────────────────────────────────

describe('deriveChaptersFromActGroups', () => {
  // ── field mapping (the exact bug that was fixed) ──────────────────────────

  it('maps whatHappens to summary only — NOT combined with whyItHappens', () => {
    const ep = makeEpisode({ whatHappens: '主人公が出発する', whyItHappens: '師匠に命じられたから' });
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.summary).toBe('主人公が出発する');
    expect(chapter.summary).not.toContain('師匠に命じられたから');
  });

  it('maps whyItHappens to reason as a separate field', () => {
    const ep = makeEpisode({ whatHappens: 'Aが起きる', whyItHappens: 'Bが原因' });
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.reason).toBe('Bが原因');
  });

  it('summary and reason are independent — each holds only their own value', () => {
    const ep = makeEpisode({ whatHappens: 'X', whyItHappens: 'Y' });
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.summary).toBe('X');
    expect(chapter.reason).toBe('Y');
  });

  it('maps emotionTarget to readerEmotion (field renamed in the fix)', () => {
    const ep = makeEpisode({ emotionTarget: '緊張・ドキドキ' });
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.readerEmotion).toBe('緊張・ドキドキ');
  });

  it('does NOT emit an emotionTarget field in the output', () => {
    const ep = makeEpisode({ emotionTarget: '感動' });
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]) as any[];

    expect(chapter).not.toHaveProperty('emotionTarget');
  });

  it('passes title through unchanged', () => {
    const ep = makeEpisode({ title: '第3話：決断' });
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.title).toBe('第3話：決断');
  });

  it('passes characters array through unchanged', () => {
    const ep = makeEpisode({ characters: ['アリス', 'ボブ', '狼'] });
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.characters).toEqual(['アリス', 'ボブ', '狼']);
  });

  it('passes aiSuggested boolean through unchanged when true', () => {
    const ep = makeEpisode({ aiSuggested: true });
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.aiSuggested).toBe(true);
  });

  it('passes aiSuggested boolean through unchanged when false', () => {
    const ep = makeEpisode({ aiSuggested: false });
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.aiSuggested).toBe(false);
  });

  // ── empty / undefined defaults ────────────────────────────────────────────

  it('defaults summary to empty string when whatHappens is undefined', () => {
    const ep = makeEpisode();
    (ep as any).whatHappens = undefined;
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.summary).toBe('');
  });

  it('defaults reason to empty string when whyItHappens is undefined', () => {
    const ep = makeEpisode();
    (ep as any).whyItHappens = undefined;
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.reason).toBe('');
  });

  it('defaults readerEmotion to empty string when emotionTarget is undefined', () => {
    const ep = makeEpisode();
    (ep as any).emotionTarget = undefined;
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.readerEmotion).toBe('');
  });

  it('defaults summary to empty string when whatHappens is empty string', () => {
    const ep = makeEpisode({ whatHappens: '' });
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.summary).toBe('');
  });

  it('defaults reason to empty string when whyItHappens is empty string', () => {
    const ep = makeEpisode({ whyItHappens: '' });
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.reason).toBe('');
  });

  it('defaults readerEmotion to empty string when emotionTarget is empty string', () => {
    const ep = makeEpisode({ emotionTarget: '' });
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.readerEmotion).toBe('');
  });

  // ── empty groups / episodes ────────────────────────────────────────────────

  it('returns empty array when groups is empty', () => {
    expect(deriveChaptersFromActGroups([])).toEqual([]);
  });

  it('returns empty array when all groups have no episodes', () => {
    const group = makeGroup({ episodes: [] });
    expect(deriveChaptersFromActGroups([group])).toEqual([]);
  });

  it('skips groups that have no episodes and still processes ones that do', () => {
    const emptyGroup = makeGroup({ id: 'g0', episodes: [] });
    const ep = makeEpisode({ title: '第1話' });
    const fullGroup = makeGroup({ id: 'g1', episodes: [ep] });

    const result = deriveChaptersFromActGroups([emptyGroup, fullGroup]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('第1話');
  });

  // ── multiple groups and episodes ──────────────────────────────────────────

  it('flattens episodes from multiple groups in order', () => {
    const ep1 = makeEpisode({ id: 'e1', title: '第1話', whatHappens: 'A', whyItHappens: 'B', emotionTarget: 'X' });
    const ep2 = makeEpisode({ id: 'e2', title: '第2話', whatHappens: 'C', whyItHappens: 'D', emotionTarget: 'Y' });
    const ep3 = makeEpisode({ id: 'e3', title: '第3話', whatHappens: 'E', whyItHappens: 'F', emotionTarget: 'Z' });

    const groups = [
      makeGroup({ id: 'g1', episodes: [ep1, ep2] }),
      makeGroup({ id: 'g2', episodes: [ep3] }),
    ];

    const result = deriveChaptersFromActGroups(groups);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ title: '第1話', summary: 'A', reason: 'B', readerEmotion: 'X' });
    expect(result[1]).toMatchObject({ title: '第2話', summary: 'C', reason: 'D', readerEmotion: 'Y' });
    expect(result[2]).toMatchObject({ title: '第3話', summary: 'E', reason: 'F', readerEmotion: 'Z' });
  });

  it('preserves per-episode characters arrays independently', () => {
    const ep1 = makeEpisode({ id: 'e1', characters: ['A'] });
    const ep2 = makeEpisode({ id: 'e2', characters: ['B', 'C'] });
    const groups = [makeGroup({ episodes: [ep1, ep2] })];

    const result = deriveChaptersFromActGroups(groups);

    expect(result[0].characters).toEqual(['A']);
    expect(result[1].characters).toEqual(['B', 'C']);
  });

  it('handles single group with many episodes', () => {
    const episodes = Array.from({ length: 10 }, (_, i) =>
      makeEpisode({ id: `e${i}`, title: `話${i}`, whatHappens: `何${i}`, whyItHappens: `なぜ${i}`, emotionTarget: `感${i}` })
    );
    const result = deriveChaptersFromActGroups([makeGroup({ episodes })]);

    expect(result).toHaveLength(10);
    result.forEach((ch, i) => {
      expect(ch.summary).toBe(`何${i}`);
      expect(ch.reason).toBe(`なぜ${i}`);
      expect(ch.readerEmotion).toBe(`感${i}`);
    });
  });

  // ── special characters ────────────────────────────────────────────────────

  it('preserves Unicode and emoji in field values without corruption', () => {
    const ep = makeEpisode({
      whatHappens: '主人公が「真実」を知る — \u00AB驚き\u00BB',
      whyItHappens: '運命の糸が\u2026絡まっていたから',
      emotionTarget: '胸が締め付けられる感覚',
    });
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.summary).toBe('主人公が「真実」を知る — \u00AB驚き\u00BB');
    expect(chapter.reason).toBe('運命の糸が\u2026絡まっていたから');
    expect(chapter.readerEmotion).toBe('胸が締め付けられる感覚');
  });

  it('handles SQL-unsafe characters without modification', () => {
    const ep = makeEpisode({ whatHappens: "O'Brien said; DROP TABLE episodes;--" });
    const [chapter] = deriveChaptersFromActGroups([makeGroup({ episodes: [ep] })]);

    expect(chapter.summary).toBe("O'Brien said; DROP TABLE episodes;--");
  });
});

// ─── normalizeChapterRecord ───────────────────────────────────────────────────

describe('normalizeChapterRecord', () => {
  // ── backward compatibility: old format used emotionTarget ─────────────────

  it('reads readerEmotion when present (new format)', () => {
    const raw: RawChapterRecord = {
      title: '第1話',
      summary: 'サマリー',
      reason: '理由',
      readerEmotion: '緊張',
    };
    expect(normalizeChapterRecord(raw).readerEmotion).toBe('緊張');
  });

  it('falls back to emotionTarget when readerEmotion is absent (old format)', () => {
    const raw: RawChapterRecord = {
      title: '第1話',
      summary: 'サマリー',
      reason: '理由',
      emotionTarget: '感動',
    };
    expect(normalizeChapterRecord(raw).readerEmotion).toBe('感動');
  });

  it('prefers readerEmotion over emotionTarget when both are present', () => {
    const raw: RawChapterRecord = {
      title: '第1話',
      summary: '',
      reason: '',
      readerEmotion: '新しい値',
      emotionTarget: '古い値',
    };
    expect(normalizeChapterRecord(raw).readerEmotion).toBe('新しい値');
  });

  it('defaults readerEmotion to empty string when both fields are absent', () => {
    const raw: RawChapterRecord = { title: '第1話', summary: '', reason: '' };
    expect(normalizeChapterRecord(raw).readerEmotion).toBe('');
  });

  it('defaults title to empty string when absent', () => {
    const raw: RawChapterRecord = { summary: '', reason: '' } as any;
    expect(normalizeChapterRecord(raw).title).toBe('');
  });

  it('defaults summary to empty string when absent', () => {
    const raw: RawChapterRecord = { title: '話1', reason: '' } as any;
    expect(normalizeChapterRecord(raw).summary).toBe('');
  });

  it('defaults reason to empty string when absent', () => {
    const raw: RawChapterRecord = { title: '話1', summary: '' } as any;
    expect(normalizeChapterRecord(raw).reason).toBe('');
  });

  it('does NOT include emotionTarget in the normalised output', () => {
    const raw: RawChapterRecord = { title: '', summary: '', reason: '', emotionTarget: '古い感情' };
    const normalised = normalizeChapterRecord(raw) as any;
    expect(normalised).not.toHaveProperty('emotionTarget');
  });

  it('preserves all four normalised fields in output shape', () => {
    const raw: RawChapterRecord = { title: 'T', summary: 'S', reason: 'R', readerEmotion: 'E' };
    const result = normalizeChapterRecord(raw);
    expect(result).toMatchObject({ title: 'T', summary: 'S', reason: 'R', readerEmotion: 'E' });
  });
});

// ─── buildEmotionBlueprintPayload ─────────────────────────────────────────────

describe('buildEmotionBlueprintPayload', () => {
  function fullInput(): EmotionBlueprintInput {
    return {
      coreMessage: '勇気の大切さ',
      targetEmotions: '感動・希望',
      readerJourney: '主人公と共に成長できる',
      inspiration: '夜明け前の静寂',
      readerOneLiner: '「もう一度読みたい」',
    };
  }

  // ── all 5 fields are preserved ────────────────────────────────────────────

  it('includes coreMessage in output', () => {
    const result = buildEmotionBlueprintPayload(fullInput());
    expect(result?.coreMessage).toBe('勇気の大切さ');
  });

  it('includes targetEmotions in output', () => {
    const result = buildEmotionBlueprintPayload(fullInput());
    expect(result?.targetEmotions).toBe('感動・希望');
  });

  it('includes readerJourney in output', () => {
    const result = buildEmotionBlueprintPayload(fullInput());
    expect(result?.readerJourney).toBe('主人公と共に成長できる');
  });

  it('includes inspiration in output', () => {
    const result = buildEmotionBlueprintPayload(fullInput());
    expect(result?.inspiration).toBe('夜明け前の静寂');
  });

  it('includes readerOneLiner in output', () => {
    const result = buildEmotionBlueprintPayload(fullInput());
    expect(result?.readerOneLiner).toBe('「もう一度読みたい」');
  });

  // ── save/load round-trip completeness ─────────────────────────────────────

  it('round-trip: all 5 fields survive a payload build with no data loss', () => {
    const input = fullInput();
    const payload = buildEmotionBlueprintPayload(input);
    expect(payload).toEqual({
      coreMessage: input.coreMessage,
      targetEmotions: input.targetEmotions,
      readerJourney: input.readerJourney,
      inspiration: input.inspiration,
      readerOneLiner: input.readerOneLiner,
    });
  });

  // ── returns null when all fields are empty (do not persist empty blueprints) ──

  it('returns null when all fields are empty strings', () => {
    const input: EmotionBlueprintInput = {
      coreMessage: '',
      targetEmotions: '',
      readerJourney: '',
      inspiration: '',
      readerOneLiner: '',
    };
    expect(buildEmotionBlueprintPayload(input)).toBeNull();
  });

  it('returns a payload when only coreMessage is filled', () => {
    const input: EmotionBlueprintInput = {
      coreMessage: '孤独でも前を向く',
      targetEmotions: '',
      readerJourney: '',
      inspiration: '',
      readerOneLiner: '',
    };
    const result = buildEmotionBlueprintPayload(input);
    expect(result).not.toBeNull();
    expect(result?.coreMessage).toBe('孤独でも前を向く');
  });

  it('returns a payload when only inspiration is filled', () => {
    const input: EmotionBlueprintInput = {
      coreMessage: '',
      targetEmotions: '',
      readerJourney: '',
      inspiration: '忘れられない夕焼け',
      readerOneLiner: '',
    };
    const result = buildEmotionBlueprintPayload(input);
    expect(result).not.toBeNull();
    expect(result?.inspiration).toBe('忘れられない夕焼け');
  });

  it('returns a payload when only readerOneLiner is filled', () => {
    const input: EmotionBlueprintInput = {
      coreMessage: '',
      targetEmotions: '',
      readerJourney: '',
      inspiration: '',
      readerOneLiner: '「続きが読みたい」',
    };
    const result = buildEmotionBlueprintPayload(input);
    expect(result).not.toBeNull();
    expect(result?.readerOneLiner).toBe('「続きが読みたい」');
  });

  // ── empty fields are preserved as empty strings in payload (not omitted) ──

  it('preserves empty strings in payload fields alongside filled ones', () => {
    const input: EmotionBlueprintInput = {
      coreMessage: '核心',
      targetEmotions: '',
      readerJourney: '',
      inspiration: '',
      readerOneLiner: '',
    };
    const result = buildEmotionBlueprintPayload(input)!;
    expect(result.targetEmotions).toBe('');
    expect(result.readerJourney).toBe('');
    expect(result.inspiration).toBe('');
    expect(result.readerOneLiner).toBe('');
  });
});

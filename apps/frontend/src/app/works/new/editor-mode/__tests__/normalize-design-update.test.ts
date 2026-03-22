/**
 * Tests for normalizeDesignUpdate
 *
 * This function normalises raw AI JSON output (from __DESIGN_UPDATE__ blocks)
 * into the shape expected by DesignData.  Bugs here caused production crashes,
 * so every documented mapping rule is covered.
 */
import { describe, it, expect } from 'vitest';
import { normalizeDesignUpdate } from '@/components/editor-mode-design/normalize';

// ─── Field mapping ────────────────────────────────────────────────────────────

describe('normalizeDesignUpdate – field mapping', () => {
  it('maps genre_setting to genre', () => {
    const result = normalizeDesignUpdate({ genre_setting: 'ファンタジー' });
    expect(result.genre).toBe('ファンタジー');
  });

  it('maps raw genre field to genre', () => {
    const result = normalizeDesignUpdate({ genre: 'SF' });
    expect(result.genre).toBe('SF');
  });

  it('prefers genre_setting over genre when both present', () => {
    const result = normalizeDesignUpdate({ genre_setting: 'ホラー', genre: 'SF' });
    expect(result.genre).toBe('ホラー');
  });

  it('maps emotion to afterReading', () => {
    const result = normalizeDesignUpdate({ emotion: '感動・希望' });
    expect(result.afterReading).toBe('感動・希望');
  });

  it('maps afterReading field directly when emotion absent', () => {
    const result = normalizeDesignUpdate({ afterReading: '切なさ' });
    expect(result.afterReading).toBe('切なさ');
  });

  it('prefers emotion over afterReading when both present', () => {
    const result = normalizeDesignUpdate({ emotion: '喜び', afterReading: '悲しみ' });
    expect(result.afterReading).toBe('喜び');
  });

  it('maps world to worldBuilding wrapped in WorldBuildingData', () => {
    const result = normalizeDesignUpdate({ world: '現代日本の学校' });
    expect(result.worldBuilding).toBeDefined();
    expect(result.worldBuilding!.history).toBe('現代日本の学校');
  });

  it('maps worldBuilding field to worldBuilding when world absent', () => {
    const result = normalizeDesignUpdate({ worldBuilding: '宇宙の果て' });
    expect(result.worldBuilding!.history).toBe('宇宙の果て');
  });

  it('maps plot to plotOutline', () => {
    const result = normalizeDesignUpdate({ plot: '少年が旅に出る' });
    expect(result.plotOutline).toBe('少年が旅に出る');
  });

  it('maps plotOutline field directly when plot absent', () => {
    const result = normalizeDesignUpdate({ plotOutline: '王国を救う' });
    expect(result.plotOutline).toBe('王国を救う');
  });

  it('prefers plot over plotOutline when both present', () => {
    const result = normalizeDesignUpdate({ plot: 'Aプロット', plotOutline: 'Bプロット' });
    expect(result.plotOutline).toBe('Aプロット');
  });

  it('maps theme directly', () => {
    const result = normalizeDesignUpdate({ theme: '成長と喪失' });
    expect(result.theme).toBe('成長と喪失');
  });

  it('maps tone directly', () => {
    const result = normalizeDesignUpdate({ tone: 'ダーク' });
    expect(result.tone).toBe('ダーク');
  });

  it('maps conflict directly', () => {
    const result = normalizeDesignUpdate({ conflict: '主人公 vs 悪の組織' });
    expect(result.conflict).toBe('主人公 vs 悪の組織');
  });
});

// ─── 'null' string sentinel ───────────────────────────────────────────────────

describe('normalizeDesignUpdate – "null" string values are ignored', () => {
  it('ignores genre_setting === "null"', () => {
    const result = normalizeDesignUpdate({ genre_setting: 'null' });
    expect(result.genre).toBeUndefined();
  });

  it('ignores emotion === "null"', () => {
    const result = normalizeDesignUpdate({ emotion: 'null' });
    expect(result.afterReading).toBeUndefined();
  });

  it('ignores theme === "null"', () => {
    const result = normalizeDesignUpdate({ theme: 'null' });
    expect(result.theme).toBeUndefined();
  });

  it('ignores tone === "null"', () => {
    const result = normalizeDesignUpdate({ tone: 'null' });
    expect(result.tone).toBeUndefined();
  });

  it('ignores world === "null"', () => {
    const result = normalizeDesignUpdate({ world: 'null' });
    expect(result.worldBuilding).toBeUndefined();
  });

  it('ignores plot === "null"', () => {
    const result = normalizeDesignUpdate({ plot: 'null' });
    expect(result.plotOutline).toBeUndefined();
  });

  it('ignores conflict === "null"', () => {
    const result = normalizeDesignUpdate({ conflict: 'null' });
    expect(result.conflict).toBeUndefined();
  });

  it('ignores protagonist === "null"', () => {
    const result = normalizeDesignUpdate({ protagonist: 'null' });
    expect(result.protagonist).toBeUndefined();
  });
});

// ─── protagonist handling ─────────────────────────────────────────────────────

describe('normalizeDesignUpdate – protagonist', () => {
  it('converts string protagonist to object with name field', () => {
    const result = normalizeDesignUpdate({ protagonist: '田中太郎' });
    expect(result.protagonist).toEqual({
      name: '田中太郎',
      role: '',
      personality: '',
      speechStyle: '',
    });
  });

  it('passes through protagonist object unchanged', () => {
    const obj = { name: '鈴木一郎', role: '主人公', personality: '勇敢', speechStyle: '丁寧語' };
    const result = normalizeDesignUpdate({ protagonist: obj });
    expect(result.protagonist).toEqual(obj);
  });

  it('protagonist null is ignored', () => {
    const result = normalizeDesignUpdate({ protagonist: null });
    expect(result.protagonist).toBeUndefined();
  });

  it('protagonist undefined is ignored', () => {
    const result = normalizeDesignUpdate({ protagonist: undefined });
    expect(result.protagonist).toBeUndefined();
  });
});

// ─── characters handling ──────────────────────────────────────────────────────

describe('normalizeDesignUpdate – characters', () => {
  it('passes through characters array as-is', () => {
    const chars = [{ name: 'A' }, { name: 'B' }];
    const result = normalizeDesignUpdate({ characters: chars });
    expect(result.characters).toEqual(chars);
  });

  it('stores string characters as-is (cast to any)', () => {
    const result = normalizeDesignUpdate({ characters: '佐藤（刑事）、田中（容疑者）' });
    expect(result.characters).toBe('佐藤（刑事）、田中（容疑者）');
  });

  it('ignores null characters', () => {
    const result = normalizeDesignUpdate({ characters: null });
    expect(result.characters).toBeUndefined();
  });

  it('ignores characters === "null" string', () => {
    const result = normalizeDesignUpdate({ characters: 'null' });
    expect(result.characters).toBeUndefined();
  });

  it('ignores undefined characters', () => {
    const result = normalizeDesignUpdate({ characters: undefined });
    expect(result.characters).toBeUndefined();
  });

  it('stores empty array characters', () => {
    const result = normalizeDesignUpdate({ characters: [] });
    expect(result.characters).toEqual([]);
  });
});

// ─── worldBuilding structure ──────────────────────────────────────────────────

describe('normalizeDesignUpdate – worldBuilding structure', () => {
  it('wraps world string in WorldBuildingData with history field', () => {
    const result = normalizeDesignUpdate({ world: '魔法が存在する中世ヨーロッパ' });
    expect(result.worldBuilding).toMatchObject({
      basics: { era: '', setting: '', civilizationLevel: '' },
      rules: [],
      terminology: [],
      history: '魔法が存在する中世ヨーロッパ',
      infoAsymmetry: { commonKnowledge: '', hiddenTruths: '' },
      items: [],
    });
  });

  it('worldBuilding string is placed in history, not any other field', () => {
    const result = normalizeDesignUpdate({ world: 'スチームパンク都市' });
    expect(result.worldBuilding!.history).toBe('スチームパンク都市');
    // basics fields should remain empty
    expect(result.worldBuilding!.basics.era).toBe('');
    expect(result.worldBuilding!.basics.setting).toBe('');
  });
});

// ─── scope parsing ────────────────────────────────────────────────────────────

describe('normalizeDesignUpdate – scope parsing', () => {
  it('parses "10話 × 3000字" into episodeCount=10 and charCountPerEpisode=3000', () => {
    const result = normalizeDesignUpdate({ scope: '10話 × 3000字' });
    expect(result.episodeCount).toBe(10);
    expect(result.charCountPerEpisode).toBe(3000);
  });

  it('parses "8話" into episodeCount=8 with no charCountPerEpisode', () => {
    const result = normalizeDesignUpdate({ scope: '8話' });
    expect(result.episodeCount).toBe(8);
    expect(result.charCountPerEpisode).toBeUndefined();
  });

  it('parses bare number string "15" into episodeCount=15', () => {
    const result = normalizeDesignUpdate({ scope: '15' });
    expect(result.episodeCount).toBe(15);
    expect(result.charCountPerEpisode).toBeUndefined();
  });

  it('parses scope with 話 and 字 with different spacing', () => {
    const result = normalizeDesignUpdate({ scope: '12話×2000字' });
    expect(result.episodeCount).toBe(12);
    expect(result.charCountPerEpisode).toBe(2000);
  });

  it('uses episodeCount field as fallback when scope absent', () => {
    const result = normalizeDesignUpdate({ episodeCount: '5話 × 1500字' });
    expect(result.episodeCount).toBe(5);
    expect(result.charCountPerEpisode).toBe(1500);
  });

  it('ignores scope === "null"', () => {
    const result = normalizeDesignUpdate({ scope: 'null' });
    expect(result.episodeCount).toBeUndefined();
    expect(result.charCountPerEpisode).toBeUndefined();
  });

  it('ignores scope === null', () => {
    const result = normalizeDesignUpdate({ scope: null });
    expect(result.episodeCount).toBeUndefined();
  });

  it('ignores scope that has no digits', () => {
    const result = normalizeDesignUpdate({ scope: 'unknown' });
    expect(result.episodeCount).toBeUndefined();
  });
});

// ─── empty / undefined / null inputs ─────────────────────────────────────────

describe('normalizeDesignUpdate – empty and null inputs', () => {
  it('returns empty object for empty input object', () => {
    const result = normalizeDesignUpdate({});
    expect(result).toEqual({});
  });

  it('returns empty object when all fields are null', () => {
    const result = normalizeDesignUpdate({
      genre_setting: null,
      theme: null,
      emotion: null,
      protagonist: null,
      characters: null,
      world: null,
      conflict: null,
      plot: null,
      tone: null,
      scope: null,
    });
    expect(result).toEqual({});
  });

  it('returns empty object when all fields are "null" strings', () => {
    const result = normalizeDesignUpdate({
      genre_setting: 'null',
      theme: 'null',
      emotion: 'null',
      protagonist: 'null',
      characters: 'null',
      world: 'null',
      conflict: 'null',
      plot: 'null',
      tone: 'null',
      scope: 'null',
    });
    expect(result).toEqual({});
  });

  it('does not include undefined fields in output', () => {
    const result = normalizeDesignUpdate({ genre: 'SF' });
    expect('theme' in result).toBe(false);
    expect('afterReading' in result).toBe(false);
    expect('protagonist' in result).toBe(false);
    expect('characters' in result).toBe(false);
    expect('worldBuilding' in result).toBe(false);
    expect('conflict' in result).toBe(false);
    expect('plotOutline' in result).toBe(false);
    expect('tone' in result).toBe(false);
    expect('episodeCount' in result).toBe(false);
    expect('charCountPerEpisode' in result).toBe(false);
  });

  it('ignores empty string fields', () => {
    const result = normalizeDesignUpdate({ theme: '', genre: '' });
    expect(result.theme).toBeUndefined();
    expect(result.genre).toBeUndefined();
  });
});

// ─── full realistic AI output ─────────────────────────────────────────────────

describe('normalizeDesignUpdate – full realistic AI output', () => {
  it('normalises a complete AI output object correctly', () => {
    const raw = {
      genre_setting: 'ダークファンタジー・中世ヨーロッパ',
      theme: '正義と復讐の狭間で',
      emotion: '深い余韻と哀愁',
      protagonist: '魔法使いのアルス',
      characters: 'エリナ（騎士）、ヴァン（悪役）',
      world: '魔法が衰退しつつある王国',
      conflict: '王国の崩壊を防ぐか、復讐を果たすか',
      plot: '魔法使いが王国の陰謀を暴く旅に出る',
      tone: '重厚・シリアス',
      scope: '20話 × 4000字',
    };
    const result = normalizeDesignUpdate(raw);

    expect(result.genre).toBe('ダークファンタジー・中世ヨーロッパ');
    expect(result.theme).toBe('正義と復讐の狭間で');
    expect(result.afterReading).toBe('深い余韻と哀愁');
    expect(result.protagonist).toEqual({
      name: '魔法使いのアルス',
      role: '',
      personality: '',
      speechStyle: '',
    });
    expect(result.characters).toBe('エリナ（騎士）、ヴァン（悪役）');
    expect(result.worldBuilding!.history).toBe('魔法が衰退しつつある王国');
    expect(result.conflict).toBe('王国の崩壊を防ぐか、復讐を果たすか');
    expect(result.plotOutline).toBe('魔法使いが王国の陰謀を暴く旅に出る');
    expect(result.tone).toBe('重厚・シリアス');
    expect(result.episodeCount).toBe(20);
    expect(result.charCountPerEpisode).toBe(4000);
  });

  it('normalises partial update where only scope changed', () => {
    const raw = {
      genre_setting: 'null',
      scope: '6話 × 2500字',
    };
    const result = normalizeDesignUpdate(raw);
    expect(result.genre).toBeUndefined();
    expect(result.episodeCount).toBe(6);
    expect(result.charCountPerEpisode).toBe(2500);
  });
});

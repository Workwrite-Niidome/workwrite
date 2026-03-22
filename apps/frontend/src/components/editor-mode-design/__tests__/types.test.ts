/**
 * Tests for the pure functions exported from types.ts:
 *   - designToWizard
 *   - wizardChangeToDesign
 *   - isTabFilled
 *   - getFilledCount
 */
import { describe, it, expect } from 'vitest';
import {
  designToWizard,
  wizardChangeToDesign,
  isTabFilled,
  getFilledCount,
} from '../types';
import type { DesignData } from '../types';
import type { WorldBuildingData } from '../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

const emptyDesign: DesignData = {};

const fullWorldBuilding: WorldBuildingData = {
  basics: { era: '現代', setting: '東京', civilizationLevel: '高度' },
  rules: [{ id: '1', name: 'ルール1', description: '説明', constraints: '' }],
  terminology: [{ id: '1', term: '用語', reading: 'ようご', definition: '定義' }],
  history: '長い歴史',
  infoAsymmetry: { commonKnowledge: '常識', hiddenTruths: '秘密' },
  items: [],
};

// ─── designToWizard ───────────────────────────────────────────────────────────

describe('designToWizard', () => {
  it('converts genre correctly', () => {
    const result = designToWizard({ genre: 'SF' });
    expect(result.genre).toBe('SF');
  });

  it('defaults genre to empty string when absent', () => {
    const result = designToWizard({});
    expect(result.genre).toBe('');
  });

  it('converts subGenres array', () => {
    const result = designToWizard({ subGenres: ['ロボット', 'サイバーパンク'] });
    expect(result.subGenres).toEqual(['ロボット', 'サイバーパンク']);
  });

  it('defaults subGenres to empty array when absent', () => {
    const result = designToWizard({});
    expect(result.subGenres).toEqual([]);
  });

  it('converts characters array', () => {
    const chars = [{ name: '太郎', role: '主人公' }];
    const result = designToWizard({ characters: chars });
    expect(result.characters).toEqual(chars);
  });

  it('defaults characters to empty array when absent', () => {
    const result = designToWizard({});
    expect(result.characters).toEqual([]);
  });

  it('converts worldBuilding object', () => {
    const result = designToWizard({ worldBuilding: fullWorldBuilding });
    expect(result.worldBuilding).toEqual(fullWorldBuilding);
  });

  it('defaults worldBuilding to EMPTY_WORLD_BUILDING when absent', () => {
    const result = designToWizard({});
    expect(result.worldBuilding).toMatchObject({
      basics: { era: '', setting: '', civilizationLevel: '' },
      rules: [],
      terminology: [],
      history: '',
      infoAsymmetry: { commonKnowledge: '', hiddenTruths: '' },
      items: [],
    });
  });

  it('handles empty DesignData without throwing', () => {
    expect(() => designToWizard(emptyDesign)).not.toThrow();
  });

  it('falls back to legacy theme field for coreMessage', () => {
    const result = designToWizard({ theme: '成長' });
    expect(result.coreMessage).toBe('成長');
  });

  it('prefers coreMessage over legacy theme field', () => {
    const result = designToWizard({ coreMessage: '喪失', theme: '成長' });
    expect(result.coreMessage).toBe('喪失');
  });

  it('falls back to legacy afterReading field for targetEmotions', () => {
    const result = designToWizard({ afterReading: '切なさ' });
    expect(result.targetEmotions).toBe('切なさ');
  });

  it('prefers targetEmotions over legacy afterReading field', () => {
    const result = designToWizard({ targetEmotions: '希望', afterReading: '切なさ' });
    expect(result.targetEmotions).toBe('希望');
  });

  it('defaults structureTemplate to kishotenketsu', () => {
    const result = designToWizard({});
    expect(result.structureTemplate).toBe('kishotenketsu');
  });

  it('preserves structureTemplate when set', () => {
    const result = designToWizard({ structureTemplate: 'three-act' });
    expect(result.structureTemplate).toBe('three-act');
  });

  it('converts actGroups', () => {
    const actGroups = [{ id: '1', label: '序', description: '始まり', episodes: [] }];
    const result = designToWizard({ actGroups });
    expect(result.actGroups).toEqual(actGroups);
  });

  it('always sets plotOutline to null (legacy field not carried)', () => {
    const result = designToWizard({ plotOutline: 'some outline' });
    expect(result.plotOutline).toBeNull();
  });

  it('always sets chapterOutline to empty array', () => {
    const result = designToWizard({});
    expect(result.chapterOutline).toEqual([]);
  });

  it('converts title and synopsis', () => {
    const result = designToWizard({ title: '転生勇者', synopsis: '異世界に転生した少年の物語' });
    expect(result.title).toBe('転生勇者');
    expect(result.synopsis).toBe('異世界に転生した少年の物語');
  });

  it('passes through AI suggestion caches', () => {
    const cache = { suggestions: ['A', 'B'] };
    const result = designToWizard({ _aiCharacterSuggestions: cache });
    expect(result._aiCharacterSuggestions).toEqual(cache);
  });
});

// ─── wizardChangeToDesign ─────────────────────────────────────────────────────

describe('wizardChangeToDesign', () => {
  it('converts genre change back to DesignData', () => {
    const result = wizardChangeToDesign({ genre: 'ホラー' });
    expect(result.genre).toBe('ホラー');
  });

  it('converts characters change back', () => {
    const chars = [{ name: '花子' }];
    const result = wizardChangeToDesign({ characters: chars });
    expect(result.characters).toEqual(chars);
  });

  it('converts worldBuilding change back', () => {
    const result = wizardChangeToDesign({ worldBuilding: fullWorldBuilding });
    expect(result.worldBuilding).toEqual(fullWorldBuilding);
  });

  it('handles partial updates – only includes changed fields', () => {
    const result = wizardChangeToDesign({ genre: 'ミステリー' });
    expect('worldBuilding' in result).toBe(false);
    expect('characters' in result).toBe(false);
    expect('subGenres' in result).toBe(false);
  });

  it('converts subGenres change back', () => {
    const result = wizardChangeToDesign({ subGenres: ['警察', '法廷'] });
    expect(result.subGenres).toEqual(['警察', '法廷']);
  });

  it('converts coreMessage change back', () => {
    const result = wizardChangeToDesign({ coreMessage: '正義とは何か' });
    expect(result.coreMessage).toBe('正義とは何か');
  });

  it('converts targetEmotions change back', () => {
    const result = wizardChangeToDesign({ targetEmotions: '緊張感' });
    expect(result.targetEmotions).toBe('緊張感');
  });

  it('converts actGroups change back', () => {
    const actGroups = [{ id: '1', label: '起', description: '', episodes: [] }];
    const result = wizardChangeToDesign({ actGroups });
    expect(result.actGroups).toEqual(actGroups);
  });

  it('converts title and synopsis changes', () => {
    const result = wizardChangeToDesign({ title: '魔王討伐記', synopsis: '概要' });
    expect(result.title).toBe('魔王討伐記');
    expect(result.synopsis).toBe('概要');
  });

  it('converts emotionMode change', () => {
    const result = wizardChangeToDesign({ emotionMode: 'skip' });
    expect(result.emotionMode).toBe('skip');
  });

  it('converts structureTemplate change', () => {
    const result = wizardChangeToDesign({ structureTemplate: 'beat-sheet' });
    expect(result.structureTemplate).toBe('beat-sheet');
  });

  it('converts AI suggestion cache changes', () => {
    const cache = [1, 2, 3];
    const result = wizardChangeToDesign({ _aiChapterSuggestions: cache });
    expect(result._aiChapterSuggestions).toEqual(cache);
  });

  it('handles empty change object', () => {
    const result = wizardChangeToDesign({});
    expect(result).toEqual({});
  });

  it('does not include plotOutline or chapterOutline (they live only in WizardData)', () => {
    const result = wizardChangeToDesign({ plotOutline: 'old outline' as any });
    // plotOutline is not a key that wizardChangeToDesign maps back
    expect('plotOutline' in result).toBe(false);
  });
});

// ─── isTabFilled ──────────────────────────────────────────────────────────────

describe('isTabFilled', () => {
  describe('overview tab', () => {
    it('returns true when genre exists', () => {
      expect(isTabFilled({ genre: 'SF' }, 'overview')).toBe(true);
    });

    it('returns true when episodeCount > 0', () => {
      expect(isTabFilled({ episodeCount: 10 }, 'overview')).toBe(true);
    });

    it('returns true when coreMessage exists', () => {
      expect(isTabFilled({ coreMessage: 'テーマ' }, 'overview')).toBe(true);
    });

    it('returns false when no overview fields are set', () => {
      expect(isTabFilled({}, 'overview')).toBe(false);
    });

    it('returns false when all overview string fields are empty strings', () => {
      expect(isTabFilled({ genre: '', tags: '', theme: '' }, 'overview')).toBe(false);
    });

    it('returns false when episodeCount is 0', () => {
      expect(isTabFilled({ episodeCount: 0 }, 'overview')).toBe(false);
    });
  });

  describe('characters tab', () => {
    it('returns true with a non-empty array of characters', () => {
      expect(isTabFilled({ characters: [{ name: 'A' }] }, 'characters')).toBe(true);
    });

    it('returns false with an empty characters array', () => {
      expect(isTabFilled({ characters: [] }, 'characters')).toBe(false);
    });

    it('returns true with string characters (legacy)', () => {
      expect(isTabFilled({ characters: '太郎、花子' as any }, 'characters')).toBe(true);
    });

    it('returns false with empty string characters', () => {
      expect(isTabFilled({ characters: '' as any }, 'characters')).toBe(false);
    });

    it('returns false with no character-related fields', () => {
      expect(isTabFilled({}, 'characters')).toBe(false);
    });
  });

  describe('world tab', () => {
    it('returns true with a WorldBuildingData object that has keys', () => {
      expect(isTabFilled({ worldBuilding: fullWorldBuilding }, 'world')).toBe(true);
    });

    it('returns false with an empty object for worldBuilding', () => {
      expect(isTabFilled({ worldBuilding: {} as any }, 'world')).toBe(false);
    });

    it('returns false with no world fields', () => {
      expect(isTabFilled({}, 'world')).toBe(false);
    });
  });

  describe('plot tab', () => {
    it('returns true when actGroups is non-empty', () => {
      const actGroups = [{ id: '1', label: '起', description: '', episodes: [] }];
      expect(isTabFilled({ actGroups }, 'plot')).toBe(true);
    });

    it('returns true when plotOutline string exists', () => {
      expect(isTabFilled({ plotOutline: '主人公が旅に出る' }, 'plot')).toBe(true);
    });

    it('returns true when conflict exists', () => {
      expect(isTabFilled({ conflict: '主人公 vs 悪役' }, 'plot')).toBe(true);
    });

    it('returns false when actGroups is empty array', () => {
      expect(isTabFilled({ actGroups: [] }, 'plot')).toBe(false);
    });

    it('returns false when plotOutline is empty string', () => {
      expect(isTabFilled({ plotOutline: '' }, 'plot')).toBe(false);
    });

    it('returns false with no plot fields', () => {
      expect(isTabFilled({}, 'plot')).toBe(false);
    });
  });

  describe('preview tab', () => {
    it('always returns false because preview has no designKeys', () => {
      expect(isTabFilled({ genre: 'SF', worldBuilding: fullWorldBuilding }, 'preview')).toBe(false);
    });

    it('returns false for empty design too', () => {
      expect(isTabFilled({}, 'preview')).toBe(false);
    });
  });
});

// ─── getFilledCount ───────────────────────────────────────────────────────────

describe('getFilledCount', () => {
  it('returns 0 for completely empty design', () => {
    expect(getFilledCount({})).toBe(0);
  });

  it('counts genre as 1', () => {
    expect(getFilledCount({ genre: 'SF' })).toBe(1);
  });

  it('counts subGenres array with items as 1', () => {
    expect(getFilledCount({ subGenres: ['ロボット'] })).toBe(1);
  });

  it('does not count empty subGenres array', () => {
    expect(getFilledCount({ subGenres: [] })).toBe(0);
  });

  it('counts worldBuilding object as 1', () => {
    expect(getFilledCount({ worldBuilding: fullWorldBuilding })).toBe(1);
  });

  it('does not count episodeCount of 0', () => {
    expect(getFilledCount({ episodeCount: 0 })).toBe(0);
  });

  it('counts episodeCount > 0 as 1', () => {
    expect(getFilledCount({ episodeCount: 10 })).toBe(1);
  });

  it('counts multiple filled fields correctly', () => {
    const design: DesignData = {
      genre: 'ミステリー',
      subGenres: ['警察', '法廷'],
      coreMessage: 'テーマ',
      targetEmotions: '緊張',
      characters: [{ name: '刑事' }],
      worldBuilding: fullWorldBuilding,
      actGroups: [{ id: '1', label: '起', description: '', episodes: [] }],
      title: 'タイトル',
      synopsis: 'あらすじ',
      episodeCount: 12,
    };
    expect(getFilledCount(design)).toBe(10);
  });

  it('counts legacy fields (theme, afterReading, protagonist, conflict, plotOutline, tone)', () => {
    const design: DesignData = {
      theme: '成長',
      afterReading: '感動',
      protagonist: { name: '太郎', role: '', personality: '', speechStyle: '' },
      conflict: '葛藤',
      plotOutline: 'プロット',
      tone: 'ダーク',
    };
    expect(getFilledCount(design)).toBe(6);
  });

  it('handles mix of legacy and new fields without double-counting', () => {
    const design: DesignData = {
      genre: 'SF',         // new
      theme: '成長',       // legacy
      afterReading: '感動', // legacy
    };
    expect(getFilledCount(design)).toBe(3);
  });

  it('does not count null values', () => {
    const design: DesignData = {
      genre: undefined,
      theme: undefined,
    };
    expect(getFilledCount(design)).toBe(0);
  });

  it('does not count empty string values', () => {
    const design: DesignData = {
      genre: '',
      theme: '',
      tone: '',
    };
    expect(getFilledCount(design)).toBe(0);
  });
});

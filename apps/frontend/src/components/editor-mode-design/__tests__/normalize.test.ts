/**
 * Tests for normalizeDesignUpdate — converts AI's __DESIGN_UPDATE__ JSON
 * to the frontend DesignData shape.
 *
 * Covers: legacy field mapping, new v2 pass-through fields,
 * structured worldBuilding, actGroups, scope parsing, edge cases.
 */
import { describe, it, expect } from 'vitest';
import { normalizeDesignUpdate } from '../normalize';

// ─── Legacy field mapping ────────────────────────────────────────────────────

describe('normalizeDesignUpdate — legacy fields', () => {
  it('maps genre_setting to genre', () => {
    const result = normalizeDesignUpdate({ genre_setting: 'ファンタジー' });
    expect(result.genre).toBe('ファンタジー');
  });

  it('maps genre directly when genre_setting is absent', () => {
    const result = normalizeDesignUpdate({ genre: 'SF' });
    expect(result.genre).toBe('SF');
  });

  it('prefers genre_setting over genre', () => {
    const result = normalizeDesignUpdate({ genre_setting: 'ホラー', genre: 'SF' });
    expect(result.genre).toBe('ホラー');
  });

  it('maps theme to theme', () => {
    const result = normalizeDesignUpdate({ theme: '成長と喪失' });
    expect(result.theme).toBe('成長と喪失');
  });

  it('maps emotion to afterReading', () => {
    const result = normalizeDesignUpdate({ emotion: '切なさ' });
    expect(result.afterReading).toBe('切なさ');
  });

  it('maps afterReading directly', () => {
    const result = normalizeDesignUpdate({ afterReading: '温かさ' });
    expect(result.afterReading).toBe('温かさ');
  });

  it('maps conflict', () => {
    const result = normalizeDesignUpdate({ conflict: '主人公の内面的葛藤' });
    expect(result.conflict).toBe('主人公の内面的葛藤');
  });

  it('maps plot to plotOutline', () => {
    const result = normalizeDesignUpdate({ plot: '旅に出る物語' });
    expect(result.plotOutline).toBe('旅に出る物語');
  });

  it('maps plotOutline directly', () => {
    const result = normalizeDesignUpdate({ plotOutline: '直接プロット' });
    expect(result.plotOutline).toBe('直接プロット');
  });

  it('maps tone', () => {
    const result = normalizeDesignUpdate({ tone: 'ダークで詩的' });
    expect(result.tone).toBe('ダークで詩的');
  });
});

// ─── New v2 pass-through fields ──────────────────────────────────────────────

describe('normalizeDesignUpdate — v2 pass-through fields', () => {
  it('passes through coreMessage', () => {
    const result = normalizeDesignUpdate({ coreMessage: '忘れることは選び直すこと' });
    expect(result.coreMessage).toBe('忘れることは選び直すこと');
  });

  it('passes through targetEmotions', () => {
    const result = normalizeDesignUpdate({ targetEmotions: '切なさ→希望→驚き' });
    expect(result.targetEmotions).toBe('切なさ→希望→驚き');
  });

  it('passes through readerJourney', () => {
    const result = normalizeDesignUpdate({ readerJourney: '序盤は好奇心、中盤で共感' });
    expect(result.readerJourney).toBe('序盤は好奇心、中盤で共感');
  });

  it('passes through readerOneLiner', () => {
    const result = normalizeDesignUpdate({ readerOneLiner: '忘れていた大切なものを思い出す物語' });
    expect(result.readerOneLiner).toBe('忘れていた大切なものを思い出す物語');
  });

  it('passes through title', () => {
    const result = normalizeDesignUpdate({ title: '夜明けの水晶' });
    expect(result.title).toBe('夜明けの水晶');
  });

  it('passes through synopsis', () => {
    const result = normalizeDesignUpdate({ synopsis: '崩壊する世界を旅する少女の物語' });
    expect(result.synopsis).toBe('崩壊する世界を旅する少女の物語');
  });

  it('passes through structureTemplate', () => {
    const result = normalizeDesignUpdate({ structureTemplate: 'kishotenketsu' });
    expect(result.structureTemplate).toBe('kishotenketsu');
  });

  it('ignores null string values for pass-through fields', () => {
    const result = normalizeDesignUpdate({
      coreMessage: 'null',
      targetEmotions: 'null',
      title: 'null',
    });
    expect(result.coreMessage).toBeUndefined();
    expect(result.targetEmotions).toBeUndefined();
    expect(result.title).toBeUndefined();
  });
});

// ─── Protagonist ─────────────────────────────────────────────────────────────

describe('normalizeDesignUpdate — protagonist', () => {
  it('wraps string protagonist into object', () => {
    const result = normalizeDesignUpdate({ protagonist: 'リーナ' });
    expect(result.protagonist).toEqual({
      name: 'リーナ',
      role: '',
      personality: '',
      speechStyle: '',
    });
  });

  it('passes through object protagonist', () => {
    const prot = { name: 'カイ', role: '相棒', personality: '皮肉屋', speechStyle: 'ぶっきらぼう' };
    const result = normalizeDesignUpdate({ protagonist: prot });
    expect(result.protagonist).toEqual(prot);
  });

  it('ignores null protagonist', () => {
    const result = normalizeDesignUpdate({ protagonist: 'null' });
    expect(result.protagonist).toBeUndefined();
  });
});

// ─── Characters ──────────────────────────────────────────────────────────────

describe('normalizeDesignUpdate — characters', () => {
  it('passes through array of characters', () => {
    const chars = [
      { name: 'リーナ', role: '主人公', firstPerson: 'わたし' },
      { name: 'カイ', role: '相棒', firstPerson: '俺' },
    ];
    const result = normalizeDesignUpdate({ characters: chars });
    expect(result.characters).toEqual(chars);
  });

  it('passes through string characters (legacy)', () => {
    const result = normalizeDesignUpdate({ characters: 'リーナ、カイ' });
    expect(result.characters).toBe('リーナ、カイ');
  });

  it('ignores null characters', () => {
    const result = normalizeDesignUpdate({ characters: 'null' });
    expect(result.characters).toBeUndefined();
  });

  it('ignores empty array', () => {
    // Empty array is still valid — it just means no characters yet
    const result = normalizeDesignUpdate({ characters: [] });
    expect(result.characters).toEqual([]);
  });
});

// ─── Structured worldBuilding ────────────────────────────────────────────────

describe('normalizeDesignUpdate — structured worldBuilding', () => {
  it('passes through full structured worldBuilding', () => {
    const wb = {
      basics: { era: '中世', setting: 'ルミナリア大陸', civilizationLevel: '魔法文明' },
      rules: [{ id: 'r1', name: '記憶結晶', description: '人の記憶が水晶に宿る', constraints: '砕けると記憶を失う' }],
      terminology: [{ id: 't1', term: 'ルミナリア', reading: 'るみなりあ', definition: '舞台となる大陸' }],
      history: '千年前に始原の詩人が世界を紡いだ',
      infoAsymmetry: { commonKnowledge: '世界は崩壊しつつある', hiddenTruths: '崩壊の原因は主人公' },
      items: [{ id: 'i1', name: '水晶のペンダント', appearance: '半透明', ability: '記憶を封印', constraints: '一度しか使えない', owner: 'リーナ', narrativeMeaning: '物語の鍵' }],
    };
    const result = normalizeDesignUpdate({ worldBuilding: wb });
    expect(result.worldBuilding).toEqual(wb);
  });

  it('fills in defaults for missing sub-fields in structured worldBuilding', () => {
    const wb = { basics: { era: '現代' } };
    const result = normalizeDesignUpdate({ worldBuilding: wb });
    expect(result.worldBuilding).toEqual({
      basics: { era: '現代' },
      rules: [],
      terminology: [],
      history: '',
      infoAsymmetry: { commonKnowledge: '', hiddenTruths: '' },
      items: [],
    });
  });

  it('falls back to legacy world string as history', () => {
    const result = normalizeDesignUpdate({ world: '中世ファンタジーの世界' });
    expect(result.worldBuilding).toEqual({
      basics: { era: '', setting: '', civilizationLevel: '' },
      rules: [],
      terminology: [],
      history: '中世ファンタジーの世界',
      infoAsymmetry: { commonKnowledge: '', hiddenTruths: '' },
      items: [],
    });
  });

  it('prefers structured worldBuilding over legacy world string', () => {
    const result = normalizeDesignUpdate({
      worldBuilding: { basics: { era: '未来' } },
      world: 'レガシー世界観',
    });
    expect(result.worldBuilding?.basics?.era).toBe('未来');
    expect(result.worldBuilding?.history).toBe('');
  });

  it('handles worldBuilding as string (legacy field name)', () => {
    const result = normalizeDesignUpdate({ worldBuilding: '魔法が存在する世界' });
    expect(result.worldBuilding).toEqual({
      basics: { era: '', setting: '', civilizationLevel: '' },
      rules: [],
      terminology: [],
      history: '魔法が存在する世界',
      infoAsymmetry: { commonKnowledge: '', hiddenTruths: '' },
      items: [],
    });
  });
});

// ─── actGroups ───────────────────────────────────────────────────────────────

describe('normalizeDesignUpdate — actGroups', () => {
  it('passes through valid actGroups array', () => {
    const actGroups = [
      {
        id: 'act1',
        label: '起',
        description: '物語の始まり',
        episodes: [
          { id: 'ep1', title: '第1話: 目覚め', whatHappens: 'リーナが目覚める', whyItHappens: '物語の開始', characters: ['リーナ'], emotionTarget: '好奇心', aiSuggested: true },
        ],
      },
      {
        id: 'act2',
        label: '承',
        description: '展開',
        episodes: [],
      },
    ];
    const result = normalizeDesignUpdate({ actGroups });
    expect(result.actGroups).toEqual(actGroups);
    expect(result.actGroups).toHaveLength(2);
  });

  it('ignores empty actGroups array', () => {
    const result = normalizeDesignUpdate({ actGroups: [] });
    expect(result.actGroups).toBeUndefined();
  });

  it('ignores non-array actGroups', () => {
    const result = normalizeDesignUpdate({ actGroups: 'not an array' });
    expect(result.actGroups).toBeUndefined();
  });
});

// ─── Scope parsing ───────────────────────────────────────────────────────────

describe('normalizeDesignUpdate — scope parsing', () => {
  it('parses "10話 × 3000字" format', () => {
    const result = normalizeDesignUpdate({ scope: '10話 × 3000字' });
    expect(result.episodeCount).toBe(10);
    expect(result.charCountPerEpisode).toBe(3000);
  });

  it('parses "5話 × 2000字" format with different numbers', () => {
    const result = normalizeDesignUpdate({ scope: '5話 × 2000字' });
    expect(result.episodeCount).toBe(5);
    expect(result.charCountPerEpisode).toBe(2000);
  });

  it('parses scope with only episode count', () => {
    const result = normalizeDesignUpdate({ scope: '12話' });
    expect(result.episodeCount).toBe(12);
    expect(result.charCountPerEpisode).toBeUndefined();
  });

  it('parses scope with only char count', () => {
    const result = normalizeDesignUpdate({ scope: '4000字' });
    expect(result.charCountPerEpisode).toBe(4000);
  });

  it('parses bare number as episodeCount', () => {
    const result = normalizeDesignUpdate({ scope: '8' });
    expect(result.episodeCount).toBe(8);
  });

  it('ignores null scope', () => {
    const result = normalizeDesignUpdate({ scope: 'null' });
    expect(result.episodeCount).toBeUndefined();
    expect(result.charCountPerEpisode).toBeUndefined();
  });

  it('handles direct numeric episodeCount', () => {
    const result = normalizeDesignUpdate({ episodeCount: 15 });
    expect(result.episodeCount).toBe(15);
  });

  it('handles direct numeric charCountPerEpisode', () => {
    const result = normalizeDesignUpdate({ charCountPerEpisode: 5000 });
    expect(result.charCountPerEpisode).toBe(5000);
  });

  it('direct numeric overrides scope parsing', () => {
    const result = normalizeDesignUpdate({ scope: '10話', episodeCount: 20 });
    expect(result.episodeCount).toBe(20);
  });
});

// ─── Null / undefined handling ───────────────────────────────────────────────

describe('normalizeDesignUpdate — null/undefined handling', () => {
  it('returns empty object for empty input', () => {
    const result = normalizeDesignUpdate({});
    expect(result).toEqual({});
  });

  it('ignores fields set to "null" string', () => {
    const result = normalizeDesignUpdate({
      genre_setting: 'null',
      theme: 'null',
      emotion: 'null',
      conflict: 'null',
      tone: 'null',
    });
    expect(result.genre).toBeUndefined();
    expect(result.theme).toBeUndefined();
    expect(result.afterReading).toBeUndefined();
    expect(result.conflict).toBeUndefined();
    expect(result.tone).toBeUndefined();
  });

  it('ignores undefined values', () => {
    const result = normalizeDesignUpdate({
      genre: undefined,
      title: undefined,
    });
    expect(result.genre).toBeUndefined();
    expect(result.title).toBeUndefined();
  });
});

// ─── Full AI response simulation ─────────────────────────────────────────────

describe('normalizeDesignUpdate — full AI response', () => {
  it('normalizes a complete first-message design response', () => {
    const aiResponse = {
      genre_setting: 'ダークファンタジー',
      theme: '記憶と自己のアイデンティティ',
      emotion: '切なさと温かさ',
      coreMessage: '忘れることは失うことではなく、選び直すこと',
      targetEmotions: '好奇心→共感→驚き→温かい涙',
      readerJourney: '謎への好奇心から主人公への共感へ',
      readerOneLiner: '忘れていた大切なものを思い出す物語',
      protagonist: { name: 'リーナ', role: '主人公', personality: '穏やかで芯が強い', speechStyle: '丁寧語' },
      characters: [
        { name: 'リーナ', role: '主人公', personality: '穏やか', speechStyle: '丁寧語', firstPerson: 'わたし', motivation: '自分を知りたい', background: '記憶喪失' },
        { name: 'カイ', role: '相棒', personality: '皮肉屋', speechStyle: 'ぶっきらぼう', firstPerson: '俺', motivation: '贖罪', background: '元騎士' },
      ],
      conflict: 'リーナの記憶を取り戻すと世界の真実が明かされる恐怖',
      tone: '詩的で静謐',
      scope: '10話 × 3000字',
      title: '夜明けの水晶と忘れられた少女',
      synopsis: '崩壊しつつある幻想世界で記憶を失った少女の旅',
      structureTemplate: 'kishotenketsu',
      actGroups: [
        { id: 'act1', label: '起', description: '出会い', episodes: [{ id: 'ep1', title: '第1話', whatHappens: '目覚め', whyItHappens: '開始', characters: ['リーナ'], emotionTarget: '好奇心', aiSuggested: true }] },
      ],
      worldBuilding: {
        basics: { era: '中世風', setting: 'ルミナリア大陸', civilizationLevel: '魔法文明の末期' },
        rules: [{ id: 'r1', name: '記憶結晶', description: '記憶が水晶に宿る', constraints: '砕けると失われる' }],
        terminology: [{ id: 't1', term: 'ルミナリア', reading: 'るみなりあ', definition: '舞台' }],
        history: '千年前に詩人が世界を紡いだ',
        infoAsymmetry: { commonKnowledge: '崩壊が進行中', hiddenTruths: '原因は主人公' },
        items: [],
      },
    };

    const result = normalizeDesignUpdate(aiResponse);

    expect(result.genre).toBe('ダークファンタジー');
    expect(result.theme).toBe('記憶と自己のアイデンティティ');
    expect(result.afterReading).toBe('切なさと温かさ');
    expect(result.coreMessage).toBe('忘れることは失うことではなく、選び直すこと');
    expect(result.targetEmotions).toBe('好奇心→共感→驚き→温かい涙');
    expect(result.readerJourney).toBe('謎への好奇心から主人公への共感へ');
    expect(result.readerOneLiner).toBe('忘れていた大切なものを思い出す物語');
    expect(result.title).toBe('夜明けの水晶と忘れられた少女');
    expect(result.synopsis).toBe('崩壊しつつある幻想世界で記憶を失った少女の旅');
    expect(result.structureTemplate).toBe('kishotenketsu');
    expect(result.tone).toBe('詩的で静謐');
    expect(result.conflict).toBe('リーナの記憶を取り戻すと世界の真実が明かされる恐怖');
    expect(result.episodeCount).toBe(10);
    expect(result.charCountPerEpisode).toBe(3000);
    expect(result.protagonist && typeof result.protagonist === 'object' && 'name' in result.protagonist ? result.protagonist.name : undefined).toBe('リーナ');
    expect(result.characters).toHaveLength(2);
    expect(result.actGroups).toHaveLength(1);
    expect(result.actGroups![0].label).toBe('起');
    expect(result.worldBuilding?.basics?.era).toBe('中世風');
    expect(result.worldBuilding?.rules).toHaveLength(1);
    expect(result.worldBuilding?.terminology).toHaveLength(1);
  });

  it('normalizes a partial refinement response (only changed fields)', () => {
    const refinement = {
      characters: [
        { name: 'カイ', role: '相棒', personality: '皮肉屋だが情深い', speechStyle: 'ぶっきらぼう', firstPerson: '俺', motivation: '贖罪と真実への恐怖', background: '元騎士、世界崩壊の引き金を引いた' },
      ],
    };

    const result = normalizeDesignUpdate(refinement);

    expect(result.characters).toHaveLength(1);
    expect(result.characters![0].motivation).toBe('贖罪と真実への恐怖');
    // Other fields should not be set
    expect(result.genre).toBeUndefined();
    expect(result.title).toBeUndefined();
    expect(result.actGroups).toBeUndefined();
  });
});

// ─── Multi-update merge simulation ───────────────────────────────────────────

describe('normalizeDesignUpdate — sequential merge (simulating extractMergedDesignUpdates)', () => {
  /** Helper: merge multiple raw AI updates in order, simulating the backend merge logic */
  function mergeUpdates(...updates: any[]): Partial<import('../types').DesignData> {
    let merged: Partial<import('../types').DesignData> = {};
    for (const raw of updates) {
      const normalized = normalizeDesignUpdate(raw);
      for (const [k, v] of Object.entries(normalized)) {
        if (v !== undefined && v !== null) {
          (merged as any)[k] = v;
        }
      }
    }
    return merged;
  }

  it('merges initial design + refinement correctly', () => {
    const initial = {
      title: '夜明けの水晶',
      genre_setting: 'ファンタジー',
      characters: [
        { name: 'リーナ', role: '主人公', personality: '穏やか' },
        { name: 'カイ', role: '相棒', personality: '皮肉屋' },
      ],
      scope: '10話 × 3000字',
    };

    const refinement = {
      characters: [
        { name: 'リーナ', role: '主人公', personality: '穏やかだが芯が強い' },
        { name: 'カイ', role: '相棒', personality: '皮肉屋だが情深い' },
        { name: 'セラ', role: '案内人', personality: '謎めいた' },
      ],
    };

    const result = mergeUpdates(initial, refinement);

    // Title should come from initial
    expect(result.title).toBe('夜明けの水晶');
    expect(result.genre).toBe('ファンタジー');
    // Characters should be overwritten by refinement (3 chars)
    expect(result.characters).toHaveLength(3);
    expect(result.characters![0].personality).toBe('穏やかだが芯が強い');
    expect(result.characters![2].name).toBe('セラ');
    // Scope from initial
    expect(result.episodeCount).toBe(10);
    expect(result.charCountPerEpisode).toBe(3000);
  });

  it('later updates override earlier ones for same field', () => {
    const v1 = { title: '旧タイトル', tone: 'ダーク' };
    const v2 = { title: '新タイトル' };

    const result = mergeUpdates(v1, v2);

    expect(result.title).toBe('新タイトル');
    expect(result.tone).toBe('ダーク'); // not overwritten
  });

  it('preserves fields from initial when refinement has different fields', () => {
    const initial = {
      title: 'テスト作品',
      genre_setting: 'SF',
      coreMessage: 'テーマA',
      worldBuilding: {
        basics: { era: '未来', setting: '宇宙', civilizationLevel: '高度' },
        rules: [],
        terminology: [],
        history: '',
        infoAsymmetry: { commonKnowledge: '', hiddenTruths: '' },
        items: [],
      },
    };

    const refinement = {
      conflict: '新しい葛藤',
      targetEmotions: '驚き→感動',
    };

    const result = mergeUpdates(initial, refinement);

    // Initial fields preserved
    expect(result.title).toBe('テスト作品');
    expect(result.genre).toBe('SF');
    expect(result.coreMessage).toBe('テーマA');
    expect(result.worldBuilding?.basics?.era).toBe('未来');
    // Refinement fields added
    expect(result.conflict).toBe('新しい葛藤');
    expect(result.targetEmotions).toBe('驚き→感動');
  });

  it('handles three sequential updates', () => {
    const v1 = { title: 'v1', genre_setting: 'ファンタジー' };
    const v2 = { tone: 'ダーク', conflict: '葛藤A' };
    const v3 = { title: 'v3', conflict: '葛藤B (改良)' };

    const result = mergeUpdates(v1, v2, v3);

    expect(result.title).toBe('v3'); // latest
    expect(result.genre).toBe('ファンタジー'); // from v1
    expect(result.tone).toBe('ダーク'); // from v2
    expect(result.conflict).toBe('葛藤B (改良)'); // v3 overrides v2
  });

  it('handles empty updates gracefully', () => {
    const initial = { title: '作品' };
    const empty = {};

    const result = mergeUpdates(initial, empty);

    expect(result.title).toBe('作品');
  });
});

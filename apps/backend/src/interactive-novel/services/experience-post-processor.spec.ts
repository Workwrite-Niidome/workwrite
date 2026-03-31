import {
  buildEpisodeMap,
  findEpisodeBoundaries,
  fixInterEpisodeConnections,
  fixBrokenReferences,
  fixDeadEnds,
  normalizeSpeakers,
  fixIntroTarget,
  splitMultiParagraphBlocks,
  postProcessExperienceScript,
} from './experience-post-processor';

describe('buildEpisodeMap', () => {
  it('should group scene IDs by episode number', () => {
    const ids = ['ep1_opening', 'ep1_cafe', 'ep2_morning', 'ep2_night', 'ep3_end'];
    const result = buildEpisodeMap(ids);
    expect(result).toEqual({
      1: ['ep1_opening', 'ep1_cafe'],
      2: ['ep2_morning', 'ep2_night'],
      3: ['ep3_end'],
    });
  });

  it('should ignore non-episode IDs', () => {
    const ids = ['ep1_opening', 'bridge_scene', 'random'];
    const result = buildEpisodeMap(ids);
    expect(result).toEqual({ 1: ['ep1_opening'] });
  });

  it('should return empty for empty input', () => {
    expect(buildEpisodeMap([])).toEqual({});
  });
});

describe('findEpisodeBoundaries', () => {
  it('should find first and last scene in a linear chain', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [], continues: 'ep1_b' },
      ep1_b: { blocks: [], continues: 'ep1_c' },
      ep1_c: { blocks: [] },
    };
    const epScenes = { 1: ['ep1_a', 'ep1_b', 'ep1_c'] };
    const { first, last } = findEpisodeBoundaries(scenes, epScenes);
    expect(first[1]).toBe('ep1_a');
    expect(last[1]).toBe('ep1_c');
  });

  it('should handle single scene episode', () => {
    const scenes: Record<string, any> = {
      ep5_only: { blocks: [] },
    };
    const epScenes = { 5: ['ep5_only'] };
    const { first, last } = findEpisodeBoundaries(scenes, epScenes);
    expect(first[5]).toBe('ep5_only');
    expect(last[5]).toBe('ep5_only');
  });

  it('should handle branching (perspective scene not in main chain)', () => {
    const scenes: Record<string, any> = {
      ep2_start: { blocks: [], continues: 'ep2_mid' },
      ep2_mid: { blocks: [], continues: 'ep2_end' },
      ep2_end: { blocks: [] },
      ep2_perspective_aoi: { blocks: [] }, // not continued to
    };
    const epScenes = { 2: ['ep2_start', 'ep2_mid', 'ep2_end', 'ep2_perspective_aoi'] };
    const { first, last } = findEpisodeBoundaries(scenes, epScenes);
    // Both ep2_start and ep2_perspective_aoi are roots (not continued to)
    // first should be one of the roots
    expect(['ep2_start', 'ep2_perspective_aoi']).toContain(first[2]);
    expect(last[2]).toBe('ep2_end');
  });
});

describe('fixInterEpisodeConnections', () => {
  it('should bridge disconnected episodes with scene-break', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [{ type: 'original', text: 'x' }] },
      ep2_a: { blocks: [{ type: 'original', text: 'y' }] },
    };
    const epFirst = { 1: 'ep1_a', 2: 'ep2_a' };
    const epLast = { 1: 'ep1_a', 2: 'ep2_a' };

    const fixed = fixInterEpisodeConnections(scenes, 2, epFirst, epLast);

    expect(fixed).toBe(1);
    expect(scenes['ep1_a'].continues).toBe('ep1_to_ep2');
    expect(scenes['ep1_to_ep2']).toBeDefined();
    expect(scenes['ep1_to_ep2'].blocks[0].type).toBe('scene-break');
    expect(scenes['ep1_to_ep2'].continues).toBe('ep2_a');
  });

  it('should not bridge already connected episodes', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [], continues: 'ep2_a' },
      ep2_a: { blocks: [] },
    };
    const epFirst = { 1: 'ep1_a', 2: 'ep2_a' };
    const epLast = { 1: 'ep1_a', 2: 'ep2_a' };

    const fixed = fixInterEpisodeConnections(scenes, 2, epFirst, epLast);
    expect(fixed).toBe(0);
  });

  it('should bridge when continues points to valid but non-next-ep scene', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [], continues: 'ep1_b' },
      ep1_b: { blocks: [] }, // dead end within ep1
      ep2_a: { blocks: [] },
    };
    const epFirst = { 1: 'ep1_a', 2: 'ep2_a' };
    const epLast = { 1: 'ep1_b', 2: 'ep2_a' };

    const fixed = fixInterEpisodeConnections(scenes, 2, epFirst, epLast);

    // ep1_b is the last scene, it has no continues and no awareness -> should be bridged
    expect(fixed).toBe(1);
    expect(scenes['ep1_b'].continues).toBe('ep1_to_ep2');
  });

  it('should handle awareness-connected episodes', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [], awareness: [{ text: 'next', target: 'ep2_a' }] },
      ep2_a: { blocks: [] },
    };
    const epFirst = { 1: 'ep1_a', 2: 'ep2_a' };
    const epLast = { 1: 'ep1_a', 2: 'ep2_a' };

    const fixed = fixInterEpisodeConnections(scenes, 2, epFirst, epLast);
    expect(fixed).toBe(0); // Already connected via awareness
  });

  it('should bridge 3 episodes correctly', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [] },
      ep2_a: { blocks: [] },
      ep3_a: { blocks: [] },
    };
    const epFirst = { 1: 'ep1_a', 2: 'ep2_a', 3: 'ep3_a' };
    const epLast = { 1: 'ep1_a', 2: 'ep2_a', 3: 'ep3_a' };

    const fixed = fixInterEpisodeConnections(scenes, 3, epFirst, epLast);
    expect(fixed).toBe(2);
    expect(scenes['ep1_to_ep2'].continues).toBe('ep2_a');
    expect(scenes['ep2_to_ep3'].continues).toBe('ep3_a');
  });
});

describe('fixBrokenReferences', () => {
  it('should fix continues pointing to non-existent scene by fuzzy match', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [], continues: 'ep2_morning' },
      ep2_morning_ritual: { blocks: [] },
    };
    const epFirst = { 1: 'ep1_a', 2: 'ep2_morning_ritual' };

    const fixed = fixBrokenReferences(scenes, epFirst);
    expect(fixed).toBe(1);
    expect(scenes['ep1_a'].continues).toBe('ep2_morning_ritual');
  });

  it('should fall back to next episode first scene when no fuzzy match', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [], continues: 'ep2_nonexistent_xyz' },
      ep2_start: { blocks: [] },
    };
    const epFirst = { 1: 'ep1_a', 2: 'ep2_start' };

    const fixed = fixBrokenReferences(scenes, epFirst);
    expect(fixed).toBe(1);
    expect(scenes['ep1_a'].continues).toBe('ep2_start');
  });

  it('should fix broken awareness targets', () => {
    const scenes: Record<string, any> = {
      ep3_a: { blocks: [], awareness: [{ text: 'look', target: 'ep3_perspective_aoi' }] },
      ep3_perspective_aoi_view: { blocks: [] },
    };
    const epFirst = { 3: 'ep3_a' };

    const fixed = fixBrokenReferences(scenes, epFirst);
    expect(fixed).toBe(1);
    expect(scenes['ep3_a'].awareness[0].target).toBe('ep3_perspective_aoi_view');
  });

  it('should remove awareness with completely broken targets', () => {
    const scenes: Record<string, any> = {
      ep5_a: { blocks: [], awareness: [
        { text: 'valid', target: 'ep5_b' },
        { text: 'broken', target: 'ep99_nonexistent' },
      ]},
      ep5_b: { blocks: [] },
    };
    const epFirst = { 5: 'ep5_a' };

    fixBrokenReferences(scenes, epFirst);
    expect(scenes['ep5_a'].awareness).toHaveLength(1);
    expect(scenes['ep5_a'].awareness[0].text).toBe('valid');
  });

  it('should not modify valid references', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [], continues: 'ep1_b', awareness: [{ text: 'x', target: 'ep1_c' }] },
      ep1_b: { blocks: [] },
      ep1_c: { blocks: [] },
    };
    const epFirst = { 1: 'ep1_a' };

    const fixed = fixBrokenReferences(scenes, epFirst);
    expect(fixed).toBe(0);
  });

  it('should set continues to null for last episode with no match', () => {
    const scenes: Record<string, any> = {
      ep21_a: { blocks: [], continues: 'ep22_nonexistent' },
    };
    const epFirst = {}; // no ep22

    fixBrokenReferences(scenes, epFirst);
    expect(scenes['ep21_a'].continues).toBeNull();
  });
});

describe('fixDeadEnds', () => {
  it('should bridge dead-end scenes to next episode', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [] },
      ep2_a: { blocks: [] },
    };
    const epScenes = { 1: ['ep1_a'], 2: ['ep2_a'] };
    const epFirst = { 1: 'ep1_a', 2: 'ep2_a' };

    const fixed = fixDeadEnds(scenes, epScenes, epFirst);
    expect(fixed).toBe(1);
    expect(scenes['ep1_a'].continues).toBe('ep1_a_bridge');
    expect(scenes['ep1_a_bridge'].continues).toBe('ep2_a');
  });

  it('should not bridge dead ends in the final episode', () => {
    const scenes: Record<string, any> = {
      ep3_end: { blocks: [] },
    };
    const epScenes = { 3: ['ep3_end'] };
    const epFirst = { 3: 'ep3_end' };

    const fixed = fixDeadEnds(scenes, epScenes, epFirst);
    expect(fixed).toBe(0);
  });

  it('should not bridge scenes that have awareness', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [], awareness: [{ text: 'x', target: 'ep1_b' }] },
      ep1_b: { blocks: [] },
      ep2_a: { blocks: [] },
    };
    const epScenes = { 1: ['ep1_a', 'ep1_b'], 2: ['ep2_a'] };
    const epFirst = { 1: 'ep1_a', 2: 'ep2_a' };

    const fixed = fixDeadEnds(scenes, epScenes, epFirst);
    // ep1_a has awareness, ep1_b is dead end
    expect(fixed).toBe(1); // only ep1_b gets bridged
    expect(scenes['ep1_a'].continues).toBeUndefined();
  });
});

describe('normalizeSpeakers', () => {
  const characters = [
    { id: '1', name: '綾瀬詩（あやせうた）', role: '主人公', personality: null },
    { id: '2', name: '蒼', role: 'ヒロイン', personality: null },
    { id: '3', name: '小鳥遊偿（たかなしつぐみ）', role: null, personality: null },
    { id: '4', name: '真壁梗介', role: null, personality: null },
  ];

  it('should keep canonical short name unchanged and assign color', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [
        { type: 'dialogue', speaker: '綾瀬詩', text: '「こんにちは」' },
      ]},
    };

    const count = normalizeSpeakers(scenes, characters);
    // '綾瀬詩' is already the canonical short name, so count=0
    expect(count).toBe(0);
    expect(scenes['ep1_a'].blocks[0].speaker).toBe('綾瀬詩');
    expect(scenes['ep1_a'].blocks[0].speakerColor).toMatch(/^hsl\(\d+, 25%, 55%\)$/);
  });

  it('should normalize full name with parenthetical to short name', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [
        { type: 'dialogue', speaker: '綾瀬詩（あやせうた）', text: '「こんにちは」' },
      ]},
    };

    const count = normalizeSpeakers(scenes, characters);
    expect(count).toBe(1);
    expect(scenes['ep1_a'].blocks[0].speaker).toBe('綾瀬詩');
  });

  it('should normalize variant names', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [
        { type: 'dialogue', speaker: '綾瀬', text: '「hi」' },
        { type: 'dialogue', speaker: '真壁', text: '「hi」' },
      ]},
    };

    const count = normalizeSpeakers(scenes, characters);
    // '綾瀬' contains '綾瀬詩'.short='綾瀬詩' — wait, short is first part before （
    // '綾瀬詩（あやせうた）' -> short = '綾瀬詩'
    // '綾瀬' is substring of '綾瀬詩' -> fuzzy match should catch it
    expect(count).toBeGreaterThan(0);
  });

  it('should assign consistent speakerColor', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [
        { type: 'dialogue', speaker: '蒼', text: '「test」' },
        { type: 'dialogue', speaker: '蒼', text: '「test2」' },
      ]},
    };

    normalizeSpeakers(scenes, characters);
    const color1 = scenes['ep1_a'].blocks[0].speakerColor;
    const color2 = scenes['ep1_a'].blocks[1].speakerColor;
    expect(color1).toBe(color2);
    expect(color1).toMatch(/^hsl\(\d+, 25%, 55%\)$/);
  });

  it('should handle unknown speakers gracefully', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [
        { type: 'dialogue', speaker: '謎の人物', text: '「...」' },
      ]},
    };

    normalizeSpeakers(scenes, characters);
    expect(scenes['ep1_a'].blocks[0].speaker).toBe('謎の人物'); // unchanged
    expect(scenes['ep1_a'].blocks[0].speakerColor).toBe('hsl(0, 0%, 55%)');
  });

  it('should not touch non-dialogue blocks', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [
        { type: 'original', text: 'narrative' },
        { type: 'environment', text: 'rain' },
      ]},
    };

    const count = normalizeSpeakers(scenes, characters);
    expect(count).toBe(0);
  });
});

describe('fixIntroTarget', () => {
  it('should fix broken intro awareness target (object form)', () => {
    const scenes: Record<string, any> = {
      ep1_opening: { blocks: [] },
    };
    const intro = { blocks: [], awareness: { text: 'enter', target: 'broken_ref' } };

    fixIntroTarget(intro, scenes, { 1: 'ep1_opening' });
    expect(intro.awareness.target).toBe('ep1_opening');
  });

  it('should fix broken intro awareness target (array form)', () => {
    const scenes: Record<string, any> = {
      ep1_start: { blocks: [] },
    };
    const intro = { blocks: [], awareness: [{ text: 'go', target: 'nonexistent' }] };

    fixIntroTarget(intro, scenes, { 1: 'ep1_start' });
    expect(intro.awareness[0].target).toBe('ep1_start');
  });

  it('should not modify valid intro target', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [] },
    };
    const intro = { blocks: [], awareness: { text: 'go', target: 'ep1_a' } };

    fixIntroTarget(intro, scenes, { 1: 'ep1_a' });
    expect(intro.awareness.target).toBe('ep1_a');
  });

  it('should handle null introData', () => {
    expect(() => fixIntroTarget(null, {}, {})).not.toThrow();
  });
});

describe('splitMultiParagraphBlocks', () => {
  it('should split blocks containing newlines into separate blocks', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [
        { type: 'original', text: '最初の段落。\n\n　二番目の段落。' },
      ]},
    };

    const split = splitMultiParagraphBlocks(scenes);
    expect(split).toBeGreaterThan(0);
    expect(scenes['ep1_a'].blocks.length).toBe(2);
    expect(scenes['ep1_a'].blocks[0].text).toBe('最初の段落。');
    expect(scenes['ep1_a'].blocks[1].text).toBe('二番目の段落。');
  });

  it('should not split dialogue blocks', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [
        { type: 'dialogue', speaker: '蒼', text: '「こんにちは。\nお元気ですか」' },
      ]},
    };

    const split = splitMultiParagraphBlocks(scenes);
    expect(split).toBe(0);
    expect(scenes['ep1_a'].blocks.length).toBe(1);
  });

  it('should not split scene-break blocks', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [
        { type: 'scene-break', text: '* * *' },
      ]},
    };

    const split = splitMultiParagraphBlocks(scenes);
    expect(split).toBe(0);
  });

  it('should handle triple newlines and trim whitespace', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [
        { type: 'original', text: '段落A。\n\n\n　段落B。\n\n段落C。' },
      ]},
    };

    const split = splitMultiParagraphBlocks(scenes);
    expect(scenes['ep1_a'].blocks.length).toBe(3);
    expect(scenes['ep1_a'].blocks[0].text).toBe('段落A。');
    expect(scenes['ep1_a'].blocks[1].text).toBe('段落B。');
    expect(scenes['ep1_a'].blocks[2].text).toBe('段落C。');
  });

  it('should filter out empty paragraphs after split', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [
        { type: 'original', text: '\n\n段落A。\n\n\n\n' },
      ]},
    };

    const split = splitMultiParagraphBlocks(scenes);
    expect(scenes['ep1_a'].blocks.length).toBe(1);
    expect(scenes['ep1_a'].blocks[0].text).toBe('段落A。');
  });

  it('should preserve block type for each split piece', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [
        { type: 'environment', text: '雨が降る。\n\n風が吹く。' },
      ]},
    };

    splitMultiParagraphBlocks(scenes);
    expect(scenes['ep1_a'].blocks[0].type).toBe('environment');
    expect(scenes['ep1_a'].blocks[1].type).toBe('environment');
  });

  it('should not modify blocks without newlines', () => {
    const scenes: Record<string, any> = {
      ep1_a: { blocks: [
        { type: 'original', text: '改行なしのテキスト。' },
        { type: 'dialogue', speaker: '蒼', text: '「台詞」' },
      ]},
    };

    const split = splitMultiParagraphBlocks(scenes);
    expect(split).toBe(0);
    expect(scenes['ep1_a'].blocks.length).toBe(2);
  });
});

describe('postProcessExperienceScript (integration)', () => {
  it('should fix a realistic broken script end-to-end', () => {
    const scenes: Record<string, any> = {
      // ep1: chain of 3 scenes, last one has broken continues
      ep1_morning: { blocks: [{ type: 'original', text: '朝' }], continues: 'ep1_cafe' },
      ep1_cafe: { blocks: [{ type: 'dialogue', speaker: '綾瀬詩', text: '「hi」' }], continues: 'ep1_night' },
      ep1_night: { blocks: [{ type: 'original', text: '夜' }], continues: 'ep2_dawn' }, // broken ref
      // ep2: 2 scenes, disconnected
      ep2_bookstore: { blocks: [{ type: 'dialogue', speaker: '蒼', text: '「本」' }], continues: 'ep2_evening' },
      ep2_evening: { blocks: [{ type: 'original', text: '夕方' }] }, // dead end
      // ep3: 1 scene
      ep3_finale: { blocks: [{ type: 'dialogue', speaker: '真壁梗介', text: '「終」' }] },
    };
    const intro = { blocks: [{ type: 'original', text: 'intro' }], awareness: { text: 'start', target: 'scene1' } };
    const characters = [
      { id: '1', name: '綾瀬詩（あやせうた）', role: '主人公', personality: null },
      { id: '2', name: '蒼', role: null, personality: null },
      { id: '3', name: '真壁梗介', role: null, personality: null },
    ];

    const result = postProcessExperienceScript(scenes, intro, 3, characters);

    // Intro target should be fixed
    expect(intro.awareness.target).toBe('ep1_morning');

    // Should be able to traverse from ep1 to ep3
    const reachable = new Set<string>();
    const queue = ['ep1_morning'];
    while (queue.length > 0) {
      const sid = queue.shift()!;
      if (reachable.has(sid) || !scenes[sid]) continue;
      reachable.add(sid);
      if (scenes[sid].continues && scenes[scenes[sid].continues]) {
        queue.push(scenes[sid].continues);
      }
      for (const aw of (scenes[sid].awareness || [])) {
        if (aw.target && scenes[aw.target]) queue.push(aw.target);
      }
    }

    // All original scenes should be reachable
    expect(reachable).toContain('ep1_morning');
    expect(reachable).toContain('ep1_cafe');
    expect(reachable).toContain('ep1_night');
    expect(reachable).toContain('ep2_bookstore');
    expect(reachable).toContain('ep3_finale');

    // Speaker names should have colors
    expect(scenes['ep1_cafe'].blocks[0].speakerColor).toBeDefined();
    expect(scenes['ep2_bookstore'].blocks[0].speakerColor).toBeDefined();

    // No broken references
    for (const [sid, sc] of Object.entries(scenes)) {
      if (sc.continues) {
        expect(scenes[sc.continues]).toBeDefined();
      }
    }
  });
});

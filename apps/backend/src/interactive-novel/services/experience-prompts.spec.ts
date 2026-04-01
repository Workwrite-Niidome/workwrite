import {
  buildStage1Prompt,
  buildStage2SystemPrompt,
  buildStage2EpisodePrompt,
  PROTOTYPE_EP1_EXAMPLE,
} from './experience-prompts';

describe('buildStage1Prompt', () => {
  const summaries = '第1話 (5000字): 朝、コーヒー...';
  const charList = '詩(綾瀬詩): 主人公 / 蒼: ヒロイン';

  it('should contain movie director framing', () => {
    const prompt = buildStage1Prompt(summaries, charList);
    expect(prompt).toContain('映画監督');
    expect(prompt).not.toContain('編集者です');
  });

  it('should contain moments/awareness_pairs/senses/cut structure', () => {
    const prompt = buildStage1Prompt(summaries, charList);
    expect(prompt).toContain('moments');
    expect(prompt).toContain('awareness_pairs');
    expect(prompt).toContain('senses');
    expect(prompt).toContain('cut');
  });

  it('should contain core principle', () => {
    const prompt = buildStage1Prompt(summaries, charList);
    expect(prompt).toContain('結果は変わらないが、過程が変わる');
  });

  it('should include genre when provided', () => {
    const prompt = buildStage1Prompt(summaries, charList, '純文学');
    expect(prompt).toContain('純文学');
  });

  it('should include episode summaries', () => {
    const prompt = buildStage1Prompt(summaries, charList);
    expect(prompt).toContain('第1話 (5000字)');
  });

  it('should instruct to select moments not include full text', () => {
    const prompt = buildStage1Prompt(summaries, charList);
    expect(prompt).toContain('全文を体験に入れる必要はありません');
    expect(prompt).toContain('最も美しい瞬間');
  });

  it('should instruct awareness as sensory 15-25 char', () => {
    const prompt = buildStage1Prompt(summaries, charList);
    expect(prompt).toContain('15-25文字');
    expect(prompt).toContain('五感的');
  });
});

describe('buildStage2SystemPrompt', () => {
  it('should contain movie editor framing', () => {
    const prompt = buildStage2SystemPrompt();
    expect(prompt).toContain('映画編集者');
  });

  it('should contain the most important rule: do not include full text', () => {
    const prompt = buildStage2SystemPrompt();
    expect(prompt).toContain('原文の全文を入れてはいけない');
  });

  it('should contain prototype as few-shot example', () => {
    const prompt = buildStage2SystemPrompt();
    expect(prompt).toContain('ep1_coffee');
    expect(prompt).toContain('コーヒーの匂いが、どこかからする。');
    expect(prompt).toContain('布団から抜け出した冷たさが、足の裏に触れる。');
  });

  it('should specify block length: 1-2 sentences, ~80 chars', () => {
    const prompt = buildStage2SystemPrompt();
    expect(prompt).toContain('1-2文');
    expect(prompt).toContain('80文字以内');
  });

  it('should specify awareness must be 2 choices', () => {
    const prompt = buildStage2SystemPrompt();
    expect(prompt).toContain('2択');
  });

  it('should specify speaker as nickname not full name', () => {
    const prompt = buildStage2SystemPrompt();
    expect(prompt).toContain('呼び名');
    expect(prompt).toContain('フルネームは使わない');
  });

  it('should specify environment as single sensory sentence', () => {
    const prompt = buildStage2SystemPrompt();
    expect(prompt).toContain('1文');
    expect(prompt).toContain('身体感覚');
  });

  it('should specify 10-20 scenes per episode', () => {
    const prompt = buildStage2SystemPrompt();
    expect(prompt).toContain('10-20シーン');
  });
});

describe('buildStage2EpisodePrompt', () => {
  const blueprint = { theme: 'test', moments: [], senses: [] };
  const charList = '詩: 主人公';
  const content = '第1話のテキスト。かなり長い文章が続く...';

  it('should include episode number and total', () => {
    const prompt = buildStage2EpisodePrompt(3, 21, blueprint, charList, content, false, false);
    expect(prompt).toContain('第3話（全21話中）');
  });

  it('should include intro instructions for first episode', () => {
    const prompt = buildStage2EpisodePrompt(1, 21, blueprint, charList, content, true, false);
    expect(prompt).toContain('introセクション');
  });

  it('should include ending instructions for last episode', () => {
    const prompt = buildStage2EpisodePrompt(21, 21, blueprint, charList, content, false, true);
    expect(prompt).toContain('エンディングの余韻');
  });

  it('should include blueprint as JSON', () => {
    const prompt = buildStage2EpisodePrompt(1, 21, blueprint, charList, content, false, false);
    expect(prompt).toContain('"theme"');
    expect(prompt).toContain('test');
  });

  it('should enforce scene ID prefix', () => {
    const prompt = buildStage2EpisodePrompt(5, 21, blueprint, charList, content, false, false);
    expect(prompt).toContain('ep5_');
  });

  it('should include previous memory when provided', () => {
    const prompt = buildStage2EpisodePrompt(3, 21, blueprint, charList, content, false, false, '書きたい。でも、書けない。');
    expect(prompt).toContain('書きたい。でも、書けない。');
    expect(prompt).toContain('前話からの記憶');
  });

  it('should not include memory section when not provided', () => {
    const prompt = buildStage2EpisodePrompt(1, 21, blueprint, charList, content, true, false);
    expect(prompt).not.toContain('前話からの記憶');
  });

  it('should emphasize no full text, 1-2 sentences per block', () => {
    const prompt = buildStage2EpisodePrompt(1, 21, blueprint, charList, content, false, false);
    expect(prompt).toContain('原文の全文を入れない');
    expect(prompt).toContain('1-2文');
  });

  it('should emphasize awareness must be 2 choices', () => {
    const prompt = buildStage2EpisodePrompt(1, 21, blueprint, charList, content, false, false);
    expect(prompt).toContain('2択');
  });

  it('should truncate episode content to 8000 chars', () => {
    const longContent = 'あ'.repeat(10000);
    const prompt = buildStage2EpisodePrompt(1, 21, blueprint, charList, longContent, false, false);
    // The prompt should contain at most 8000 chars of the content
    const contentMatch = prompt.match(/=== 第1話 本文 ===([\s\S]*)$/);
    expect(contentMatch).toBeTruthy();
    expect(contentMatch![1].trim().length).toBe(8000);
  });
});

describe('PROTOTYPE_EP1_EXAMPLE', () => {
  it('should be valid JSON', () => {
    const parsed = JSON.parse(PROTOTYPE_EP1_EXAMPLE);
    expect(parsed.intro).toBeDefined();
    expect(parsed.scenes).toBeDefined();
  });

  it('should have short blocks (1-2 sentences)', () => {
    const parsed = JSON.parse(PROTOTYPE_EP1_EXAMPLE);
    for (const block of parsed.intro.blocks) {
      // Each block should be under 120 chars (roughly 1-2 sentences)
      expect(block.text.length).toBeLessThan(120);
    }
  });

  it('should have awareness with 2 choices', () => {
    const parsed = JSON.parse(PROTOTYPE_EP1_EXAMPLE);
    const coffeeScene = parsed.scenes.ep1_coffee;
    expect(coffeeScene.awareness).toHaveLength(2);
  });

  it('should use short speaker names', () => {
    const parsed = JSON.parse(PROTOTYPE_EP1_EXAMPLE);
    const lineScene = parsed.scenes.ep1_line;
    const speakers = lineScene.blocks
      .filter((b: any) => b.speaker)
      .map((b: any) => b.speaker);
    for (const sp of speakers) {
      // No parenthetical, no full name longer than 3 chars
      expect(sp.length).toBeLessThanOrEqual(3);
    }
  });
});

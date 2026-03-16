import { SampleExtractorService } from './sample-extractor.service';

describe('SampleExtractorService', () => {
  let service: SampleExtractorService;

  beforeEach(() => {
    service = new SampleExtractorService();
  });

  it('returns empty samples for empty episodes', () => {
    const result = service.extract([]);
    expect(result.opening).toBe('');
    expect(result.midpoint).toBe('');
    expect(result.climaxRegion).toBe('');
    expect(result.ending).toBe('');
  });

  it('splits single episode into 4 quarters', () => {
    const content = 'A'.repeat(1000) + 'B'.repeat(1000) + 'C'.repeat(1000) + 'D'.repeat(1000);
    const result = service.extract([{ content, title: '第1話', orderIndex: 0 }]);

    expect(result.opening.length).toBeGreaterThan(0);
    expect(result.midpoint.length).toBeGreaterThan(0);
    expect(result.climaxRegion.length).toBeGreaterThan(0);
    expect(result.ending.length).toBeGreaterThan(0);
  });

  it('samples from different episodes for multi-episode works', () => {
    const episodes = Array.from({ length: 10 }, (_, i) => ({
      content: `Episode ${i} content. ` + 'x'.repeat(500),
      title: `第${i + 1}話`,
      orderIndex: i,
    }));

    const result = service.extract(episodes);

    // Opening should be from first episode
    expect(result.opening).toContain('第1話');
    // Ending should be from last episode
    expect(result.ending).toContain('第10話');
    // Midpoint should be from middle
    expect(result.midpoint).toContain('第6話'); // floor(10/2) = 5, 0-indexed = episode 5 -> "第6話"
  });

  it('respects climax hint when provided', () => {
    const episodes = Array.from({ length: 10 }, (_, i) => ({
      content: `Episode ${i} content. ` + 'x'.repeat(500),
      title: `第${i + 1}話`,
      orderIndex: i,
    }));

    const result = service.extractWithClimaxHint(episodes, 3); // climax at episode 3

    expect(result.climaxRegion).toContain('第4話'); // orderIndex 3 -> title "第4話"
  });

  it('falls back to positional heuristic without climax hint', () => {
    const episodes = Array.from({ length: 4 }, (_, i) => ({
      content: `Episode ${i} content. ` + 'x'.repeat(500),
      title: `第${i + 1}話`,
      orderIndex: i,
    }));

    const result = service.extractWithClimaxHint(episodes, undefined);
    const resultDefault = service.extract(episodes);

    expect(result.climaxRegion).toBe(resultDefault.climaxRegion);
  });

  it('includes episode title in sample labels', () => {
    const episodes = [
      { content: 'Opening text here', title: '始まり', orderIndex: 0 },
      { content: 'Ending text here', title: '結末', orderIndex: 1 },
    ];

    const result = service.extract(episodes);

    expect(result.opening).toContain('【始まり】');
    expect(result.ending).toContain('【結末】');
  });
});

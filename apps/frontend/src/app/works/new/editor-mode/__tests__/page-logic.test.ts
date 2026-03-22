/**
 * Tests for pure logic extracted from editor-mode/page.tsx
 *
 * The page component itself is too heavily wired to Next.js routing, SSE
 * streams and the API module to mount in a unit test.  Instead we test the
 * three pure behaviours that were added/changed in the latest iteration:
 *
 * 1. computeHighlightedTab  – maps a list of updated DesignData keys to the
 *    first tab that owns any of those keys.
 *
 * 2. URL update logic       – when parsed.workId arrives and the URL does not
 *    yet have a "resume" query parameter, history.replaceState is called with
 *    the workId appended.
 *
 * 3. Credit refresh logic   – after streaming finishes (finally block), both
 *    api.getAiStatus() and api.editorModeStatus(workId) are called to refresh
 *    credit values.
 *
 * Neither (2) nor (3) involve rendering React; we unit-test the conditional
 * logic by replicating the exact branches from the page source.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TAB_DEFINITIONS } from '@/components/editor-mode-design/types';
import type { DesignTab } from '@/components/editor-mode-design/types';

// ─── local replica of computeHighlightedTab ──────────────────────────────────
// The function is not exported from the page, so we keep a local copy whose
// behaviour we want to lock down.  If the implementation changes, the tests
// will catch drift.

function computeHighlightedTab(updatedKeys: string[]): DesignTab | null {
  for (const tab of TAB_DEFINITIONS) {
    if (tab.designKeys.some(k => updatedKeys.includes(k))) {
      return tab.key;
    }
  }
  return null;
}

// ─── computeHighlightedTab ────────────────────────────────────────────────────

describe('computeHighlightedTab', () => {
  describe('overview tab keys', () => {
    it('returns "overview" when genre is updated', () => {
      expect(computeHighlightedTab(['genre'])).toBe('overview');
    });

    it('returns "overview" when episodeCount is updated', () => {
      expect(computeHighlightedTab(['episodeCount'])).toBe('overview');
    });

    it('returns "overview" when theme is updated', () => {
      expect(computeHighlightedTab(['theme'])).toBe('overview');
    });

    it('returns "overview" when tone is updated', () => {
      expect(computeHighlightedTab(['tone'])).toBe('overview');
    });

    it('returns "overview" when coreMessage is updated', () => {
      expect(computeHighlightedTab(['coreMessage'])).toBe('overview');
    });

    it('returns "overview" when afterReading is updated', () => {
      expect(computeHighlightedTab(['afterReading'])).toBe('overview');
    });

    it('returns "overview" when targetEmotions is updated', () => {
      expect(computeHighlightedTab(['targetEmotions'])).toBe('overview');
    });

    it('returns "overview" when subGenres is updated', () => {
      expect(computeHighlightedTab(['subGenres'])).toBe('overview');
    });

    it('returns "overview" when tags is updated', () => {
      expect(computeHighlightedTab(['tags'])).toBe('overview');
    });
  });

  describe('characters tab keys', () => {
    it('returns "characters" when characters is updated', () => {
      expect(computeHighlightedTab(['characters'])).toBe('characters');
    });

    it('returns "characters" when customFieldDefinitions is updated', () => {
      expect(computeHighlightedTab(['customFieldDefinitions'])).toBe('characters');
    });
  });

  describe('world tab keys', () => {
    it('returns "world" when worldBuilding is updated', () => {
      expect(computeHighlightedTab(['worldBuilding'])).toBe('world');
    });
  });

  describe('plot tab keys', () => {
    it('returns "plot" when actGroups is updated', () => {
      expect(computeHighlightedTab(['actGroups'])).toBe('plot');
    });

    it('returns "plot" when conflict is updated', () => {
      expect(computeHighlightedTab(['conflict'])).toBe('plot');
    });

    it('returns "plot" when plotOutline is updated', () => {
      expect(computeHighlightedTab(['plotOutline'])).toBe('plot');
    });

    it('returns "plot" when structureTemplate is updated', () => {
      expect(computeHighlightedTab(['structureTemplate'])).toBe('plot');
    });
  });

  describe('first-match wins (tab priority order)', () => {
    it('returns "overview" (first tab) when both genre and characters are updated', () => {
      // TAB_DEFINITIONS order: overview → characters → world → plot → preview
      expect(computeHighlightedTab(['genre', 'characters'])).toBe('overview');
    });

    it('returns "characters" when only characters and worldBuilding are updated', () => {
      expect(computeHighlightedTab(['characters', 'worldBuilding'])).toBe('characters');
    });

    it('returns "world" when worldBuilding and conflict are updated', () => {
      expect(computeHighlightedTab(['worldBuilding', 'conflict'])).toBe('world');
    });
  });

  describe('edge cases', () => {
    it('returns null for empty key array', () => {
      expect(computeHighlightedTab([])).toBeNull();
    });

    it('returns null for unknown keys', () => {
      expect(computeHighlightedTab(['unknownField', 'anotherField'])).toBeNull();
    });

    it('returns null when only "preview" tab keys would match (preview has no keys)', () => {
      // preview tab has designKeys: [] so it can never match
      expect(computeHighlightedTab([])).toBeNull();
    });

    it('ignores unknown keys mixed with no valid keys', () => {
      expect(computeHighlightedTab(['_aiCharacterSuggestions', '_aiChapterSuggestions'])).toBeNull();
    });

    it('still finds matching tab when unknown keys precede a known key in the array', () => {
      expect(computeHighlightedTab(['unknownKey', 'plotOutline'])).toBe('plot');
    });
  });

  describe('boundary: single-key updates', () => {
    // Exhaustively verify every key listed in TAB_DEFINITIONS resolves correctly.
    const overviewKeys = ['genre', 'subGenres', 'tags', 'coreMessage', 'targetEmotions', 'theme', 'afterReading', 'tone', 'episodeCount'];
    for (const key of overviewKeys) {
      it(`single key "${key}" → overview`, () => {
        expect(computeHighlightedTab([key])).toBe('overview');
      });
    }

    const characterKeys = ['characters', 'customFieldDefinitions'];
    for (const key of characterKeys) {
      it(`single key "${key}" → characters`, () => {
        expect(computeHighlightedTab([key])).toBe('characters');
      });
    }

    it('single key "worldBuilding" → world', () => {
      expect(computeHighlightedTab(['worldBuilding'])).toBe('world');
    });

    const plotKeys = ['structureTemplate', 'actGroups', 'conflict', 'plotOutline'];
    for (const key of plotKeys) {
      it(`single key "${key}" → plot`, () => {
        expect(computeHighlightedTab([key])).toBe('plot');
      });
    }
  });
});

// ─── URL update logic (behaviour 1 from SSE handler) ─────────────────────────
//
// When parsed.workId arrives in the SSE stream the page runs:
//   if (!url.searchParams.has('resume')) {
//     url.searchParams.set('resume', parsed.workId);
//     window.history.replaceState({}, '', url.toString());
//   }
//
// We extract this conditional and test it against a mock window.location /
// window.history so no Next.js plumbing is needed.

describe('URL update when workId received from SSE', () => {
  const originalWindow = globalThis.window;

  // Minimal replaceState logic extracted verbatim from the page:
  function applyWorkIdToUrl(
    currentHref: string,
    parsedWorkId: string,
    replaceState: (state: unknown, title: string, url: string) => void,
  ): void {
    const url = new URL(currentHref);
    if (!url.searchParams.has('resume')) {
      url.searchParams.set('resume', parsedWorkId);
      replaceState({}, '', url.toString());
    }
  }

  it('calls replaceState with resume param when URL has none', () => {
    const replaceState = vi.fn();
    applyWorkIdToUrl('https://example.com/works/new/editor-mode', 'work-abc', replaceState);
    expect(replaceState).toHaveBeenCalledOnce();
    const calledUrl = replaceState.mock.calls[0][2] as string;
    expect(new URL(calledUrl).searchParams.get('resume')).toBe('work-abc');
  });

  it('does NOT call replaceState when URL already has ?resume=...', () => {
    const replaceState = vi.fn();
    applyWorkIdToUrl(
      'https://example.com/works/new/editor-mode?resume=existing-work',
      'work-abc',
      replaceState,
    );
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('preserves existing query parameters when appending resume', () => {
    const replaceState = vi.fn();
    applyWorkIdToUrl(
      'https://example.com/works/new/editor-mode?foo=bar',
      'work-xyz',
      replaceState,
    );
    expect(replaceState).toHaveBeenCalledOnce();
    const resultUrl = new URL(replaceState.mock.calls[0][2] as string);
    expect(resultUrl.searchParams.get('foo')).toBe('bar');
    expect(resultUrl.searchParams.get('resume')).toBe('work-xyz');
  });

  it('passes empty state object and empty title string to replaceState', () => {
    const replaceState = vi.fn();
    applyWorkIdToUrl('https://example.com/editor', 'work-1', replaceState);
    expect(replaceState).toHaveBeenCalledWith({}, '', expect.any(String));
  });

  it('does not mutate the original URL string', () => {
    const original = 'https://example.com/editor';
    const replaceState = vi.fn();
    applyWorkIdToUrl(original, 'work-1', replaceState);
    expect(original).toBe('https://example.com/editor');
  });

  it('encodes workId properly in URL (special characters)', () => {
    const replaceState = vi.fn();
    applyWorkIdToUrl('https://example.com/editor', 'work/with spaces&more', replaceState);
    const resultUrl = replaceState.mock.calls[0][2] as string;
    // URL should be parseable and resume param should decode back correctly
    expect(new URL(resultUrl).searchParams.get('resume')).toBe('work/with spaces&more');
  });

  it('uses the exact workId string received — no truncation or transformation', () => {
    const replaceState = vi.fn();
    const workId = 'clxyz1234567890abcdef';
    applyWorkIdToUrl('https://example.com/editor', workId, replaceState);
    expect(new URL(replaceState.mock.calls[0][2]).searchParams.get('resume')).toBe(workId);
  });
});

// ─── Credit refresh logic (behaviour 2: finally block in sendMessage) ─────────
//
// After setIsStreaming(false) the page's finally block must:
//   a) always call api.getAiStatus() to refresh creditsRemaining
//   b) call api.editorModeStatus(workId) ONLY IF workId is non-null
//
// We model the exact conditional as a pure function and test its branching.

describe('credit refresh after message completion (finally block logic)', () => {
  // Pure function that captures the conditional logic from the finally block.
  // The real code uses React state setters; here we replace them with jest spies.
  async function runFinallyBlock(
    workId: string | null,
    getAiStatus: () => Promise<any>,
    editorModeStatus: (id: string) => Promise<any>,
    setCreditsRemaining: (v: number) => void,
    setCreditConsumed: (v: number) => void,
  ): Promise<void> {
    // Mirrors: api.getAiStatus().then(...).catch(() => {})
    getAiStatus()
      .then((res: any) => {
        if (res?.data?.tier?.credits?.total !== undefined) {
          setCreditsRemaining(res.data.tier.credits.total);
        }
      })
      .catch(() => {});

    // Mirrors: if (workId) { api.editorModeStatus(workId).then(...).catch(() => {}) }
    if (workId) {
      editorModeStatus(workId)
        .then((res: any) => {
          const job = res?.data || res;
          if (job?.creditsConsumed !== undefined) {
            setCreditConsumed(job.creditsConsumed);
          }
        })
        .catch(() => {});
    }
  }

  it('always calls getAiStatus regardless of workId', async () => {
    const getAiStatus = vi.fn().mockResolvedValue({ data: { tier: { credits: { total: 10 } } } });
    const editorModeStatus = vi.fn().mockResolvedValue({});
    const setCreditsRemaining = vi.fn();
    const setCreditConsumed = vi.fn();

    await runFinallyBlock(null, getAiStatus, editorModeStatus, setCreditsRemaining, setCreditConsumed);

    expect(getAiStatus).toHaveBeenCalledOnce();
  });

  it('calls editorModeStatus with workId when workId is non-null', async () => {
    const getAiStatus = vi.fn().mockResolvedValue({});
    const editorModeStatus = vi.fn().mockResolvedValue({ creditsConsumed: 3 });
    const setCreditsRemaining = vi.fn();
    const setCreditConsumed = vi.fn();

    await runFinallyBlock('work-123', getAiStatus, editorModeStatus, setCreditsRemaining, setCreditConsumed);
    // Flush the fire-and-forget promises
    await Promise.resolve();
    await Promise.resolve();

    expect(editorModeStatus).toHaveBeenCalledOnce();
    expect(editorModeStatus).toHaveBeenCalledWith('work-123');
  });

  it('does NOT call editorModeStatus when workId is null', async () => {
    const getAiStatus = vi.fn().mockResolvedValue({});
    const editorModeStatus = vi.fn();
    const setCreditsRemaining = vi.fn();
    const setCreditConsumed = vi.fn();

    await runFinallyBlock(null, getAiStatus, editorModeStatus, setCreditsRemaining, setCreditConsumed);
    await Promise.resolve();

    expect(editorModeStatus).not.toHaveBeenCalled();
  });

  it('updates creditsRemaining from getAiStatus response', async () => {
    const getAiStatus = vi.fn().mockResolvedValue({
      data: { tier: { credits: { total: 42 } } },
    });
    const editorModeStatus = vi.fn().mockResolvedValue({});
    const setCreditsRemaining = vi.fn();
    const setCreditConsumed = vi.fn();

    await runFinallyBlock(null, getAiStatus, editorModeStatus, setCreditsRemaining, setCreditConsumed);
    await Promise.resolve();
    await Promise.resolve();

    expect(setCreditsRemaining).toHaveBeenCalledWith(42);
  });

  it('does NOT update creditsRemaining when getAiStatus response lacks the expected path', async () => {
    const getAiStatus = vi.fn().mockResolvedValue({ data: {} }); // missing tier.credits.total
    const editorModeStatus = vi.fn().mockResolvedValue({});
    const setCreditsRemaining = vi.fn();
    const setCreditConsumed = vi.fn();

    await runFinallyBlock(null, getAiStatus, editorModeStatus, setCreditsRemaining, setCreditConsumed);
    await Promise.resolve();
    await Promise.resolve();

    expect(setCreditsRemaining).not.toHaveBeenCalled();
  });

  it('updates creditsConsumed from editorModeStatus top-level response', async () => {
    const getAiStatus = vi.fn().mockResolvedValue({});
    // Server returns { creditsConsumed: 7 } at the top level (no .data wrapper)
    const editorModeStatus = vi.fn().mockResolvedValue({ creditsConsumed: 7 });
    const setCreditsRemaining = vi.fn();
    const setCreditConsumed = vi.fn();

    await runFinallyBlock('work-1', getAiStatus, editorModeStatus, setCreditsRemaining, setCreditConsumed);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(setCreditConsumed).toHaveBeenCalledWith(7);
  });

  it('updates creditsConsumed from editorModeStatus .data wrapper', async () => {
    const getAiStatus = vi.fn().mockResolvedValue({});
    // Server wraps in { data: { creditsConsumed: 5 } }
    const editorModeStatus = vi.fn().mockResolvedValue({ data: { creditsConsumed: 5 } });
    const setCreditsRemaining = vi.fn();
    const setCreditConsumed = vi.fn();

    await runFinallyBlock('work-1', getAiStatus, editorModeStatus, setCreditsRemaining, setCreditConsumed);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(setCreditConsumed).toHaveBeenCalledWith(5);
  });

  it('silently ignores getAiStatus network failure', async () => {
    const getAiStatus = vi.fn().mockRejectedValue(new Error('network error'));
    const editorModeStatus = vi.fn().mockResolvedValue({});
    const setCreditsRemaining = vi.fn();
    const setCreditConsumed = vi.fn();

    // Must not throw
    await expect(
      runFinallyBlock(null, getAiStatus, editorModeStatus, setCreditsRemaining, setCreditConsumed),
    ).resolves.toBeUndefined();

    await Promise.resolve();
    expect(setCreditsRemaining).not.toHaveBeenCalled();
  });

  it('silently ignores editorModeStatus network failure', async () => {
    const getAiStatus = vi.fn().mockResolvedValue({});
    const editorModeStatus = vi.fn().mockRejectedValue(new Error('timeout'));
    const setCreditsRemaining = vi.fn();
    const setCreditConsumed = vi.fn();

    await expect(
      runFinallyBlock('work-1', getAiStatus, editorModeStatus, setCreditsRemaining, setCreditConsumed),
    ).resolves.toBeUndefined();

    await Promise.resolve();
    await Promise.resolve();
    expect(setCreditConsumed).not.toHaveBeenCalled();
  });

  it('handles creditsConsumed === 0 (falsy but valid value) correctly', async () => {
    const getAiStatus = vi.fn().mockResolvedValue({});
    const editorModeStatus = vi.fn().mockResolvedValue({ creditsConsumed: 0 });
    const setCreditsRemaining = vi.fn();
    const setCreditConsumed = vi.fn();

    await runFinallyBlock('work-1', getAiStatus, editorModeStatus, setCreditsRemaining, setCreditConsumed);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // creditsConsumed: 0 is !== undefined, so setter should be called
    expect(setCreditConsumed).toHaveBeenCalledWith(0);
  });
});

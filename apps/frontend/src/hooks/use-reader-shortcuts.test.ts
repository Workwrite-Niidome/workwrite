import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useReaderShortcuts } from './use-reader-shortcuts';

describe('useReaderShortcuts', () => {
  const callbacks = {
    onPrevEpisode: vi.fn(),
    onNextEpisode: vi.fn(),
    onToggleSettings: vi.fn(),
    onToggleComments: vi.fn(),
    onToggleCompanion: vi.fn(),
    onToggleImmersive: vi.fn(),
    onEscape: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function pressKey(key: string, target?: Partial<HTMLElement>) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true });
    if (target) {
      Object.defineProperty(event, 'target', { value: target });
    }
    window.dispatchEvent(event);
  }

  it('should call onPrevEpisode on ArrowLeft', () => {
    renderHook(() => useReaderShortcuts(callbacks));

    pressKey('ArrowLeft');

    expect(callbacks.onPrevEpisode).toHaveBeenCalledTimes(1);
  });

  it('should call onNextEpisode on ArrowRight', () => {
    renderHook(() => useReaderShortcuts(callbacks));

    pressKey('ArrowRight');

    expect(callbacks.onNextEpisode).toHaveBeenCalledTimes(1);
  });

  it('should call onToggleSettings on "s"', () => {
    renderHook(() => useReaderShortcuts(callbacks));

    pressKey('s');

    expect(callbacks.onToggleSettings).toHaveBeenCalledTimes(1);
  });

  it('should call onToggleComments on "c"', () => {
    renderHook(() => useReaderShortcuts(callbacks));

    pressKey('c');

    expect(callbacks.onToggleComments).toHaveBeenCalledTimes(1);
  });

  it('should call onToggleCompanion on "a"', () => {
    renderHook(() => useReaderShortcuts(callbacks));

    pressKey('a');

    expect(callbacks.onToggleCompanion).toHaveBeenCalledTimes(1);
  });

  it('should call onToggleImmersive on "f"', () => {
    renderHook(() => useReaderShortcuts(callbacks));

    pressKey('f');

    expect(callbacks.onToggleImmersive).toHaveBeenCalledTimes(1);
  });

  it('should call onEscape on Escape', () => {
    renderHook(() => useReaderShortcuts(callbacks));

    pressKey('Escape');

    expect(callbacks.onEscape).toHaveBeenCalledTimes(1);
  });

  it('should not trigger shortcuts when typing in INPUT', () => {
    renderHook(() => useReaderShortcuts(callbacks));

    pressKey('s', { tagName: 'INPUT' } as HTMLElement);

    expect(callbacks.onToggleSettings).not.toHaveBeenCalled();
  });

  it('should not trigger shortcuts when typing in TEXTAREA', () => {
    renderHook(() => useReaderShortcuts(callbacks));

    pressKey('f', { tagName: 'TEXTAREA' } as HTMLElement);

    expect(callbacks.onToggleImmersive).not.toHaveBeenCalled();
  });

  it('should not trigger shortcuts when in contentEditable', () => {
    renderHook(() => useReaderShortcuts(callbacks));

    pressKey('c', { tagName: 'DIV', isContentEditable: true } as unknown as HTMLElement);

    expect(callbacks.onToggleComments).not.toHaveBeenCalled();
  });

  it('should handle missing callbacks gracefully', () => {
    renderHook(() => useReaderShortcuts({}));

    expect(() => pressKey('ArrowLeft')).not.toThrow();
    expect(() => pressKey('s')).not.toThrow();
  });

  it('should clean up event listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useReaderShortcuts(callbacks));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });
});

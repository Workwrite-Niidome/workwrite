import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSwipeNavigation } from './use-swipe-navigation';

function createTouchEvent(type: string, clientX: number, clientY: number) {
  const touch = { clientX, clientY } as Touch;
  const event = new Event(type, { bubbles: true }) as TouchEvent;
  if (type === 'touchend') {
    Object.defineProperty(event, 'changedTouches', { value: [touch] });
  } else {
    Object.defineProperty(event, 'touches', { value: [touch] });
  }
  return event;
}

describe('useSwipeNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock getSelection to return empty
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '' } as Selection);
  });

  it('should call onSwipeLeft when swiping left past threshold', () => {
    const onSwipeLeft = vi.fn();
    renderHook(() => useSwipeNavigation({ onSwipeLeft, threshold: 100 }));

    act(() => {
      window.dispatchEvent(createTouchEvent('touchstart', 300, 100));
      window.dispatchEvent(createTouchEvent('touchmove', 150, 100));
      window.dispatchEvent(createTouchEvent('touchend', 150, 100));
    });

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('should call onSwipeRight when swiping right past threshold', () => {
    const onSwipeRight = vi.fn();
    renderHook(() => useSwipeNavigation({ onSwipeRight, threshold: 100 }));

    act(() => {
      window.dispatchEvent(createTouchEvent('touchstart', 100, 100));
      window.dispatchEvent(createTouchEvent('touchmove', 250, 100));
      window.dispatchEvent(createTouchEvent('touchend', 250, 100));
    });

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('should not trigger swipe when below threshold and velocity', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    // Mock Date.now to simulate slow swipe (low velocity) with small distance
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    renderHook(() => useSwipeNavigation({ onSwipeLeft, onSwipeRight, threshold: 200, velocityThreshold: 0.3 }));

    act(() => {
      now = 1000;
      window.dispatchEvent(createTouchEvent('touchstart', 200, 100));
      now = 2000; // 1000ms elapsed
      window.dispatchEvent(createTouchEvent('touchmove', 160, 100));
      window.dispatchEvent(createTouchEvent('touchend', 160, 100));
    });

    // deltaX=40 < threshold=200, velocity=40/1000=0.04 < 0.3
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('should not trigger swipe when vertical scroll is dominant', () => {
    const onSwipeLeft = vi.fn();
    renderHook(() => useSwipeNavigation({ onSwipeLeft, threshold: 100 }));

    act(() => {
      window.dispatchEvent(createTouchEvent('touchstart', 200, 100));
      // Vertical movement (deltaY > deltaX)
      window.dispatchEvent(createTouchEvent('touchmove', 190, 300));
      window.dispatchEvent(createTouchEvent('touchend', 50, 300));
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('should not trigger swipe when text is selected', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'selected text' } as Selection);
    const onSwipeLeft = vi.fn();
    renderHook(() => useSwipeNavigation({ onSwipeLeft, threshold: 100 }));

    act(() => {
      window.dispatchEvent(createTouchEvent('touchstart', 300, 100));
      window.dispatchEvent(createTouchEvent('touchmove', 150, 100));
      window.dispatchEvent(createTouchEvent('touchend', 150, 100));
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('should return swipeEdge state during swipe', () => {
    const { result } = renderHook(() =>
      useSwipeNavigation({ threshold: 100 })
    );

    expect(result.current.swipeEdge).toBeNull();
  });

  it('should clean up event listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useSwipeNavigation({}));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));
    removeSpy.mockRestore();
  });
});

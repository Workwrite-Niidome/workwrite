'use client';

import { useEffect, useCallback, type RefObject } from 'react';

interface UsePageNavigationOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  onNext: () => void;
  onPrev: () => void;
  enabled: boolean;
}

/**
 * Handles tap-zone navigation and keyboard arrow keys for paged reading.
 *
 * Tap zones (for vertical-rl / right-to-left reading):
 *   - Left 40% of viewport width  → onNext  (advance)
 *   - Right 40% of viewport width → onPrev  (go back)
 *   - Center 20%                  → no action (reserved for UI interactions)
 *
 * Keyboard:
 *   - ArrowLeft  → onNext  (in vertical-rl, left = forward)
 *   - ArrowRight → onPrev
 *
 * Ignores interactions when:
 *   - Text is currently selected
 *   - The click target is an <a>, <button>, or inside one
 */
export function usePageNavigation({
  containerRef,
  onNext,
  onPrev,
  enabled,
}: UsePageNavigationOptions): void {
  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!enabled) return;

      // Ignore if text is selected
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) return;

      // Ignore clicks on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest('a, button, [role="button"], input, textarea, select, [data-no-nav]')) {
        return;
      }

      const viewportWidth = window.innerWidth;
      const x = e.clientX;
      const leftBoundary = viewportWidth * 0.4;
      const rightBoundary = viewportWidth * 0.6;

      if (x < leftBoundary) {
        onNext();
      } else if (x > rightBoundary) {
        onPrev();
      }
      // Center 20%: do nothing
    },
    [enabled, onNext, onPrev],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if focus is on an input element
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onNext();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onPrev();
      }
    },
    [enabled, onNext, onPrev],
  );

  // Click handler on the container
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [containerRef, enabled, handleClick]);

  // Keyboard handler on document
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}

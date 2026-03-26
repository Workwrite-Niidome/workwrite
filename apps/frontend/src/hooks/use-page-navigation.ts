'use client';

import { useEffect, type RefObject } from 'react';

interface UsePageNavigationOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  onNext: () => void;
  onPrev: () => void;
  enabled: boolean;
}

/**
 * Handles tap-zone detection and keyboard navigation for vertical reader.
 * - Left 40% of screen = next page (vertical-rl: left = forward)
 * - Right 40% of screen = prev page
 * - Center 20% = no action (for UI taps)
 * - ArrowLeft = next page, ArrowRight = prev page
 * - Ignores clicks on interactive elements and during text selection
 */
export function usePageNavigation({
  containerRef,
  onNext,
  onPrev,
  enabled,
}: UsePageNavigationOptions) {
  useEffect(() => {
    if (!enabled) return;

    function isInteractiveElement(el: EventTarget | null): boolean {
      if (!el || !(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      if (['a', 'button', 'input', 'textarea', 'select'].includes(tag)) return true;
      if (el.closest('[role="button"], [data-no-nav], button, a')) return true;
      return false;
    }

    function handleClick(e: MouseEvent) {
      // Don't interfere with interactive elements
      if (isInteractiveElement(e.target)) return;

      // Don't interfere with text selection
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) return;

      const screenWidth = window.innerWidth;
      const x = e.clientX;
      const leftZone = screenWidth * 0.4;
      const rightZone = screenWidth * 0.6;

      if (x < leftZone) {
        onNext();
      } else if (x > rightZone) {
        onPrev();
      }
      // Center 20% = no action
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onNext();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onPrev();
      }
    }

    // Use window-level click to avoid conflicts with overflow:auto scroll containers
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, onNext, onPrev, enabled]);
}

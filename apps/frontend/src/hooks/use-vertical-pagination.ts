'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

interface UseVerticalPaginationOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  contentReady: boolean;
}

interface UseVerticalPaginationReturn {
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
  goNext: () => void;
  goPrev: () => void;
  isFirstPage: boolean;
  isLastPage: boolean;
  progressPct: number;
}

/**
 * In writing-mode: vertical-rl, content overflows to the LEFT.
 * scrollLeft behavior differs by browser:
 *   - Chrome/Safari: scrollLeft starts at 0, goes POSITIVE as you scroll left
 *   - Firefox: scrollLeft starts at 0, goes NEGATIVE as you scroll left
 *
 * We normalize by always working with positive page indices.
 * Page 0 = rightmost content (start of text), Page N = leftmost (end of text).
 */
function getMaxScroll(el: HTMLElement): number {
  return el.scrollWidth - el.clientWidth;
}

function getScrollPosition(el: HTMLElement): number {
  // Normalize to a positive value representing how far we've scrolled from the start
  const raw = el.scrollLeft;
  if (raw <= 0) {
    // Firefox: scrollLeft is negative or zero
    return Math.abs(raw);
  }
  // Chrome/Safari: scrollLeft is positive
  return raw;
}

function scrollToPosition(el: HTMLElement, position: number) {
  // Test which direction this browser uses
  const testEl = document.createElement('div');
  testEl.style.cssText = 'writing-mode:vertical-rl;width:50px;height:50px;overflow:auto;position:absolute;left:-9999px';
  testEl.innerHTML = '<div style="width:200px;height:50px"></div>';
  document.body.appendChild(testEl);
  // If scrollLeft can go negative, it's Firefox
  testEl.scrollLeft = -1;
  const isNegative = testEl.scrollLeft < 0;
  document.body.removeChild(testEl);

  el.scrollTo({
    left: isNegative ? -position : position,
    behavior: 'smooth',
  });
}

export function useVerticalPagination({
  containerRef,
  contentReady,
}: UseVerticalPaginationOptions): UseVerticalPaginationReturn {
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const recalcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate total pages
  const recalculate = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const pages = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth));
    setTotalPages(pages);
  }, [containerRef]);

  // Recalculate on content change or resize
  useEffect(() => {
    if (!contentReady) return;

    // Wait for layout to settle
    recalcTimerRef.current = setTimeout(recalculate, 100);

    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      if (recalcTimerRef.current) clearTimeout(recalcTimerRef.current);
      recalcTimerRef.current = setTimeout(recalculate, 100);
    });
    observer.observe(el);

    // Track scroll position to update current page (for free scrolling / mouse wheel)
    function handleScroll() {
      if (!el) return;
      const pos = getScrollPosition(el);
      const page = Math.round(pos / el.clientWidth);
      setCurrentPage(Math.max(0, Math.min(page, Math.ceil(el.scrollWidth / el.clientWidth) - 1)));
    }
    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', handleScroll);
      if (recalcTimerRef.current) clearTimeout(recalcTimerRef.current);
    };
  }, [contentReady, recalculate, containerRef]);

  const goToPage = useCallback((page: number) => {
    const el = containerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(page, totalPages - 1));
    const position = clamped * el.clientWidth;
    scrollToPosition(el, position);
    setCurrentPage(clamped);
  }, [containerRef, totalPages]);

  const goNext = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const goPrev = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  return {
    currentPage,
    totalPages,
    goToPage,
    goNext,
    goPrev,
    isFirstPage: currentPage === 0,
    isLastPage: currentPage >= totalPages - 1,
    progressPct: totalPages > 1 ? currentPage / (totalPages - 1) : 1,
  };
}

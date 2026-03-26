'use client';

import { useState, useCallback, useEffect, useRef, type RefObject } from 'react';

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
 * Normalize scrollLeft for vertical-rl containers.
 *
 * In writing-mode: vertical-rl, content flows right-to-left so scrollLeft
 * behaves differently across browsers:
 *   - Chrome/Safari: scrollLeft starts at 0 and increases positively as you
 *     scroll leftward (i.e. deeper into the content).
 *   - Firefox: scrollLeft starts at 0 and goes negative as you scroll leftward.
 *
 * This helper returns a non-negative value representing how far "into" the
 * content the user has scrolled, regardless of browser.
 */
function getNormalizedScrollLeft(el: HTMLElement): number {
  const raw = el.scrollLeft;
  // Firefox returns negative values for vertical-rl scroll
  return Math.abs(raw);
}

/**
 * Scroll a vertical-rl container to the given non-negative logical offset.
 * Applies the correct sign depending on the browser.
 */
function setNormalizedScrollLeft(
  el: HTMLElement,
  offset: number,
  behavior: ScrollBehavior = 'smooth',
): void {
  // Detect Firefox: scrollLeft goes negative in vertical-rl
  const isFirefox = typeof navigator !== 'undefined' && /Firefox/i.test(navigator.userAgent);
  const value = isFirefox ? -offset : offset;
  el.scrollTo({ left: value, behavior });
}

export function useVerticalPagination({
  containerRef,
  contentReady,
}: UseVerticalPaginationOptions): UseVerticalPaginationReturn {
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const recalcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recalculate = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const pageWidth = el.clientWidth;
    if (pageWidth === 0) return;

    const pages = Math.max(1, Math.ceil(el.scrollWidth / pageWidth));
    setTotalPages(pages);

    const scrollPos = getNormalizedScrollLeft(el);
    const page = Math.round(scrollPos / pageWidth);
    setCurrentPage(Math.min(page, pages - 1));
  }, [containerRef]);

  const goToPage = useCallback(
    (page: number) => {
      const el = containerRef.current;
      if (!el) return;

      const pageWidth = el.clientWidth;
      const clamped = Math.max(0, Math.min(page, totalPages - 1));
      setNormalizedScrollLeft(el, clamped * pageWidth, 'smooth');
      setCurrentPage(clamped);
    },
    [containerRef, totalPages],
  );

  const goNext = useCallback(() => {
    goToPage(currentPage + 1);
  }, [goToPage, currentPage]);

  const goPrev = useCallback(() => {
    goToPage(currentPage - 1);
  }, [goToPage, currentPage]);

  // Recalculate when contentReady changes (e.g. font size / line height change)
  useEffect(() => {
    // Small delay to let the browser reflow after content/style changes
    if (recalcTimerRef.current) clearTimeout(recalcTimerRef.current);
    recalcTimerRef.current = setTimeout(recalculate, 100);
    return () => {
      if (recalcTimerRef.current) clearTimeout(recalcTimerRef.current);
    };
  }, [contentReady, recalculate]);

  // ResizeObserver to handle container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      recalculate();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, recalculate]);

  // Listen to scroll events to keep currentPage in sync (e.g. after smooth scroll ends)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const pageWidth = el.clientWidth;
        if (pageWidth > 0) {
          const scrollPos = getNormalizedScrollLeft(el);
          const page = Math.round(scrollPos / pageWidth);
          const pages = Math.max(1, Math.ceil(el.scrollWidth / pageWidth));
          setCurrentPage(Math.min(page, pages - 1));
          setTotalPages(pages);
        }
        ticking = false;
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [containerRef]);

  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage >= totalPages - 1;
  const progressPct = totalPages <= 1 ? 1 : currentPage / (totalPages - 1);

  return {
    currentPage,
    totalPages,
    goToPage,
    goNext,
    goPrev,
    isFirstPage,
    isLastPage,
    progressPct,
  };
}

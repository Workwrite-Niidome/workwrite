'use client';

import { useEffect, useRef, useState, useCallback, type RefObject } from 'react';

interface UseVerticalPagerOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  onProgressChange?: (pct: number) => void;
  onReachEnd?: () => void;
}

/**
 * Detect browser scrollLeft direction for writing-mode: vertical-rl.
 * Chrome/Safari: scrollLeft 0 → positive (scrolling left)
 * Firefox: scrollLeft 0 → negative (scrolling left)
 */
let cachedIsNegativeScroll: boolean | null = null;

function detectNegativeScroll(): boolean {
  if (cachedIsNegativeScroll !== null) return cachedIsNegativeScroll;
  const el = document.createElement('div');
  el.style.cssText =
    'writing-mode:vertical-rl;width:50px;height:50px;overflow:auto;position:absolute;left:-9999px;top:-9999px';
  el.innerHTML = '<div style="width:200px;height:50px"></div>';
  document.body.appendChild(el);
  el.scrollLeft = -1;
  cachedIsNegativeScroll = el.scrollLeft < 0;
  document.body.removeChild(el);
  return cachedIsNegativeScroll;
}

function setScrollPosition(el: HTMLElement, position: number) {
  const isNeg = detectNegativeScroll();
  el.scrollLeft = isNeg ? -position : position;
}

function getScrollPosition(el: HTMLElement): number {
  return Math.abs(el.scrollLeft);
}

/**
 * Page-based vertical reader. No free scroll.
 * Container uses overflow:hidden, position is controlled entirely by JS.
 */
export function useVerticalPager({
  containerRef,
  enabled,
  onProgressChange,
  onReachEnd,
}: UseVerticalPagerOptions) {
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const reachEndFiredRef = useRef(false);
  const isAnimatingRef = useRef(false);

  // Calculate total pages from content width
  const recalcPages = useCallback(() => {
    const el = containerRef.current;
    if (!el) return 1;
    const pages = Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth));
    setTotalPages(pages);
    return pages;
  }, [containerRef]);

  // Go to a specific page
  const goToPage = useCallback((page: number) => {
    const el = containerRef.current;
    if (!el || isAnimatingRef.current) return;

    const pages = recalcPages();
    const clamped = Math.max(0, Math.min(page, pages - 1));
    const targetPos = clamped * el.clientWidth;

    isAnimatingRef.current = true;
    setCurrentPage(clamped);

    // Smooth scroll via CSS transition on a wrapper, or just set directly
    // Using scrollTo with behavior smooth on overflow:hidden doesn't animate,
    // so we animate manually with requestAnimationFrame
    const startPos = getScrollPosition(el);
    const distance = targetPos - startPos;
    const duration = 250; // ms
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // ease-out
      const eased = 1 - (1 - t) * (1 - t);
      const pos = startPos + distance * eased;
      setScrollPosition(el!, pos);

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        setScrollPosition(el!, targetPos);
        isAnimatingRef.current = false;
      }
    }

    if (Math.abs(distance) < 2) {
      setScrollPosition(el, targetPos);
      isAnimatingRef.current = false;
    } else {
      requestAnimationFrame(animate);
    }

    // Progress
    const pct = pages > 1 ? clamped / (pages - 1) : 1;
    onProgressChange?.(pct);
    if (clamped >= pages - 1 && !reachEndFiredRef.current) {
      reachEndFiredRef.current = true;
      onReachEnd?.();
    }
  }, [containerRef, recalcPages, onProgressChange, onReachEnd]);

  const goNext = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);
  const goPrev = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);

  // Recalculate on resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const timer = setTimeout(() => {
      recalcPages();
      // Ensure position is correct after recalc
      setScrollPosition(el, currentPage * el.clientWidth);
    }, 150);

    const observer = new ResizeObserver(() => {
      const pages = recalcPages();
      const clamped = Math.min(currentPage, pages - 1);
      setCurrentPage(clamped);
      setScrollPosition(el, clamped * el.clientWidth);
    });
    observer.observe(el);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [containerRef, enabled, recalcPages, currentPage]);

  // Mouse wheel → page turn (debounced)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    let wheelAccum = 0;
    let wheelTimer: ReturnType<typeof setTimeout> | null = null;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      if (isAnimatingRef.current) return;

      wheelAccum += e.deltaY;

      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        if (Math.abs(wheelAccum) > 30) {
          if (wheelAccum > 0) {
            goNext();
          } else {
            goPrev();
          }
        }
        wheelAccum = 0;
      }, 80);
    }

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
      if (wheelTimer) clearTimeout(wheelTimer);
    };
  }, [containerRef, enabled, goNext, goPrev]);

  // Touch: tap (small move) and swipe (large horizontal move)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    let touchStart: { x: number; y: number; time: number } | null = null;

    function handleTouchStart(e: TouchEvent) {
      touchStart = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }

    function handleTouchEnd(e: TouchEvent) {
      if (!touchStart) return;
      const end = e.changedTouches[0];
      const dx = end.clientX - touchStart.x; // signed: positive = swipe right
      const absDx = Math.abs(dx);
      const absDy = Math.abs(end.clientY - touchStart.y);
      const dt = Date.now() - touchStart.time;
      touchStart = null;

      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, textarea, select, [role="button"], [data-no-nav]')) return;
      if (window.getSelection()?.toString().trim()) return;

      // Swipe: horizontal dominant, distance > 50px
      if (absDx > 50 && absDx > absDy * 1.5) {
        // 縦書き: 左スワイプ=次ページ, 右スワイプ=前ページ
        if (dx < 0) {
          goNext();
        } else {
          goPrev();
        }
        return;
      }

      // Tap: small movement, short duration
      if (absDx > 20 || absDy > 20 || dt > 300) return;

      const screenWidth = window.innerWidth;
      const x = end.clientX;
      // 縦書き: 左タップ=次ページ, 右タップ=前ページ
      if (x < screenWidth * 0.4) {
        goNext();
      } else if (x > screenWidth * 0.6) {
        goPrev();
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, enabled, goNext, goPrev]);

  // Click navigation (PC)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, textarea, select, [role="button"], [data-no-nav]')) return;
      if (window.getSelection()?.toString().trim()) return;

      const rect = el!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;

      if (x < width * 0.4) {
        goNext();
      } else if (x > width * 0.6) {
        goPrev();
      }
    }

    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [containerRef, enabled, goNext, goPrev]);

  // Keyboard
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goNext(); // 縦書き: 左=進む
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goPrev(); // 縦書き: 右=戻る
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, goNext, goPrev]);

  return {
    currentPage,
    totalPages,
    progressPct: totalPages > 1 ? currentPage / (totalPages - 1) : 0,
    goToPage,
    goNext,
    goPrev,
  };
}

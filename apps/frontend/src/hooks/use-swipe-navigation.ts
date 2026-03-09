'use client';

import { useEffect, useRef, useState } from 'react';

interface SwipeNavigationOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  velocityThreshold?: number;
}

export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  threshold = 100,
  velocityThreshold = 0.3,
}: SwipeNavigationOptions) {
  const [swipeEdge, setSwipeEdge] = useState<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const isTracking = useRef(false);

  useEffect(() => {
    function handleTouchStart(e: TouchEvent) {
      // Don't interfere with text selection
      if (window.getSelection()?.toString()) return;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      startTime.current = Date.now();
      isTracking.current = true;
    }

    function handleTouchMove(e: TouchEvent) {
      if (!isTracking.current) return;
      const deltaX = e.touches[0].clientX - startX.current;
      const deltaY = e.touches[0].clientY - startY.current;

      // If vertical scroll is dominant, stop tracking horizontal swipe
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        isTracking.current = false;
        setSwipeEdge(null);
        return;
      }

      if (Math.abs(deltaX) > 30) {
        setSwipeEdge(deltaX > 0 ? 'left' : 'right');
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (!isTracking.current) {
        setSwipeEdge(null);
        return;
      }
      isTracking.current = false;

      const endX = e.changedTouches[0].clientX;
      const deltaX = endX - startX.current;
      const elapsed = Date.now() - startTime.current;
      const velocity = Math.abs(deltaX) / elapsed;

      setSwipeEdge(null);

      if (Math.abs(deltaX) >= threshold || velocity >= velocityThreshold) {
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, threshold, velocityThreshold]);

  return { swipeEdge };
}

'use client';

import { useRef, useEffect, useCallback, useState, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import type { Highlight } from '@/lib/api';
import { HighlightedText } from '@/components/reader/highlighted-text';
import { useVerticalPagination } from '@/hooks/use-vertical-pagination';
import { usePageNavigation } from '@/hooks/use-page-navigation';

const FONT_SIZES: Record<string, string> = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

interface VerticalReaderProps {
  episode: { title: string; content: string; workId: string };
  highlights: Highlight[];
  fontSize: string;
  lineHeight: string;
  onHighlightClick: (h: Highlight, event?: React.MouseEvent) => void;
  onContentMouseUp: () => void;
  contentRef: RefObject<HTMLDivElement | null>;
  onProgressChange: (pct: number, pageInfo: { current: number; total: number }) => void;
  onLastPageReached: () => void;
  prevEpisode?: { id: string; title: string } | null;
  nextEpisode?: { id: string; title: string } | null;
}

export function VerticalReader({
  episode,
  highlights,
  fontSize,
  lineHeight,
  onHighlightClick,
  onContentMouseUp,
  contentRef,
  onProgressChange,
  onLastPageReached,
  prevEpisode,
  nextEpisode,
}: VerticalReaderProps) {
  const router = useRouter();
  const columnContainerRef = useRef<HTMLDivElement>(null);
  const [contentReady, setContentReady] = useState(false);
  const [bounceDirection, setBounceDirection] = useState<'left' | 'right' | null>(null);

  const fontSizeClass = FONT_SIZES[fontSize] || FONT_SIZES.base;
  const lineHeightClass = lineHeight;

  // Signal content ready whenever text or style props change
  useEffect(() => {
    setContentReady(false);
    const timer = setTimeout(() => setContentReady(true), 150);
    return () => clearTimeout(timer);
  }, [episode.content, fontSize, lineHeight]);

  const {
    currentPage,
    totalPages,
    goNext: paginationNext,
    goPrev: paginationPrev,
    isFirstPage,
    isLastPage,
    progressPct,
  } = useVerticalPagination({
    containerRef: columnContainerRef,
    contentReady,
  });

  // Notify progress on page change
  useEffect(() => {
    onProgressChange(progressPct, { current: currentPage, total: totalPages });
  }, [currentPage, totalPages, progressPct, onProgressChange]);

  // Notify when last page is reached
  useEffect(() => {
    if (isLastPage && totalPages > 1) {
      onLastPageReached();
    }
  }, [isLastPage, totalPages, onLastPageReached]);

  const triggerBounce = useCallback((direction: 'left' | 'right') => {
    setBounceDirection(direction);
    setTimeout(() => setBounceDirection(null), 300);
  }, []);

  const handleNext = useCallback(() => {
    if (!isLastPage) {
      paginationNext();
    } else if (nextEpisode) {
      router.push(`/read/${nextEpisode.id}`);
    } else {
      triggerBounce('left');
    }
  }, [isLastPage, nextEpisode, paginationNext, router, triggerBounce]);

  const handlePrev = useCallback(() => {
    if (!isFirstPage) {
      paginationPrev();
    } else if (prevEpisode) {
      router.push(`/read/${prevEpisode.id}`);
    } else {
      triggerBounce('right');
    }
  }, [isFirstPage, prevEpisode, paginationPrev, router, triggerBounce]);

  usePageNavigation({
    containerRef: columnContainerRef,
    onNext: handleNext,
    onPrev: handlePrev,
    enabled: true,
  });

  const containerStyle = {
    writingMode: 'vertical-rl',
    WebkitWritingMode: 'vertical-rl',
    columnWidth: 'calc(100dvh - 88px)',
    columnGap: '2rem',
    columnFill: 'auto',
    overflow: 'hidden',
    height: '100dvh',
    paddingTop: '48px',
    paddingBottom: '40px',
  } as React.CSSProperties;

  // Fallback for browsers that do not support dvh units
  const fallbackStyle = {
    writingMode: 'vertical-rl',
    WebkitWritingMode: 'vertical-rl',
    columnWidth: 'calc(100vh - 88px)',
    columnGap: '2rem',
    columnFill: 'auto',
    overflow: 'hidden',
    height: '100vh',
    paddingTop: '48px',
    paddingBottom: '40px',
  } as React.CSSProperties;

  // Detect dvh support
  const [supportsDvh, setSupportsDvh] = useState(true);
  useEffect(() => {
    if (typeof CSS !== 'undefined' && CSS.supports) {
      setSupportsDvh(CSS.supports('height', '100dvh'));
    }
  }, []);

  const appliedStyle = supportsDvh ? containerStyle : fallbackStyle;

  return (
    <div
      className="relative w-full"
      style={{ height: supportsDvh ? '100dvh' : '100vh' }}
    >
      {/* Main content container */}
      <div
        ref={columnContainerRef}
        onMouseUp={onContentMouseUp}
        style={appliedStyle}
        className={
          bounceDirection === 'left'
            ? 'animate-bounce-left'
            : bounceDirection === 'right'
              ? 'animate-bounce-right'
              : undefined
        }
      >
        <div ref={contentRef}>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              marginBlockEnd: '2rem',
              textAlign: 'center',
            }}
          >
            {episode.title}
          </h1>
          <div
            className={`font-serif ${fontSizeClass} ${lineHeightClass}`}
            style={{ whiteSpace: 'pre-wrap' }}
          >
            <HighlightedText
              text={episode.content}
              highlights={highlights}
              onHighlightClick={onHighlightClick}
            />
          </div>
        </div>
      </div>

      {/* Page indicator */}
      <div className="fixed bottom-0 left-0 right-0 h-10 flex items-center justify-center gap-4 bg-background/80 backdrop-blur z-30">
        <span className="text-xs text-muted-foreground">
          {currentPage + 1} / {totalPages}
        </span>
        <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progressPct * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

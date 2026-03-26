'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Settings, X, Mail, MessageCircle } from 'lucide-react';
import type { Highlight } from '@/lib/api';
import { HighlightedText } from './highlighted-text';
import { useVerticalPagination } from '@/hooks/use-vertical-pagination';
import { usePageNavigation } from '@/hooks/use-page-navigation';

const FONT_SIZE_MAP: Record<string, string> = {
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
  contentRef: React.RefObject<HTMLDivElement | null>;
  onProgressChange: (pct: number, pageInfo: { current: number; total: number }) => void;
  onLastPageReached: () => void;
  onSettingsClick: () => void;
  onExitVertical: () => void;
  onLetterClick: () => void;
  onCharacterTalkClick: () => void;
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
  onSettingsClick,
  onExitVertical,
  onLetterClick,
  onCharacterTalkClick,
  prevEpisode,
  nextEpisode,
}: VerticalReaderProps) {
  const router = useRouter();
  const columnContainerRef = useRef<HTMLDivElement>(null);
  const bounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    contentReady: !!episode.content,
  });

  // Report progress to parent
  const prevProgressRef = useRef(-1);
  if (progressPct !== prevProgressRef.current) {
    prevProgressRef.current = progressPct;
    onProgressChange(progressPct, { current: currentPage, total: totalPages });
    if (isLastPage && totalPages > 1) {
      onLastPageReached();
    }
  }

  // Mouse wheel → horizontal scroll (vertical writing mode)
  useEffect(() => {
    const el = columnContainerRef.current;
    if (!el) return;

    // Detect scroll direction for vertical-rl
    // In vertical-rl, scrolling "forward" (next page) means scrollLeft increases (Chrome) or decreases (Firefox)
    const testDiv = document.createElement('div');
    testDiv.style.cssText = 'writing-mode:vertical-rl;width:50px;height:50px;overflow:auto;position:absolute;left:-9999px';
    testDiv.innerHTML = '<div style="width:200px;height:50px"></div>';
    document.body.appendChild(testDiv);
    testDiv.scrollLeft = -1;
    const isNegativeScroll = testDiv.scrollLeft < 0;
    document.body.removeChild(testDiv);

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const delta = e.deltaY || e.deltaX;
      const scrollAmount = delta > 0 ? 150 : -150;
      // In Firefox (negative scroll), forward = negative scrollLeft
      // In Chrome (positive scroll), forward = positive scrollLeft
      const adjustedAmount = isNegativeScroll ? -scrollAmount : scrollAmount;
      el!.scrollLeft += adjustedAmount;
    }

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Handle boundary navigation
  const handleNext = useCallback(() => {
    if (isLastPage) {
      if (nextEpisode) {
        router.push(`/read/${nextEpisode.id}`);
      } else {
        const el = columnContainerRef.current;
        if (el) {
          el.style.transition = 'transform 0.15s ease';
          el.style.transform = 'translateX(20px)';
          if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
          bounceTimerRef.current = setTimeout(() => {
            el.style.transform = '';
            el.style.transition = '';
          }, 150);
        }
      }
    } else {
      paginationNext();
    }
  }, [isLastPage, nextEpisode, paginationNext, router]);

  const handlePrev = useCallback(() => {
    if (isFirstPage) {
      if (prevEpisode) {
        router.push(`/read/${prevEpisode.id}`);
      } else {
        const el = columnContainerRef.current;
        if (el) {
          el.style.transition = 'transform 0.15s ease';
          el.style.transform = 'translateX(-20px)';
          if (bounceTimerRef.current) clearTimeout(bounceTimerRef.current);
          bounceTimerRef.current = setTimeout(() => {
            el.style.transform = '';
            el.style.transition = '';
          }, 150);
        }
      }
    } else {
      paginationPrev();
    }
  }, [isFirstPage, prevEpisode, paginationPrev, router]);

  // Tap/keyboard navigation
  usePageNavigation({
    containerRef: columnContainerRef,
    onNext: handleNext,
    onPrev: handlePrev,
    enabled: true,
  });

  const fontSizeClass = FONT_SIZE_MAP[fontSize] || 'text-base';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 30,
      }}
      className="bg-background text-foreground"
    >
      {/* Mini header — just back button, minimal */}
      <div
        style={{
          height: '40px',
          writingMode: 'horizontal-tb',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          flexShrink: 0,
        } as React.CSSProperties}
        data-no-nav
      >
        <button
          onClick={() => router.push(`/works/${episode.workId}`)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          作品へ戻る
        </button>
      </div>

      {/* Vertical text container — overflow: auto for free scrolling */}
      <div
        ref={(node) => {
          (columnContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (contentRef && 'current' in contentRef) {
            (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }
        }}
        onMouseUp={onContentMouseUp}
        style={{
          flex: 1,
          width: '100%',
          minHeight: 0,
          writingMode: 'vertical-rl',
          WebkitWritingMode: 'vertical-rl',
          overflow: 'auto',
          padding: '2rem',
        } as React.CSSProperties}
      >
        {/* Title — centered vertically */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            marginLeft: '3em',
            paddingRight: '1rem',
            scrollSnapAlign: 'start',
          }}
        >
          <h1
            className="font-serif font-bold"
            style={{ fontSize: '1.5rem' }}
          >
            {episode.title}
          </h1>
        </div>

        {/* Body text */}
        <div
          className={`font-serif ${fontSizeClass} ${lineHeight}`}
          style={{ whiteSpace: 'pre-wrap' }}
        >
          <HighlightedText
            text={episode.content}
            highlights={highlights}
            onHighlightClick={onHighlightClick}
          />
        </div>
      </div>

      {/* Footer bar — page indicator + action buttons */}
      <div
        style={{
          height: '44px',
          writingMode: 'horizontal-tb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderTop: '1px solid var(--border, #333)',
          flexShrink: 0,
        } as React.CSSProperties}
        data-no-nav
      >
        {/* Page info */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {currentPage + 1} / {totalPages}
          </span>
          <div className="w-24 h-1 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full bg-primary rounded-full"
              style={{
                width: `${progressPct * 100}%`,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={onLetterClick}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            title="レター"
          >
            <Mail className="h-4 w-4" />
          </button>
          <button
            onClick={onCharacterTalkClick}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            title="キャラクタートーク"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
          <button
            onClick={onSettingsClick}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            title="表示設定"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={onExitVertical}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            title="横書きに切り替え"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

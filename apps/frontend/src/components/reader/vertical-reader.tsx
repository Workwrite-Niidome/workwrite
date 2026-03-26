'use client';

import { useRef, useCallback, useState } from 'react';
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

  // Handle boundary navigation
  const handleNext = useCallback(() => {
    if (isLastPage) {
      if (nextEpisode) {
        router.push(`/read/${nextEpisode.id}`);
      } else {
        // Bounce effect
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
        // Bounce effect
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

  // Use dvh if supported, vh as fallback
  const headerHeight = 48;
  const footerHeight = 40;

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
        background: 'inherit',
      }}
      className="bg-background text-foreground"
    >
      {/* Mini header */}
      <div
        style={{
          height: '44px',
          writingMode: 'horizontal-tb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          borderBottom: '1px solid var(--border, #333)',
          flexShrink: 0,
        } as React.CSSProperties}
        data-no-nav
      >
        <button
          onClick={() => router.push(`/works/${episode.workId}`)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          作品へ戻る
        </button>
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

      {/* Vertical text container — NO CSS columns, just overflow: hidden + scrollLeft */}
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
          writingMode: 'vertical-rl',
          WebkitWritingMode: 'vertical-rl',
          overflow: 'hidden',
          padding: '2rem 2rem',
        } as React.CSSProperties}
      >
        {/* Title — centered vertically in the container */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            marginLeft: '3em', /* Gap between title and body text = ~3 lines */
            paddingRight: '1rem',
          }}
        >
          <h1
            className="font-serif font-bold"
            style={{
              fontSize: '1.5rem',
              textAlign: 'center',
            }}
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

      {/* Page indicator — fixed at bottom, horizontal writing */}
      <div
        style={{
          height: `${footerHeight}px`,
          writingMode: 'horizontal-tb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          borderTop: '1px solid var(--border, #333)',
        }}
        data-no-nav
      >
        <span className="text-xs text-muted-foreground tabular-nums">
          {currentPage + 1} / {totalPages}
        </span>
        <div
          style={{
            width: '120px',
            height: '4px',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
          className="bg-muted"
        >
          <div
            className="bg-primary"
            style={{
              height: '100%',
              width: `${progressPct * 100}%`,
              transition: 'width 0.3s ease',
              borderRadius: '2px',
            }}
          />
        </div>
      </div>
    </div>
  );
}

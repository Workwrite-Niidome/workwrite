'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Settings, Mail, MessageCircle, X } from 'lucide-react';
import type { Highlight } from '@/lib/api';
import { HighlightedText } from './highlighted-text';
import { useVerticalPager } from '@/hooks/use-vertical-scroll';

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
  onProgressChange: (pct: number) => void;
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { currentPage, totalPages, progressPct } = useVerticalPager({
    containerRef: scrollContainerRef,
    enabled: true,
    onProgressChange,
    onReachEnd: onLastPageReached,
  });

  // Track container width for CSS column-width (prevents text clipping at page boundaries)
  const [columnWidth, setColumnWidth] = useState(0);

  const setRefs = useCallback((node: HTMLDivElement | null) => {
    (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (contentRef && 'current' in contentRef) {
      (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
    if (node) {
      // padding-left + padding-right = 2.5rem * 2 = 80px (approx)
      setColumnWidth(node.clientWidth);
    }
  }, [contentRef]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setColumnWidth(el.clientWidth);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fontSizeClass = FONT_SIZE_MAP[fontSize] || 'text-base';

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background text-foreground">
      {/* Mini header */}
      <div
        className="flex items-center px-3 shrink-0"
        style={{ height: '40px', writingMode: 'horizontal-tb' } as React.CSSProperties}
        data-no-nav
      >
        <button
          onClick={() => router.push(`/works/${episode.workId}`)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          作品へ戻る
        </button>
        <div className="flex-1" />
        {prevEpisode && (
          <button
            onClick={() => router.push(`/read/${prevEpisode.id}`)}
            className="text-xs text-muted-foreground hover:text-foreground px-2"
          >
            ← 前話
          </button>
        )}
        {nextEpisode && (
          <button
            onClick={() => router.push(`/read/${nextEpisode.id}`)}
            className="text-xs text-muted-foreground hover:text-foreground px-2"
          >
            次話 →
          </button>
        )}
      </div>

      {/* Vertical text container — overflow:hidden, JS controls position */}
      <div
        ref={setRefs}
        onMouseUp={onContentMouseUp}
        className="flex-1 min-h-0"
        style={{
          writingMode: 'vertical-rl',
          WebkitWritingMode: 'vertical-rl',
          overflowX: 'hidden',
          overflowY: 'hidden',
          paddingTop: '1.5rem',
          paddingBottom: '1.5rem',
          paddingLeft: '2.5rem',
          paddingRight: '2.5rem',
        } as React.CSSProperties}
      >
        {/* Title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            marginLeft: '2em',
            paddingRight: '1rem',
          }}
        >
          <h1 className="font-serif font-bold" style={{ fontSize: '1.5rem' }}>
            {episode.title}
          </h1>
        </div>

        {/* Body — column-width ensures text doesn't clip at page boundaries */}
        <div
          className={`font-serif ${fontSizeClass} ${lineHeight}`}
          style={{
            whiteSpace: 'pre-wrap',
            columnWidth: columnWidth > 0 ? `${columnWidth}px` : undefined,
            columnGap: 0,
            columnFill: 'auto',
            height: '100%',
          } as React.CSSProperties}
        >
          <HighlightedText
            text={episode.content}
            highlights={highlights}
            onHighlightClick={onHighlightClick}
          />
        </div>
      </div>

      {/* Footer bar */}
      <div
        className="flex items-center justify-between px-4 border-t border-border shrink-0"
        style={{ height: '44px', writingMode: 'horizontal-tb' } as React.CSSProperties}
        data-no-nav
      >
        {/* Page info */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {currentPage + 1} / {totalPages}
          </span>
          <div className="w-24 h-1 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full bg-primary rounded-full transition-[width] duration-300"
              style={{ width: `${progressPct * 100}%` }}
            />
          </div>
        </div>

        {/* Actions */}
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

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Moon,
  Sun,
  X,
  Mail,
  Sparkles,
  MessageCircle,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useAuth } from '@/lib/auth-context';
import { estimateReadingTime } from '@/lib/utils';
import { api, type Episode, type Highlight } from '@/lib/api';
import { HighlightedText } from '@/components/reader/highlighted-text';
import { HighlightToolbar } from '@/components/reader/highlight-toolbar';
import { HighlightDetailPopover } from '@/components/reader/highlight-detail-popover';
import { EpisodeCompleteBanner } from '@/components/reader/episode-complete-banner';
import { worldFragmentsApi } from '@/lib/world-fragments-api';
import { CharacterTalkChat } from '@/components/ai/character-talk-chat';
import { LetterPanel } from '@/components/reader/letter-panel';
import { LetterComposeDialog } from '@/components/reader/letter-compose-dialog';
import { useReaderShortcuts } from '@/hooks/use-reader-shortcuts';
import { ShortcutsHelp } from '@/components/reader/shortcuts-help';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import { VerticalReader } from '@/components/reader/vertical-reader';

type FontSize = 'sm' | 'base' | 'lg' | 'xl';
type Theme = 'light' | 'dark' | 'sepia';
type LineHeight = 'tight' | 'normal' | 'relaxed' | 'loose';
type MaxWidth = 'narrow' | 'normal' | 'wide';
type WritingMode = 'horizontal' | 'vertical';

const FONT_SIZES: Record<FontSize, string> = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

const LINE_HEIGHTS: Record<LineHeight, { class: string; label: string }> = {
  tight: { class: 'leading-7', label: '狭い' },
  normal: { class: 'leading-8', label: '普通' },
  relaxed: { class: 'leading-9', label: '広い' },
  loose: { class: 'leading-10', label: 'とても広い' },
};

const MAX_WIDTHS: Record<MaxWidth, { class: string; label: string; px: string }> = {
  narrow: { class: 'max-w-[560px]', label: '狭い', px: '560px' },
  normal: { class: 'max-w-2xl', label: '普通', px: '672px' },
  wide: { class: 'max-w-[800px]', label: '広い', px: '800px' },
};

const THEMES: Record<Theme, { bg: string; text: string; label: string }> = {
  light: { bg: 'bg-background', text: 'text-foreground', label: '標準' },
  dark: { bg: 'bg-gray-900', text: 'text-gray-100', label: '暗い' },
  sepia: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-950 dark:text-amber-100', label: 'セピア' },
};

const PROGRESS_DEBOUNCE = 5000;

interface ReaderSettings {
  fontSize: FontSize;
  theme: Theme;
  lineHeight: LineHeight;
  maxWidth: MaxWidth;
  writingMode: WritingMode;
}

const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 'base',
  theme: 'light',
  lineHeight: 'normal',
  maxWidth: 'normal',
  writingMode: 'horizontal',
};

function loadSettings(): ReaderSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem('reader-settings');
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {}
  // Migrate old individual settings
  const oldFont = localStorage.getItem('reader-font-size');
  const oldTheme = localStorage.getItem('reader-theme');
  const settings = { ...DEFAULT_SETTINGS };
  if (oldFont) settings.fontSize = oldFont as FontSize;
  if (oldTheme) settings.theme = oldTheme as Theme;
  return settings;
}

function saveSettings(settings: ReaderSettings) {
  localStorage.setItem('reader-settings', JSON.stringify(settings));
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

export default function ReaderPage() {
  const params = useParams();
  const episodeId = params.episodeId as string;
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const isMobile = useIsMobile();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [episodes, setEpisodes] = useState<{ id: string; title: string; orderIndex: number }[]>([]);
  const [prologue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showLetters, setShowLetters] = useState(false);
  const [showCompanion, setShowCompanion] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [showCompleteBanner, setShowCompleteBanner] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Highlight state
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [selectedHighlight, setSelectedHighlight] = useState<Highlight | null>(null);
  const [highlightPopoverPos, setHighlightPopoverPos] = useState({ top: 0, left: 0 });

  // Letter compose dialog (rendered at page level for mobile to avoid BottomSheet nesting)
  const [showLetterCompose, setShowLetterCompose] = useState(false);
  const [letterReloadKey, setLetterReloadKey] = useState(0);

  // AI Explanation dialog
  const [explainText, setExplainText] = useState('');
  const [showExplainDialog, setShowExplainDialog] = useState(false);

  // World Fragments
  const [hasWorldFragments, setHasWorldFragments] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readStartRef = useRef(Date.now());
  const accumulatedReadTimeRef = useRef(0);

  // Load settings
  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  // Episode data loading
  useEffect(() => {
    setLoading(true);
    setShowCompleteBanner(false);
    api.getEpisode(episodeId)
      .then((res) => {
        setEpisode(res.data);
        // Record initial reading progress (0%) so character talk knows this episode was opened
        if (isAuthenticated) {
          api.updateReadingProgress(res.data.workId, {
            episodeId,
            progressPct: 0,
            lastPosition: 0,
            readTimeMs: 0,
          }).catch(() => {});
        }
        return Promise.all([
          api.getEpisodes(res.data.workId, true),
          api.getWork(res.data.workId),
        ]);
      })
      .then(([epRes, workRes]) => {
        const sorted = (epRes.data as { id: string; title: string; orderIndex: number }[])
          .sort((a, b) => a.orderIndex - b.orderIndex);
        setEpisodes(sorted);
        // Check if Canon exists for World Fragments
        const wId = (workRes as any)?.data?.id ?? (workRes as any)?.id;
        if (wId) {
          worldFragmentsApi.getCanon(wId)
            .then(() => setHasWorldFragments(true))
            .catch(() => setHasWorldFragments(false));
        }
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [episodeId, router]);

  // Restore scroll position from saved reading progress
  useEffect(() => {
    if (!isAuthenticated || !episode) return;
    api.getReadingProgress(episode.workId)
      .then((res) => {
        const entry = res.data.find((p) => p.episodeId === episodeId);
        if (entry && entry.lastPosition > 0) {
          // Delay to ensure content is rendered
          requestAnimationFrame(() => {
            window.scrollTo(0, entry.lastPosition);
          });
        }
      })
      .catch(() => {});
  }, [episodeId, isAuthenticated, episode]);

  // Load highlights
  useEffect(() => {
    if (!isAuthenticated) return;
    api.getHighlightsForEpisode(episodeId)
      .then((res) => setHighlights(res.data))
      .catch(() => {});
  }, [episodeId, isAuthenticated]);

  const saveProgress = useCallback(
    (pct: number, scrollPos: number) => {
      if (!isAuthenticated || !episode) return;
      const now = Date.now();
      const elapsed = now - readStartRef.current;
      readStartRef.current = now;
      accumulatedReadTimeRef.current += elapsed;

      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
      progressTimerRef.current = setTimeout(() => {
        const readTime = accumulatedReadTimeRef.current;
        api.updateReadingProgress(episode.workId, {
          episodeId,
          progressPct: pct,
          lastPosition: scrollPos,
          readTimeMs: readTime,
        }).then(() => {
          // Only reset on success - failed time will be included in next send
          accumulatedReadTimeRef.current -= readTime;
        }).catch(() => {});
      }, PROGRESS_DEBOUNCE);
    },
    [episodeId, isAuthenticated, episode],
  );

  useEffect(() => {
    function handleScroll() {
      const el = contentRef.current;
      if (!el) return;
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 1;
      setProgressPct(pct);
      saveProgress(pct, scrollTop);

      // Show complete banner at 90%
      if (pct >= 0.9 && !showCompleteBanner) {
        setShowCompleteBanner(true);
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [saveProgress, showCompleteBanner]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    };
  }, []);

  // Immersive mode: auto-hide cursor and header
  useEffect(() => {
    if (!immersiveMode) {
      setHeaderVisible(true);
      return;
    }
    setHeaderVisible(false);
    setShowSettings(false);
    setShowLetters(false);
    setShowCompanion(false);

    function handleMouseMove(e: MouseEvent) {
      // Show header when mouse near top
      if (e.clientY < 60) {
        setHeaderVisible(true);
      } else {
        setHeaderVisible(false);
      }

      // Auto-hide cursor
      document.body.style.cursor = 'default';
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = setTimeout(() => {
        if (immersiveMode) document.body.style.cursor = 'none';
      }, 3000);
    }

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.body.style.cursor = 'default';
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    };
  }, [immersiveMode]);

  function updateSettings(partial: Partial<ReaderSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }

  function resetSettings() {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }

  // Navigation helpers
  const currentIndex = episodes.findIndex((e) => e.id === episodeId);
  const prevEp = currentIndex > 0 ? episodes[currentIndex - 1] : null;
  const nextEp = currentIndex < episodes.length - 1 ? episodes[currentIndex + 1] : null;

  function navigatePrev() {
    if (prevEp) router.push(`/read/${prevEp.id}`);
  }
  function navigateNext() {
    if (nextEp) router.push(`/read/${nextEp.id}`);
  }

  // Keyboard shortcuts
  useReaderShortcuts({
    onPrevEpisode: navigatePrev,
    onNextEpisode: navigateNext,
    onToggleSettings: () => setShowSettings((v) => !v),
    onToggleComments: () => toggleLetters(),
    onToggleCompanion: () => toggleCompanion(),
    onToggleImmersive: () => setImmersiveMode((v) => !v),
    onEscape: () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false);
      else if (immersiveMode) setImmersiveMode(false);
      else if (showSettings) setShowSettings(false);
      else if (showLetters) setShowLetters(false);
      else if (showCompanion) setShowCompanion(false);
    },
    onShowHelp: () => setShowShortcutsHelp((v) => !v),
  });

  // Swipe navigation
  const { swipeEdge } = useSwipeNavigation({
    onSwipeLeft: navigateNext,
    onSwipeRight: navigatePrev,
  });

  // Letters
  function toggleLetters() {
    setShowLetters(!showLetters);
    if (showCompanion) setShowCompanion(false);
  }

  function toggleCompanion() {
    setShowCompanion(!showCompanion);
    if (showLetters) setShowLetters(false);
  }

  // Highlights
  function handleContentMouseUp() {
    if (!isAuthenticated || !episode) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    if (!text) return;

    const contentEl = contentRef.current;
    if (!contentEl) return;

    const content = episode.content;
    const startIdx = content.indexOf(text);
    if (startIdx === -1) return;

    const rect = range.getBoundingClientRect();
    setToolbarPosition({
      top: rect.top + window.scrollY,
      left: rect.left + rect.width / 2,
    });
    setSelectedRange({ start: startIdx, end: startIdx + text.length });
    setShowToolbar(true);
  }

  async function handleHighlightSave(color: string, memo: string) {
    if (!selectedRange) return;
    try {
      const res = await api.createHighlight({
        episodeId,
        startPos: selectedRange.start,
        endPos: selectedRange.end,
        color,
        memo: memo || undefined,
      });
      setHighlights((prev) => [...prev, res.data]);
    } catch {}
    window.getSelection()?.removeAllRanges();
    setSelectedRange(null);
  }

  async function handleAiExplain() {
    if (!selectedRange) return;
    try {
      const res = await api.createHighlight({
        episodeId,
        startPos: selectedRange.start,
        endPos: selectedRange.end,
        color: 'yellow',
      });
      setHighlights((prev) => [...prev, res.data]);
      const explainRes = await api.explainHighlight(res.data.id);
      setExplainText(explainRes.data.explanation);
      setShowExplainDialog(true);
    } catch {}
    window.getSelection()?.removeAllRanges();
    setSelectedRange(null);
    setShowToolbar(false);
  }

  function handleHighlightClick(h: Highlight, event?: React.MouseEvent) {
    const rect = event?.currentTarget?.getBoundingClientRect();
    setHighlightPopoverPos({
      top: rect ? rect.bottom + window.scrollY : 200,
      left: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
    });
    setSelectedHighlight(h);
  }

  async function handleHighlightUpdate(id: string, data: { memo?: string; color?: string }) {
    try {
      const res = await api.updateHighlight(id, data);
      setHighlights((prev) => prev.map((h) => (h.id === id ? { ...h, ...res.data } : h)));
    } catch {}
  }

  async function handleHighlightDelete(id: string) {
    try {
      await api.deleteHighlight(id);
      setHighlights((prev) => prev.filter((h) => h.id !== id));
    } catch {}
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (!episode) return null;

  const themeStyle = THEMES[settings.theme];
  const fontSizeClass = FONT_SIZES[settings.fontSize];
  const lineHeightClass = LINE_HEIGHTS[settings.lineHeight].class;
  const maxWidthClass = MAX_WIDTHS[settings.maxWidth].class;
  const isVertical = settings.writingMode === 'vertical';

  const settingsContent = (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">表示設定</span>
        {!isMobile && (
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)} className="h-8 w-8">
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">文字サイズ</label>
        <div className="flex gap-1">
          {(['sm', 'base', 'lg', 'xl'] as FontSize[]).map((s) => (
            <Button
              key={s}
              variant={settings.fontSize === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateSettings({ fontSize: s })}
              className="flex-1 text-xs min-h-[44px]"
            >
              {s === 'sm' ? '小' : s === 'base' ? '中' : s === 'lg' ? '大' : '特大'}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">行間</label>
        <div className="flex gap-1">
          {(Object.entries(LINE_HEIGHTS) as [LineHeight, typeof LINE_HEIGHTS.normal][]).map(([key, val]) => (
            <Button
              key={key}
              variant={settings.lineHeight === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateSettings({ lineHeight: key })}
              className="flex-1 text-xs min-h-[44px]"
            >
              {val.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">最大幅</label>
        <div className="flex gap-1">
          {(Object.entries(MAX_WIDTHS) as [MaxWidth, typeof MAX_WIDTHS.normal][]).map(([key, val]) => (
            <Button
              key={key}
              variant={settings.maxWidth === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateSettings({ maxWidth: key })}
              className="flex-1 text-xs min-h-[44px]"
            >
              {val.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">テーマ</label>
        <div className="flex gap-1">
          {(Object.entries(THEMES) as [Theme, typeof THEMES.light][]).map(([key, val]) => (
            <Button
              key={key}
              variant={settings.theme === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateSettings({ theme: key })}
              className="flex-1 text-xs min-h-[44px]"
            >
              {key === 'dark' ? <Moon className="h-3 w-3 mr-1" /> : key === 'light' ? <Sun className="h-3 w-3 mr-1" /> : null}
              {val.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">組方向</label>
        <div className="flex gap-1">
          <Button
            variant={settings.writingMode === 'horizontal' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateSettings({ writingMode: 'horizontal' })}
            className="flex-1 text-xs min-h-[44px]"
          >
            横書き
          </Button>
          <Button
            variant={settings.writingMode === 'vertical' ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateSettings({ writingMode: 'vertical' })}
            className="flex-1 text-xs min-h-[44px]"
          >
            縦書き
          </Button>
        </div>
      </div>
      <div className="pt-2 border-t border-border">
        <Button variant="ghost" size="sm" onClick={resetSettings} className="w-full text-xs">
          デフォルトに戻す
        </Button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${themeStyle.bg} ${themeStyle.text} transition-colors`}>
      {/* Progress bar — horizontal only (vertical has its own) */}
      {!isVertical && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted" style={{ transform: 'translateZ(0)' }}>
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct * 100}%` }}
          />
        </div>
      )}

      {/* Swipe edge indicators — horizontal only */}
      {!isVertical && swipeEdge === 'left' && prevEp && (
        <div className="fixed left-0 top-0 bottom-0 w-1 bg-primary/50 z-50 animate-in fade-in" />
      )}
      {!isVertical && swipeEdge === 'right' && nextEp && (
        <div className="fixed right-0 top-0 bottom-0 w-1 bg-primary/50 z-50 animate-in fade-in" />
      )}

      {/* Top nav — hidden in vertical mode (vertical reader has its own header) */}
      {!isVertical && <header
        className={`sticky top-1 z-40 flex items-center justify-between px-4 py-2 transition-all duration-300 ${
          immersiveMode && !headerVisible ? 'opacity-0 pointer-events-none -translate-y-full' : 'opacity-100'
        }`}
      >
        <Link href={`/works/${episode.workId}`}>
          <Button variant="ghost" size="sm" className="gap-1 min-h-[44px]">
            <ChevronLeft className="h-4 w-4" /> 作品へ戻る
          </Button>
        </Link>
        <div className="flex items-center gap-1">
          {episode && (
            <span className="text-xs text-muted-foreground mr-2 hidden sm:inline">
              残り {estimateReadingTime(Math.round(episode.wordCount * (1 - progressPct)))}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={toggleCompanion} className="min-h-[44px] min-w-[44px]" title="キャラクタートーク (a)">
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleLetters} className="min-h-[44px] min-w-[44px]" title="ギフトレター (c)">
            <Mail className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)} className="min-h-[44px] min-w-[44px]" title="設定 (s)">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>}

      {/* Settings panel - desktop: popover, mobile: bottom sheet */}
      {showSettings && !isMobile && (
        <div className="fixed right-4 top-14 z-50 w-72 rounded-lg border border-border bg-card text-card-foreground shadow-lg">
          {settingsContent}
        </div>
      )}
      {isMobile && (
        <BottomSheet open={showSettings} onClose={() => setShowSettings(false)} title="表示設定">
          {settingsContent}
        </BottomSheet>
      )}

      {/* Highlight toolbar */}
      {showToolbar && (
        <HighlightToolbar
          position={toolbarPosition}
          onSave={handleHighlightSave}
          onAiExplain={handleAiExplain}
          onClose={() => { setShowToolbar(false); setSelectedRange(null); window.getSelection()?.removeAllRanges(); }}
        />
      )}

      {/* Highlight detail popover */}
      {selectedHighlight && (
        <HighlightDetailPopover
          highlight={selectedHighlight}
          position={highlightPopoverPos}
          onUpdate={handleHighlightUpdate}
          onDelete={handleHighlightDelete}
          onClose={() => setSelectedHighlight(null)}
        />
      )}

      {/* AI Explanation Dialog */}
      <Dialog open={showExplainDialog} onOpenChange={setShowExplainDialog}>
        <DialogHeader>
          <DialogTitle>AI解説</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{explainText}</p>
        </DialogContent>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { navigator.clipboard.writeText(explainText); }}
          >
            <Copy className="h-3 w-3 mr-1" /> コピー
          </Button>
          <Button size="sm" onClick={() => setShowExplainDialog(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Keyboard shortcuts help */}
      <ShortcutsHelp open={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />

      {/* Main content — vertical or horizontal */}
      {isVertical ? (
        <VerticalReader
          episode={episode}
          highlights={highlights}
          fontSize={settings.fontSize}
          lineHeight={lineHeightClass}
          onHighlightClick={(h, e) => handleHighlightClick(h, e)}
          onContentMouseUp={handleContentMouseUp}
          contentRef={contentRef}
          onProgressChange={(pct) => {
            setProgressPct(pct);
            saveProgress(pct, 0);
          }}
          onLastPageReached={() => {
            if (!showCompleteBanner) setShowCompleteBanner(true);
          }}
          onSettingsClick={() => setShowSettings(true)}
          onExitVertical={() => updateSettings({ writingMode: 'horizontal' })}
          onLetterClick={toggleLetters}
          onCharacterTalkClick={toggleCompanion}
          prevEpisode={prevEp}
          nextEpisode={nextEp}
        />
      ) : null}
      {!isVertical && <article ref={contentRef} className={`mx-auto ${maxWidthClass} px-6 py-12`} onMouseUp={handleContentMouseUp}>
        {prologue && (
          <div className="mb-12 border-l-2 border-primary/30 pl-5">
            <p className={`font-serif ${fontSizeClass} ${lineHeightClass} whitespace-pre-wrap text-muted-foreground italic`}>
              {prologue}
            </p>
            <div className="mt-6 border-t border-border/50" />
          </div>
        )}
        <h1 className="text-2xl font-bold font-serif mb-8 text-center">
          {episode.title}
        </h1>
        <div className={`font-serif ${fontSizeClass} ${lineHeightClass} whitespace-pre-wrap`}>
          <HighlightedText
            text={episode.content}
            highlights={highlights}
            onHighlightClick={(h, e) => handleHighlightClick(h, e)}
          />
        </div>
      </article>}

      {/* Episode complete banner — horizontal only */}
      {!isVertical && showCompleteBanner && (
        <EpisodeCompleteBanner
          episodeId={episodeId}
          nextEpisodeId={nextEp?.id}
          workId={episode.workId}
          hasWorldFragments={hasWorldFragments}
        />
      )}

      {/* Navigation — horizontal only */}
      {!isVertical && <nav className={`mx-auto ${maxWidthClass} px-6 py-8 flex justify-between border-t border-border/50`}>
        {prevEp ? (
          <Link href={`/read/${prevEp.id}`}>
            <Button variant="outline" className="gap-1 min-h-[44px]">
              <ChevronLeft className="h-4 w-4" /> 前話
            </Button>
          </Link>
        ) : (
          <div />
        )}
        {nextEp ? (
          <Link href={`/read/${nextEp.id}`}>
            <Button variant="outline" className="gap-1 min-h-[44px]">
              次話 <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <Link href={`/works/${episode.workId}/afterword`}>
            <Button variant="default" className="min-h-[44px]">読了</Button>
          </Link>
        )}
      </nav>}

      {/* Floating action buttons -- desktop only, hidden in vertical mode */}
      {!isMobile && !immersiveMode && !isVertical && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
          {!showLetters && (
            <button
              onClick={toggleLetters}
              className="flex items-center gap-2 rounded-full bg-card text-foreground border border-border px-5 py-3 shadow-lg hover:bg-secondary transition-all hover:scale-105 active:scale-95"
            >
              <Mail className="h-5 w-5" />
              <span className="text-sm font-medium">ギフトレターを書く</span>
            </button>
          )}
          {!showCompanion && (
            <button
              onClick={toggleCompanion}
              className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm font-medium">キャラクターと話す</span>
            </button>
          )}
        </div>
      )}

      {/* Mobile bottom navigation bar -- hidden in vertical mode */}
      {isMobile && !immersiveMode && !isVertical && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur border-t border-border flex justify-around py-2 px-4">
          <Button variant="ghost" size="sm" onClick={navigatePrev} disabled={!prevEp} className="flex-col gap-0.5 h-auto py-1">
            <ChevronLeft className="h-4 w-4" />
            <span className="text-[10px]">前話</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleLetters} className="flex-col gap-0.5 h-auto py-1">
            <Mail className="h-4 w-4" />
            <span className="text-[10px]">ギフト</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleCompanion} className="flex-col gap-0.5 h-auto py-1">
            <MessageCircle className="h-4 w-4" />
            <span className="text-[10px]">キャラ</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={navigateNext} disabled={!nextEp} className="flex-col gap-0.5 h-auto py-1">
            <ChevronRight className="h-4 w-4" />
            <span className="text-[10px]">次話</span>
          </Button>
        </div>
      )}

      {/* Letters sidebar / BottomSheet */}
      {isMobile ? (
        <BottomSheet open={showLetters} onClose={() => setShowLetters(false)} title="ギフトレター">
          <LetterPanel
            episodeId={episodeId}
            isAuthenticated={isAuthenticated}
            reloadKey={letterReloadKey}
            onCompose={() => {
              setShowLetters(false);
              // Small delay so BottomSheet closes before dialog opens
              setTimeout(() => setShowLetterCompose(true), 200);
            }}
          />
        </BottomSheet>
      ) : showLetters ? (
        <div className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-card text-card-foreground border-l border-border shadow-xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="font-medium text-sm">ギフトレター</span>
            <Button variant="ghost" size="icon" onClick={() => setShowLetters(false)} className="h-9 w-9">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <LetterPanel episodeId={episodeId} isAuthenticated={isAuthenticated} reloadKey={letterReloadKey} />
        </div>
      ) : null}

      {/* Letter compose dialog — rendered at page level to avoid BottomSheet/z-index issues on mobile */}
      <LetterComposeDialog
        open={showLetterCompose}
        onOpenChange={setShowLetterCompose}
        episodeId={episodeId}
        onSent={() => {
          setShowLetterCompose(false);
          setLetterReloadKey((k) => k + 1);
        }}
      />

      {/* Companion sidebar / BottomSheet */}
      {isMobile ? (
        <BottomSheet open={showCompanion} onClose={() => setShowCompanion(false)} title="キャラクタートーク">
          <div className="h-[60vh] flex flex-col overflow-hidden">
            <CharacterTalkChat workId={episode.workId} episodeId={episodeId} />
          </div>
        </BottomSheet>
      ) : showCompanion ? (
        <div className="fixed right-0 top-0 bottom-0 z-50 w-96 bg-card text-card-foreground border-l border-border shadow-xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="font-medium text-sm">キャラクタートーク</span>
            <Button variant="ghost" size="icon" onClick={() => setShowCompanion(false)} className="h-9 w-9">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <CharacterTalkChat workId={episode.workId} episodeId={episodeId} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

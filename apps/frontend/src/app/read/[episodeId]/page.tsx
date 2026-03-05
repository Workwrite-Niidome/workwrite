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
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { api, type Episode, type Comment } from '@/lib/api';

type FontSize = 'sm' | 'base' | 'lg' | 'xl';
type Theme = 'light' | 'dark' | 'sepia';

const FONT_SIZES: Record<FontSize, string> = {
  sm: 'text-sm leading-7',
  base: 'text-base leading-8',
  lg: 'text-lg leading-9',
  xl: 'text-xl leading-10',
};

const THEMES: Record<Theme, { bg: string; text: string; label: string }> = {
  light: { bg: 'bg-white dark:bg-gray-50', text: 'text-gray-900', label: '明るい' },
  dark: { bg: 'bg-gray-900', text: 'text-gray-100', label: '暗い' },
  sepia: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-950 dark:text-amber-100', label: 'セピア' },
};

const PROGRESS_DEBOUNCE = 5000;

export default function ReaderPage() {
  const params = useParams();
  const episodeId = params.episodeId as string;
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [episodes, setEpisodes] = useState<{ id: string; title: string; orderIndex: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState<FontSize>('base');
  const [theme, setTheme] = useState<Theme>('light');
  const [showSettings, setShowSettings] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [progressPct, setProgressPct] = useState(0);

  const contentRef = useRef<HTMLDivElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    api.getEpisode(episodeId)
      .then((res) => {
        setEpisode(res.data);
        return api.getEpisodes(res.data.workId);
      })
      .then((res) => {
        setEpisodes(
          (res.data as { id: string; title: string; orderIndex: number }[])
            .sort((a, b) => a.orderIndex - b.orderIndex),
        );
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [episodeId, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('reader-font-size');
      if (saved) setFontSize(saved as FontSize);
      const savedTheme = localStorage.getItem('reader-theme');
      if (savedTheme) setTheme(savedTheme as Theme);
    }
  }, []);

  const saveProgress = useCallback(
    (pct: number, scrollPos: number) => {
      if (!isAuthenticated) return;
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
      progressTimerRef.current = setTimeout(() => {
        api.updateReadingProgress({
          episodeId,
          progressPct: pct,
          scrollPosition: scrollPos,
        }).catch(() => {});
      }, PROGRESS_DEBOUNCE);
    },
    [episodeId, isAuthenticated],
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
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [saveProgress]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    };
  }, []);

  function handleFontSizeChange(size: FontSize) {
    setFontSize(size);
    localStorage.setItem('reader-font-size', size);
  }

  function handleThemeChange(t: Theme) {
    setTheme(t);
    localStorage.setItem('reader-theme', t);
  }

  async function loadComments() {
    try {
      const res = await api.getCommentsForEpisode(episodeId);
      setComments(res.data);
    } catch {}
  }

  async function handlePostComment() {
    if (!commentText.trim()) return;
    try {
      const res = await api.createComment({ episodeId, content: commentText });
      setComments((prev) => [...prev, res.data]);
      setCommentText('');
    } catch {}
  }

  function toggleComments() {
    if (!showComments) loadComments();
    setShowComments(!showComments);
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

  const currentIndex = episodes.findIndex((e) => e.id === episodeId);
  const prevEp = currentIndex > 0 ? episodes[currentIndex - 1] : null;
  const nextEp = currentIndex < episodes.length - 1 ? episodes[currentIndex + 1] : null;
  const themeStyle = THEMES[theme];

  return (
    <div className={`min-h-screen ${themeStyle.bg} ${themeStyle.text} transition-colors`}>
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progressPct * 100}%` }}
        />
      </div>

      {/* Top nav */}
      <header className="sticky top-1 z-40 flex items-center justify-between px-4 py-2">
        <Link href={`/works/${episode.workId}`}>
          <Button variant="ghost" size="sm" className="gap-1 min-h-[44px]">
            <ChevronLeft className="h-4 w-4" /> 作品へ戻る
          </Button>
        </Link>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={toggleComments} className="min-h-[44px] min-w-[44px]">
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)} className="min-h-[44px] min-w-[44px]">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Settings panel */}
      {showSettings && (
        <div className="fixed right-4 top-14 z-50 w-64 rounded-lg border border-border bg-card text-card-foreground p-4 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">表示設定</span>
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)} className="h-8 w-8">
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">文字サイズ</label>
            <div className="flex gap-1">
              {(Object.keys(FONT_SIZES) as FontSize[]).map((s) => (
                <Button
                  key={s}
                  variant={fontSize === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleFontSizeChange(s)}
                  className="flex-1 text-xs min-h-[44px]"
                >
                  {s === 'sm' ? '小' : s === 'base' ? '中' : s === 'lg' ? '大' : '特大'}
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
                  variant={theme === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleThemeChange(key)}
                  className="flex-1 text-xs min-h-[44px]"
                >
                  {key === 'dark' ? <Moon className="h-3 w-3 mr-1" /> : key === 'light' ? <Sun className="h-3 w-3 mr-1" /> : null}
                  {val.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <article ref={contentRef} className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold font-serif mb-8 text-center">
          {episode.title}
        </h1>
        <div
          className={`font-serif ${FONT_SIZES[fontSize]} whitespace-pre-wrap`}
        >
          {episode.content}
        </div>
      </article>

      {/* Navigation */}
      <nav className="mx-auto max-w-2xl px-6 py-8 flex justify-between border-t border-border/50">
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
      </nav>

      {/* Comments sidebar */}
      {showComments && (
        <div className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-card text-card-foreground border-l border-border shadow-xl flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="font-medium text-sm">コメント</span>
            <Button variant="ghost" size="icon" onClick={() => setShowComments(false)} className="h-9 w-9">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                コメントはまだありません
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">
                      {c.user.displayName || c.user.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  <p className="text-sm">{c.content}</p>
                </div>
              ))
            )}
          </div>
          {isAuthenticated && (
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                  placeholder="コメントを入力..."
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <Button size="sm" onClick={handlePostComment} className="min-h-[40px]">
                  送信
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Trash2, BarChart3, BookMarked, Heart, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/lib/auth-context';
import { api, type BookshelfEntry } from '@/lib/api';

type Tab = 'READING' | 'WANT_TO_READ' | 'COMPLETED';
type SortKey = 'updatedAt' | 'title' | 'score' | 'progress';

const TABS = [
  { key: 'READING', label: '読書中' },
  { key: 'WANT_TO_READ', label: '読みたい' },
  { key: 'COMPLETED', label: '読了' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'updatedAt', label: '更新日' },
  { value: 'title', label: 'タイトル' },
  { value: 'score', label: 'スコア' },
  { value: 'progress', label: '進捗' },
];

function sortEntries(entries: BookshelfEntry[], sortKey: SortKey): BookshelfEntry[] {
  return [...entries].sort((a, b) => {
    switch (sortKey) {
      case 'title':
        return a.work.title.localeCompare(b.work.title, 'ja');
      case 'score':
        return (b.work.qualityScore?.overall ?? 0) - (a.work.qualityScore?.overall ?? 0);
      case 'progress':
        return (b.progressPct ?? 0) - (a.progressPct ?? 0);
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });
}

export default function BookshelfPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('READING');
  const [entries, setEntries] = useState<BookshelfEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [confirmRemoveWorkId, setConfirmRemoveWorkId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    api.getBookshelf(activeTab)
      .then((res) => setEntries(res.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [activeTab, isAuthenticated]);

  async function handleRemove(workId: string) {
    try {
      await api.removeFromBookshelf(workId);
      setEntries((prev) => prev.filter((e) => e.workId !== workId));
    } catch {}
    setConfirmRemoveWorkId(null);
  }

  async function handleStatusChange(workId: string, status: Tab) {
    try {
      await api.updateBookshelfStatus(workId, status);
      setEntries((prev) => prev.filter((e) => e.workId !== workId));
    } catch {}
  }

  if (authLoading) {
    return (
      <div className="px-4 py-8 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const sorted = sortEntries(entries, sortKey);

  return (
    <div className="px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">本棚</h1>
        <Link href="/stats">
          <Button variant="outline" size="sm" className="gap-1">
            <BarChart3 className="h-4 w-4" /> 読書統計
          </Button>
        </Link>
      </div>

      <Tabs
        tabs={TABS}
        activeKey={activeTab}
        onTabChange={(key) => setActiveTab(key as Tab)}
        className="mb-4"
      />

      {/* Sort selector */}
      <div className="flex justify-end mb-4">
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="h-8 rounded-lg border border-border bg-transparent px-2 text-xs"
          aria-label="並べ替え"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={activeTab === 'READING' ? BookMarked : activeTab === 'WANT_TO_READ' ? Heart : CheckCircle2}
          title={
            activeTab === 'READING' ? 'まだ読書中の作品はありません'
            : activeTab === 'WANT_TO_READ' ? 'まだ読みたい作品はありません'
            : 'まだ読了した作品はありません'
          }
          description="気になる作品を見つけて本棚に追加しましょう"
          action={{ label: '作品を探す', href: '/' }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((entry) => (
            <Card key={entry.id} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/works/${entry.workId}`}
                      className="text-sm font-medium hover:text-primary line-clamp-2"
                    >
                      {entry.work.title}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1">
                      {entry.work.author.displayName || entry.work.author.name}
                    </p>
                    {entry.work.genre && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        {entry.work.genre}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {activeTab !== 'READING' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs min-h-[44px]"
                        onClick={() => handleStatusChange(entry.workId, 'READING')}
                      >
                        <BookOpen className="h-3 w-3 mr-1" /> 読書中へ
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground"
                      onClick={() => setConfirmRemoveWorkId(entry.workId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Progress bar */}
                {entry.progressPct != null && entry.progressPct > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.round(entry.progressPct * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">
                        {Math.round(entry.progressPct * 100)}%
                      </span>
                    </div>
                    {entry.currentEpisode && activeTab === 'READING' && (
                      <Link
                        href={`/read/${entry.currentEpisode.id}`}
                        className="inline-block mt-2"
                      >
                        <Button variant="outline" size="sm" className="text-xs h-7">
                          続きを読む
                        </Button>
                      </Link>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <span>
                    {new Date(entry.updatedAt).toLocaleDateString('ja-JP')}
                  </span>
                  {entry.work.qualityScore && (
                    <Badge variant="secondary" className="text-xs">
                      スコア {Math.round(entry.work.qualityScore.overall)}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmRemoveWorkId}
        onOpenChange={(open) => { if (!open) setConfirmRemoveWorkId(null); }}
        title="本棚から削除"
        message="この作品を本棚から削除しますか？読書進捗は保持されます。"
        confirmLabel="削除"
        variant="destructive"
        onConfirm={() => confirmRemoveWorkId && handleRemove(confirmRemoveWorkId)}
      />
    </div>
  );
}

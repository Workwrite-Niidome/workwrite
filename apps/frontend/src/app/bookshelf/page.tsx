'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { api, type BookshelfEntry } from '@/lib/api';

type Tab = 'READING' | 'WANT_TO_READ' | 'COMPLETED';

const TABS: { key: Tab; label: string }[] = [
  { key: 'READING', label: '読書中' },
  { key: 'WANT_TO_READ', label: '読みたい' },
  { key: 'COMPLETED', label: '読了' },
];

export default function BookshelfPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('READING');
  const [entries, setEntries] = useState<BookshelfEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
  }

  async function handleStatusChange(workId: string, status: Tab) {
    try {
      await api.updateBookshelfStatus(workId, status);
      setEntries((prev) => prev.filter((e) => e.workId !== workId));
    } catch {}
  }

  if (authLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">本棚</h1>

      <div className="flex gap-1 mb-6 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">
            {activeTab === 'READING' && 'まだ読書中の作品はありません'}
            {activeTab === 'WANT_TO_READ' && 'まだ読みたい作品はありません'}
            {activeTab === 'COMPLETED' && 'まだ読了した作品はありません'}
          </p>
          <Link href="/">
            <Button variant="outline">作品を探す</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="overflow-hidden">
              <CardContent className="p-4">
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
                        className="text-xs"
                        onClick={() => handleStatusChange(entry.workId, 'READING')}
                      >
                        <BookOpen className="h-3 w-3 mr-1" /> 読書中へ
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => handleRemove(entry.workId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
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
    </div>
  );
}

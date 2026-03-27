'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type RecentEpisode } from '@/lib/api';

const PAGE_SIZE = 20;

export default function RecentEpisodesPage() {
  const [episodes, setEpisodes] = useState<RecentEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    api.getRecentEpisodes(PAGE_SIZE, 0)
      .then((res) => {
        const data = res.data;
        setEpisodes(Array.isArray(data) ? data : []);
        setHasMore(Array.isArray(data) && data.length >= PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    api.getRecentEpisodes(PAGE_SIZE, episodes.length)
      .then((res) => {
        const data = res.data;
        const newItems = Array.isArray(data) ? data : [];
        setEpisodes((prev) => [...prev, ...newItems]);
        setHasMore(newItems.length >= PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [episodes.length, loadingMore, hasMore]);

  return (
    <div className="min-h-screen px-4 md:px-6 py-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-medium">新着エピソード</h1>
      </div>

      <div className="space-y-2">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))
          : episodes.map((ep) => (
              <Link
                key={ep.id}
                href={`/works/${ep.work.id}/read/${ep.id}`}
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {ep.chapterTitle ? `${ep.chapterTitle} ` : ''}
                    {ep.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {ep.work.title}
                    <span className="mx-1">·</span>
                    {ep.work.author.displayName || ep.work.author.name}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                  <span>{ep.wordCount.toLocaleString()}字</span>
                  {ep.publishedAt && (
                    <>
                      <Clock className="h-3 w-3" />
                      <span>{new Date(ep.publishedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</span>
                    </>
                  )}
                </div>
              </Link>
            ))}
      </div>

      {!loading && episodes.length === 0 && (
        <p className="text-center text-muted-foreground py-12 text-sm">
          まだエピソードが公開されていません
        </p>
      )}

      {hasMore && !loading && (
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? '読み込み中...' : 'もっと見る'}
          </Button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    <div className="min-h-screen px-4 md:px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-medium">新着エピソード</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-3 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))
          : episodes.map((ep) => (
              <Link key={ep.id} href={`/works/${ep.work.id}`} className="group block">
                <Card className="h-full hover:shadow-md hover:border-primary/20 transition-all">
                  <CardContent className="p-3 space-y-1.5">
                    <p className="text-xs font-medium line-clamp-1 group-hover:text-foreground/80 transition-colors">
                      {ep.work.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {ep.work.author.displayName || ep.work.author.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      第{ep.orderIndex + 1}話 更新
                    </p>
                  </CardContent>
                </Card>
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

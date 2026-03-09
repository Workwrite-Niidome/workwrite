'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Flame, BookOpen, Clock, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { api, type ReadingStats } from '@/lib/api';

function formatReadTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}時間${minutes}分`;
  return `${minutes}分`;
}

const GENRE_LABELS: Record<string, string> = {
  fantasy: 'ファンタジー',
  sf: 'SF',
  mystery: 'ミステリー',
  romance: '恋愛',
  horror: 'ホラー',
  literary: '純文学',
  adventure: '冒険',
  comedy: 'コメディ',
  drama: 'ドラマ',
  historical: '歴史',
  other: 'その他',
};

export default function StatsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.getReadingStats()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const maxGenreCount = Math.max(...Object.values(stats.genreDistribution), 1);
  const maxMonthlyCount = Math.max(...stats.monthlyActivity.map((m) => m.count), 1);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/bookshelf">
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">読書統計</h1>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="h-5 w-5 mx-auto text-primary/60 mb-1" />
            <p className="text-2xl font-bold">{stats.completedWorks}</p>
            <p className="text-xs text-muted-foreground">読了作品</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-primary/60 mb-1" />
            <p className="text-2xl font-bold">{formatReadTime(stats.totalReadTimeMs)}</p>
            <p className="text-xs text-muted-foreground">総読書時間</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Flame className="h-5 w-5 mx-auto text-orange-500/60 mb-1" />
            <p className="text-2xl font-bold">{stats.currentStreak}<span className="text-sm font-normal">日</span></p>
            <p className="text-xs text-muted-foreground">現在のストリーク</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Trophy className="h-5 w-5 mx-auto text-yellow-500/60 mb-1" />
            <p className="text-2xl font-bold">{stats.maxStreak}<span className="text-sm font-normal">日</span></p>
            <p className="text-xs text-muted-foreground">最長ストリーク</p>
          </CardContent>
        </Card>
      </div>

      {/* Genre distribution */}
      {Object.keys(stats.genreDistribution).length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium mb-4">ジャンル分布</h2>
          <div className="space-y-2">
            {Object.entries(stats.genreDistribution)
              .sort(([, a], [, b]) => b - a)
              .map(([genre, count]) => (
                <div key={genre} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 text-right shrink-0">
                    {GENRE_LABELS[genre] || genre}
                  </span>
                  <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded transition-all"
                      style={{ width: `${(count / maxGenreCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-6">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Monthly activity */}
      {stats.monthlyActivity.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium mb-4">月間アクティビティ</h2>
          <div className="flex items-end gap-1 h-24">
            {stats.monthlyActivity.map((m) => {
              const height = maxMonthlyCount > 0 ? (m.count / maxMonthlyCount) * 100 : 0;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                    <div
                      className="w-full max-w-[24px] bg-primary/60 rounded-t transition-all hover:bg-primary/80"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${m.month}: ${m.count}件`}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {m.month.split('-')[1]}月
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top emotion tags */}
      {stats.topEmotionTags.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium mb-4">よく使う感情タグ</h2>
          <div className="flex flex-wrap gap-2">
            {stats.topEmotionTags.map((tag) => (
              <Badge key={tag.name} variant="secondary" className="text-xs">
                {tag.nameJa} ({tag.count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Extra info */}
      <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
        読了エピソード数: {stats.completedEpisodes}
      </div>
    </div>
  );
}

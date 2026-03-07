'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp, Heart, MessageSquare, ArrowUpRight, ArrowDownRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { api, type TimelineData } from '@/lib/api';

const AXIS_LABELS: Record<string, string> = {
  confidence: '自信',
  worldview: '世界観',
  empathy: '共感力',
  motivation: 'モチベーション',
};

export default function TimelinePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<TimelineData | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [narrativeText, setNarrativeText] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([
      api.getTimeline(),
      api.getPoints(),
    ]).then(([timelineRes, pointsRes]) => {
      setData(timelineRes.data);
      setPoints(pointsRes.data.balance);
    }).catch(() => {})
      .finally(() => setLoading(false));
    // Fetch AI narrative
    api.getTimelineNarrative()
      .then((res) => setNarrativeText(res.data.narrative))
      .catch(() => {})
      .finally(() => setNarrativeLoading(false));
  }, [isAuthenticated]);

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">自己変容タイムライン</h1>

      {/* AI Narrative */}
      {narrativeLoading ? (
        <Card className="mb-8">
          <CardContent className="pt-6">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      ) : narrativeText ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> あなたの読書の物語
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {narrativeText}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-primary">{data.totalWorks}</p>
            <p className="text-sm text-muted-foreground mt-1">影響を受けた作品</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-primary">{data.timeline.length}</p>
            <p className="text-sm text-muted-foreground mt-1">記録数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-accent">{points}</p>
            <p className="text-sm text-muted-foreground mt-1">ポイント</p>
          </CardContent>
        </Card>
      </div>

      {/* Growth Summary */}
      {Object.keys(data.growthSummary).length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> 成長サマリ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(data.growthSummary).map(([axis, summary]) => (
                <div key={axis} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm font-medium">{AXIS_LABELS[axis] || axis}</span>
                  <div className="flex items-center gap-2">
                    {summary.totalChange >= 0 ? (
                      <ArrowUpRight className="h-4 w-4 text-green-500 dark:text-green-400" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-red-500 dark:text-red-400" />
                    )}
                    <span className={`text-sm font-bold ${summary.totalChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {summary.totalChange > 0 ? '+' : ''}{summary.totalChange}
                    </span>
                    <span className="text-xs text-muted-foreground">({summary.count}作品)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {data.timeline.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">
            まだ記録がありません。作品を読んで感想を記録しましょう。
          </p>
          <Link href="/">
            <button className="text-primary hover:underline text-sm">作品を探す</button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">タイムライン</h2>
          <div className="relative border-l-2 border-border pl-6 space-y-6">
            {data.timeline.map((entry, i) => {
              const d = entry.data as Record<string, unknown>;
              const work = d.work as { id: string; title: string } | undefined;
              return (
                <div key={i} className="relative">
                  <div className="absolute -left-8 top-1 h-3 w-3 rounded-full bg-primary" />
                  <div className="text-xs text-muted-foreground mb-1">
                    {new Date(entry.date).toLocaleDateString('ja-JP')}
                  </div>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        {entry.type === 'state_change' && (
                          <TrendingUp className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
                        )}
                        {entry.type === 'emotion_tag' && (
                          <Heart className="h-4 w-4 text-pink-500 dark:text-pink-400 mt-0.5 shrink-0" />
                        )}
                        {entry.type === 'review' && (
                          <MessageSquare className="h-4 w-4 text-green-500 dark:text-green-400 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          {entry.type === 'state_change' && (
                            <p className="text-sm">
                              <Badge variant="outline" className="text-xs mr-1">
                                {AXIS_LABELS[(d as { axis: string }).axis] || (d as { axis: string }).axis}
                              </Badge>
                              {(d as { before: number }).before} → {(d as { after: number }).after}
                            </p>
                          )}
                          {entry.type === 'emotion_tag' && (
                            <p className="text-sm">
                              <Badge variant="secondary" className="text-xs">
                                {((d as { tag: { nameJa: string } }).tag)?.nameJa}
                              </Badge>
                            </p>
                          )}
                          {entry.type === 'review' && (
                            <p className="text-sm line-clamp-2">{(d as { content: string }).content}</p>
                          )}
                          {work && (
                            <Link href={`/works/${work.id}`} className="text-xs text-primary hover:underline mt-1 inline-block">
                              {work.title}
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

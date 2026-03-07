'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Eye, BookOpen, MessageSquare, TrendingUp, BarChart3, Pencil, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type Work } from '@/lib/api';

interface DashboardOverview {
  totalWorks: number;
  publishedWorks: number;
  totalViews: number;
  totalReads: number;
  totalReviews: number;
  avgScore: number;
  works: (Work & { totalViews: number; totalReads: number })[];
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '下書き',
  PUBLISHED: '公開中',
  UNPUBLISHED: '非公開',
};

export default function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (api.getAuthorOverview() as Promise<{ data: DashboardOverview }>)
      .then((res) => setOverview(res.data))
      .catch(() => {
        // Fallback to old API if not authenticated as author
        api.getMyWorks()
          .then((res) => setOverview({
            totalWorks: res.data.length,
            publishedWorks: res.data.filter((w) => w.status === 'PUBLISHED').length,
            totalViews: 0, totalReads: 0, totalReviews: 0, avgScore: 0,
            works: res.data as (Work & { totalViews: number; totalReads: number })[],
          }))
          .catch(() => {});
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!overview) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">作家ダッシュボード</h1>
        <Link href="/works/new">
          <Button><Plus className="h-4 w-4 mr-2" /> 新規作品</Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">作品数</span>
            </div>
            <p className="text-2xl font-bold mt-1">{overview.publishedWorks}<span className="text-sm text-muted-foreground font-normal">/{overview.totalWorks}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">総閲覧数</span>
            </div>
            <p className="text-2xl font-bold mt-1">{overview.totalViews.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">レビュー</span>
            </div>
            <p className="text-2xl font-bold mt-1">{overview.totalReviews}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">平均スコア</span>
            </div>
            <p className="text-2xl font-bold mt-1">{overview.avgScore || '-'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Works List */}
      {overview.works.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">まだ作品がありません</p>
            <Link href="/works/new">
              <Button>最初の作品を作成する</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">作品一覧</h2>
          {overview.works.map((work) => (
            <Card key={work.id} className="group">
              <Link href={`/works/${work.id}/edit`} className="block">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CardTitle className="text-lg truncate group-hover:text-primary transition-colors">
                      {work.title}
                    </CardTitle>
                    <Badge variant={work.status === 'PUBLISHED' ? 'default' : 'secondary'} className="shrink-0">
                      {STATUS_LABELS[work.status]}
                    </Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{work._count?.episodes ?? 0} エピソード</span>
                    <span><Eye className="h-3 w-3 inline mr-0.5" />{work.totalViews}</span>
                    <span>{work._count?.reviews ?? 0} レビュー</span>
                    {work.qualityScore && (
                      <Badge variant="secondary">スコア {Math.round(work.qualityScore.overall)}</Badge>
                    )}
                    {work.genre && <Badge variant="outline">{work.genre}</Badge>}
                  </div>
                </CardContent>
              </Link>
              <div className="px-6 pb-4 flex gap-2">
                <Link href={`/works/${work.id}/episodes/new`}>
                  <Button variant="outline" size="sm" className="text-xs h-8">
                    <Plus className="h-3 w-3 mr-1" /> エピソード追加
                  </Button>
                </Link>
                <Link href={`/works/${work.id}/edit`}>
                  <Button variant="ghost" size="sm" className="text-xs h-8">
                    <Pencil className="h-3 w-3 mr-1" /> 編集
                  </Button>
                </Link>
                <Link href={`/dashboard/works/${work.id}`}>
                  <Button variant="ghost" size="sm" className="text-xs h-8">
                    <BarChart3 className="h-3 w-3 mr-1" /> 分析
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

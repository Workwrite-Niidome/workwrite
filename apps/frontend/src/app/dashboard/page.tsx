'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Eye, BookOpen, MessageSquare, TrendingUp, BarChart3, Pencil, ChevronRight, Upload, FileEdit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScoreBadge } from '@/components/scoring/score-badge';
import { api, type Work } from '@/lib/api';
import { loadDrafts, deleteDraft, type WizardDraft } from '@/lib/wizard-drafts';

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
  const [drafts, setDrafts] = useState<WizardDraft[]>([]);

  useEffect(() => {
    setDrafts(loadDrafts());
  }, []);

  function handleDeleteDraft(id: string) {
    deleteDraft(id);
    setDrafts(loadDrafts());
  }

  useEffect(() => {
    (api.getAuthorOverview() as Promise<{ data: DashboardOverview }>)
      .then((res) => setOverview(res.data))
      .catch(() => {
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
        <div className="flex gap-2">
          <Link href="/works/import">
            <Button variant="outline"><Upload className="h-4 w-4 mr-2" /> インポート</Button>
          </Link>
          <Link href="/works/new">
            <Button><Plus className="h-4 w-4 mr-2" /> 新規作品</Button>
          </Link>
        </div>
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

      {/* Wizard Drafts */}
      {drafts.length > 0 && (
        <div className="space-y-3 mb-8">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileEdit className="h-5 w-5 text-muted-foreground" />
            作成中の下書き
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {drafts
              .sort((a, b) => b.savedAt - a.savedAt)
              .map((draft) => (
              <Card key={draft.id} className="group relative">
                <Link href={`/works/new?mode=wizard&draft=${draft.id}`} className="block">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {draft.data.title || '（無題）'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ステップ {draft.step + 1}/6
                          {draft.data.genre && ` · ${draft.data.genre}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(draft.savedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">作成中</Badge>
                    </div>
                    {(draft.data.characters.length > 0 || draft.data.coreMessage) && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {draft.data.characters.length > 0 && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {draft.data.characters.length}キャラ
                          </span>
                        )}
                        {draft.data.coreMessage && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            テーマ設定済み
                          </span>
                        )}
                        {draft.data.chapterOutline.length > 0 && (
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {draft.data.chapterOutline.length}章
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Link>
                <button
                  onClick={(e) => { e.preventDefault(); handleDeleteDraft(draft.id); }}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  title="下書きを削除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Works List */}
      {overview.works.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">まだ作品がありません</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/works/new">
                <Button>最初の作品を作成する</Button>
              </Link>
              <Link href="/works/import">
                <Button variant="outline"><Upload className="h-4 w-4 mr-1.5" /> 他サイトから取り込む</Button>
              </Link>
            </div>
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
                    {work.qualityScore && (
                      <ScoreBadge score={work.qualityScore.overall} />
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{work._count?.episodes ?? 0} エピソード</span>
                    <span><Eye className="h-3 w-3 inline mr-0.5" />{work.totalViews}</span>
                    <span>{work._count?.reviews ?? 0} レビュー</span>
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

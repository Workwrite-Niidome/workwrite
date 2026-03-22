'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Eye, BookOpen, MessageSquare, TrendingUp, BarChart3, Pencil, ChevronRight, Upload, FileEdit, Trash2, Mail, DollarSign, Send, Users, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScoreBadge } from '@/components/scoring/score-badge';
import { AiGeneratedBadge } from '@/components/ui/ai-generated-badge';
import { api, type Work } from '@/lib/api';
import { loadDrafts, deleteDraft, type WizardDraft } from '@/lib/wizard-drafts';

interface EditorModeWork {
  id: string;
  title: string;
  createdAt: string;
  editorModeJob?: {
    status: string;
    completedEpisodes: number;
    totalEpisodes: number;
    creditsConsumed: number;
  };
}

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
  const [editorModeWorks, setEditorModeWorks] = useState<EditorModeWork[]>([]);
  const [confirmDeleteDraftId, setConfirmDeleteDraftId] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(loadDrafts());
    // Load editor mode works in progress
    api.getMyWorks()
      .then((res) => {
        const edWorks = (res.data || []).filter(
          (w: any) => w.isAiGenerated && w.status === 'DRAFT' && w.title?.includes('編集者モード')
        );
        // For each, fetch editor mode status
        Promise.all(
          edWorks.map((w: any) =>
            api.editorModeStatus(w.id)
              .then((statusRes: any) => ({ ...w, editorModeJob: (statusRes as any)?.data || statusRes }))
              .catch(() => ({ ...w, editorModeJob: null }))
          )
        ).then((results) => setEditorModeWorks(results.filter((w: any) => w.editorModeJob)));
      })
      .catch(() => {});
  }, []);

  function handleDeleteDraft() {
    if (!confirmDeleteDraftId) return;
    deleteDraft(confirmDeleteDraftId);
    setDrafts(loadDrafts());
    setConfirmDeleteDraftId(null);
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
      <div className="px-4 py-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!overview) return null;

  return (
    <div className="px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
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

      {/* Quick nav */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/dashboard/letters/received">
          <Button variant="outline" size="sm"><Mail className="h-4 w-4 mr-1.5" /> 受信レター</Button>
        </Link>
        <Link href="/dashboard/letters/sent">
          <Button variant="outline" size="sm"><Send className="h-4 w-4 mr-1.5" /> 送信レター</Button>
        </Link>
        <Link href="/dashboard/earnings">
          <Button variant="outline" size="sm"><DollarSign className="h-4 w-4 mr-1.5" /> 収益</Button>
        </Link>
        <Link href="/dashboard/referral">
          <Button variant="outline" size="sm"><Users className="h-4 w-4 mr-1.5" /> 招待</Button>
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

      {/* Reaction Feed */}
      <ReactionFeed />

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
                  onClick={(e) => { e.preventDefault(); setConfirmDeleteDraftId(draft.id); }}
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

      {/* Editor Mode Works in Progress */}
      {editorModeWorks.length > 0 && (
        <EditorModeSection
          works={editorModeWorks}
          onDelete={(id) => {
            api.deleteWork(id).then(() => {
              setEditorModeWorks((prev) => prev.filter((w) => w.id !== id));
            }).catch(() => {});
          }}
        />
      )}

      {/* Works List */}
      {overview.works.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">まだ作品がありません</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/works/new">
                <Button>最初の作品を作成する</Button>
              </Link>
              <Link href="/works/import">
                <Button variant="outline"><Upload className="h-4 w-4 mr-1.5" /> 他サイトから取り込む</Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              初めての方は<Link href="/guide/writers" className="text-primary hover:underline ml-1">執筆者ガイド</Link>もご覧ください。
            </p>
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
                    {work.isAiGenerated && <AiGeneratedBadge />}
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

      <ConfirmDialog
        open={!!confirmDeleteDraftId}
        onOpenChange={(v) => { if (!v) setConfirmDeleteDraftId(null); }}
        title="下書きを削除"
        message="この下書きを削除しますか？この操作は取り消せません。"
        confirmLabel="削除する"
        variant="destructive"
        onConfirm={handleDeleteDraft}
      />
    </div>
  );
}

const EMOTION_LABELS: Record<string, string> = {
  moved: '泣いた', warm: '温かい', surprised: '驚いた', fired_up: '燃えた', thoughtful: '深い',
};

function ReactionFeed() {
  const [feed, setFeed] = useState<{ id: string; userDisplayName: string; workTitle: string; episodeTitle: string; claps: number; emotion: string | null; createdAt: string }[]>([]);

  useEffect(() => {
    api.getMyReactionFeed()
      .then((res) => setFeed(res.data || []))
      .catch(() => {});
  }, []);

  if (feed.length === 0) return null;

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'たった今';
    if (mins < 60) return `${mins}分前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    return `${days}日前`;
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-3">最近の読者リアクション</h2>
      <Card>
        <CardContent className="pt-4 pb-2">
          <div className="space-y-0 divide-y divide-border">
            {feed.slice(0, 10).map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="text-xs text-muted-foreground w-16 shrink-0 text-right">{timeAgo(item.createdAt)}</span>
                <div className="min-w-0 flex-1">
                  <span className="text-muted-foreground">{item.userDisplayName}</span>
                  <span className="text-muted-foreground mx-1">が</span>
                  <span className="font-medium truncate">『{item.workTitle}』</span>
                  <span className="text-muted-foreground mx-1">第{(item as any).episodeOrderIndex != null ? (item as any).episodeOrderIndex + 1 : '?'}話に</span>
                  <span className="text-foreground">拍手{item.claps > 1 ? `(${item.claps}回)` : ''}</span>
                  {item.emotion && (
                    <span className="text-muted-foreground ml-1">「{EMOTION_LABELS[item.emotion] || item.emotion}」</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EditorModeSection({
  works,
  onDelete,
}: {
  works: EditorModeWork[];
  onDelete: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sorted = [...works].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const displayed = showAll ? sorted : sorted.slice(0, 3);

  const statusLabels: Record<string, string> = {
    designing: '設計中',
    taste_check: 'テイスト確認',
    generating: '生成中',
    paused: '一時停止',
    reviewing: 'レビュー中',
    completed: '完了',
  };

  return (
    <div className="space-y-3 mb-8">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Bot className="h-5 w-5 text-indigo-500" />
        編集者モード — 作成中
        <span className="text-sm font-normal text-muted-foreground">({works.length}件)</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {displayed.map((work) => {
          const job = work.editorModeJob;
          const statusLabel = statusLabels[job?.status || ''] || job?.status || '';
          const href = job?.status === 'designing'
            ? `/works/new/editor-mode?resume=${work.id}`
            : `/works/${work.id}/editor-mode`;
          return (
            <Card key={work.id} className="group relative hover:shadow-md transition-shadow border-t-2 border-t-indigo-400">
              <Link href={href} className="block">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{work.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {job?.completedEpisodes || 0}/{job?.totalEpisodes || '?'} 話 · {job?.creditsConsumed || 0}cr消費
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(work.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{statusLabel}</Badge>
                  </div>
                </CardContent>
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(work.id); }}
                className="absolute top-2 right-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1"
                title="削除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </Card>
          );
        })}
      </div>
      {works.length > 3 && !showAll && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="text-xs">
          他 {works.length - 3} 件を表示
        </Button>
      )}
      {showAll && works.length > 3 && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll(false)} className="text-xs">
          折りたたむ
        </Button>
      )}
      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
        title="編集者モード作品を削除"
        message="この作品と設計データを削除します。この操作は取り消せません。"
        variant="destructive"
        onConfirm={() => {
          if (confirmDeleteId) {
            onDelete(confirmDeleteId);
            setConfirmDeleteId(null);
          }
        }}
      />
    </div>
  );
}

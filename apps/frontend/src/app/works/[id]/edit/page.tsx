'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, Pencil, Eye, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Loading } from '@/components/layout/loading';
import { ScoreCard } from '@/components/scoring/score-card';
import { api, type Work, type QualityScoreDetail } from '@/lib/api';

interface EpisodeItem {
  id: string;
  title: string;
  orderIndex: number;
  wordCount: number;
  publishedAt: string | null;
  scheduledAt: string | null;
}

function getEpisodeStatus(ep: EpisodeItem) {
  if (ep.publishedAt) return { label: '公開済み', variant: 'default' as const };
  if (ep.scheduledAt) return { label: '予約', variant: 'secondary' as const };
  return { label: '下書き', variant: 'outline' as const };
}

export default function EditWorkPage() {
  const params = useParams();
  const workId = params.id as string;
  const router = useRouter();
  const [work, setWork] = useState<Work | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [scoreDetail, setScoreDetail] = useState<QualityScoreDetail | null>(null);

  // Confirm dialogs
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [deleteEpisodeId, setDeleteEpisodeId] = useState<string | null>(null);

  // Drag state
  const dragItemRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);

  useEffect(() => {
    api.getWork(workId)
      .then((res) => {
        setWork(res.data);
        setTitle(res.data.title);
        setSynopsis(res.data.synopsis || '');
        if (res.data.episodes) {
          setEpisodes(res.data.episodes as EpisodeItem[]);
        }
      })
      .catch(() => router.push('/dashboard'));

    api.getScoreAnalysis(workId)
      .then((res) => { if (res.data) setScoreDetail(res.data); })
      .catch(() => {});
  }, [workId, router]);

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      const res = await api.updateWork(workId, { title, synopsis } as Partial<Work>);
      setWork(res.data);
      setMessage('保存しました');
    } catch {
      setMessage('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    try {
      const res = await api.updateWork(workId, { status: 'PUBLISHED' } as Partial<Work>);
      setWork(res.data);
      setMessage('公開しました');
    } catch {
      setMessage('公開に失敗しました');
    }
  }

  async function handleUnpublish() {
    try {
      const res = await api.updateWork(workId, { status: 'UNPUBLISHED' } as Partial<Work>);
      setWork(res.data);
      setMessage('非公開にしました');
    } catch {
      setMessage('非公開への変更に失敗しました');
    }
  }

  async function handleDelete() {
    try {
      await api.deleteWork(workId);
      router.push('/dashboard');
    } catch {
      setMessage('削除に失敗しました');
    }
  }

  async function handleDeleteEpisode() {
    if (!deleteEpisodeId) return;
    try {
      await api.deleteEpisode(deleteEpisodeId);
      setEpisodes((prev) => prev.filter((ep) => ep.id !== deleteEpisodeId));
      setMessage('エピソードを削除しました');
    } catch {
      setMessage('削除に失敗しました');
    }
    setDeleteEpisodeId(null);
  }

  async function handleDragEnd() {
    const dragIndex = dragItemRef.current;
    const overIndex = dragOverRef.current;
    if (dragIndex === null || overIndex === null || dragIndex === overIndex) return;

    const reordered = [...episodes];
    const [removed] = reordered.splice(dragIndex, 1);
    reordered.splice(overIndex, 0, removed);

    const items = reordered.map((ep, i) => ({ id: ep.id, orderIndex: i }));
    setEpisodes(reordered.map((ep, i) => ({ ...ep, orderIndex: i })));

    try {
      await api.reorderEpisodes(workId, items);
    } catch {
      setMessage('並び替えに失敗しました');
    }

    dragItemRef.current = null;
    dragOverRef.current = null;
  }

  if (!work) return <Loading />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">作品編集</h1>
        <div className="flex gap-2">
          <Link href={`/works/${workId}/preview`}>
            <Button variant="outline" size="sm"><Eye className="h-3.5 w-3.5 mr-1" /> プレビュー</Button>
          </Link>
          {work.status === 'DRAFT' && (
            <Button onClick={() => setConfirmPublish(true)} variant="default">公開する</Button>
          )}
          {work.status === 'PUBLISHED' && (
            <Button onClick={() => setConfirmUnpublish(true)} variant="outline">非公開にする</Button>
          )}
          {work.status === 'UNPUBLISHED' && (
            <Button onClick={() => setConfirmPublish(true)} variant="default">再公開する</Button>
          )}
          <Button onClick={() => setConfirmDelete(true)} variant="destructive" size="icon" className="min-h-[44px] min-w-[44px]">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {message && <div className="p-3 mb-4 text-sm rounded-md bg-muted">{message}</div>}

      <div className="grid gap-6 md:grid-cols-[1fr,300px]">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">タイトル</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">あらすじ</label>
            <Textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              rows={5}
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">エピソード</CardTitle>
              <Link href={`/works/${workId}/episodes/new`}>
                <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> 追加</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {episodes.length > 0 ? (
                <ul className="space-y-1">
                  {episodes.map((ep, index) => {
                    const status = getEpisodeStatus(ep);
                    return (
                      <li
                        key={ep.id}
                        draggable
                        onDragStart={() => { dragItemRef.current = index; }}
                        onDragOver={(e) => { e.preventDefault(); dragOverRef.current = index; }}
                        onDrop={handleDragEnd}
                        className="group"
                      >
                        <div className="flex items-center justify-between rounded-md px-2 py-2 -mx-2 hover:bg-muted transition-colors">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 cursor-grab shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="text-xs text-muted-foreground w-4 shrink-0">{ep.orderIndex + 1}.</span>
                            <Link
                              href={`/works/${workId}/episodes/${ep.id}/edit`}
                              className="text-sm truncate hover:underline"
                            >
                              {ep.title}
                            </Link>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant={status.variant} className="text-[10px] px-1.5 py-0">
                              {status.label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{ep.wordCount}字</span>
                            <Link href={`/works/${workId}/episodes/${ep.id}/edit`}>
                              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                            <button
                              onClick={(e) => { e.preventDefault(); setDeleteEpisodeId(ep.id); }}
                              className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">エピソードがありません</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">情報</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1 text-muted-foreground">
              <p>ステータス: <Badge variant="secondary">{work.status}</Badge></p>
              {work.genre && <p>ジャンル: {work.genre}</p>}
              {work.qualityScore && <p>品質スコア: {Math.round(work.qualityScore.overall)}</p>}
            </CardContent>
          </Card>

          {scoreDetail && <ScoreCard score={scoreDetail} />}
        </div>
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="作品を削除"
        message="本当にこの作品を削除しますか？全てのエピソードも削除されます。この操作は取り消せません。"
        confirmLabel="削除する"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="作品を公開"
        message={work.status === 'UNPUBLISHED' ? 'この作品を再公開しますか？' : 'この作品を公開しますか？'}
        confirmLabel="公開する"
        onConfirm={handlePublish}
      />

      <ConfirmDialog
        open={confirmUnpublish}
        onOpenChange={setConfirmUnpublish}
        title="作品を非公開にする"
        message="この作品を非公開にしますか？読者からは見えなくなります。"
        confirmLabel="非公開にする"
        onConfirm={handleUnpublish}
      />

      <ConfirmDialog
        open={!!deleteEpisodeId}
        onOpenChange={(v) => { if (!v) setDeleteEpisodeId(null); }}
        title="エピソードを削除"
        message="このエピソードを削除しますか？この操作は取り消せません。"
        confirmLabel="削除する"
        variant="destructive"
        onConfirm={handleDeleteEpisode}
      />
    </div>
  );
}

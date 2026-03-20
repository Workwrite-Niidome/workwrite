'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, Pencil, Eye, GripVertical, ChevronDown, ChevronUp, BookOpen, Save, X, Users, Globe, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Loading } from '@/components/layout/loading';
import { ScoreCard } from '@/components/scoring/score-card';
import { AiGeneratedBadge } from '@/components/ui/ai-generated-badge';
import { api, type Work, type QualityScoreDetail } from '@/lib/api';
import { CharacterRegistryPanel } from '@/components/editor/character-registry-panel';

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
  const [hasPrologue, setHasPrologue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [scoreDetail, setScoreDetail] = useState<QualityScoreDetail | null>(null);

  // Confirm dialogs
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [deleteEpisodeId, setDeleteEpisodeId] = useState<string | null>(null);
  const [creationPlan, setCreationPlan] = useState<any>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [showCharacters, setShowCharacters] = useState(false);

  // Drag state
  const dragItemRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);

  useEffect(() => {
    api.getWork(workId)
      .then((res) => {
        setWork(res.data);
        setTitle(res.data.title);
        setSynopsis(res.data.synopsis || '');
        setHasPrologue(!!res.data.prologue);
        if (res.data.episodes) {
          setEpisodes(res.data.episodes as EpisodeItem[]);
        }
      })
      .catch(() => router.push('/dashboard'));

    api.getScoreAnalysis(workId)
      .then((res) => { if (res.data) setScoreDetail(res.data); })
      .catch(() => {});

    api.getCreationPlan(workId)
      .then((res) => { if (res.data) setCreationPlan(res.data); })
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
      setEpisodes((prev) =>
        prev
          .filter((ep) => ep.id !== deleteEpisodeId)
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((ep, i) => ({ ...ep, orderIndex: i })),
      );
      setMessage('エピソードを削除しました');
    } catch {
      setMessage('削除に失敗しました');
    }
    setDeleteEpisodeId(null);
  }

  async function handleToggleEpisodePublish(ep: EpisodeItem) {
    try {
      if (ep.publishedAt) {
        await api.unpublishEpisode(ep.id);
        setEpisodes((prev) =>
          prev.map((e) => e.id === ep.id ? { ...e, publishedAt: null } : e),
        );
        setMessage('エピソードを下書きに戻しました');
      } else {
        await api.publishEpisode(ep.id);
        setEpisodes((prev) =>
          prev.map((e) => e.id === ep.id ? { ...e, publishedAt: new Date().toISOString(), scheduledAt: null } : e),
        );
        setMessage('エピソードを公開しました');
      }
    } catch {
      setMessage('操作に失敗しました');
    }
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
    <div className="px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-2xl font-bold">作品編集</h1>
          {work.isAiGenerated && <AiGeneratedBadge size="md" />}
        </div>
        {(work as any).originality != null && (work as any).originality < 1.0 && (
          <div className={`text-xs mb-3 px-3 py-2 rounded-md border ${
            work.isAiGenerated
              ? 'bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300'
              : 'bg-muted/50 border-border text-muted-foreground'
          }`}>
            <p className="font-medium">
              AI使用率: {Math.round((1 - (work as any).originality) * 100)}%
              {work.isAiGenerated && ' — AI Generated 作品として表示されます'}
            </p>
            <p className="mt-0.5 text-[11px] opacity-75">
              AI執筆アシストで生成されたテキストとエピソード本文の一致率に基づいて自動判定されます。50%以上でAI Generatedバッジが付与されます。
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href={`/works/${workId}/preview`}>
            <Button variant="outline" size="sm"><Eye className="h-3.5 w-3.5 mr-1" /> プレビュー</Button>
          </Link>
          {work.status === 'DRAFT' && (
            <Button onClick={() => setConfirmPublish(true)} size="sm" variant="default">公開する</Button>
          )}
          {work.status === 'PUBLISHED' && (
            <Button onClick={() => setConfirmUnpublish(true)} size="sm" variant="outline">非公開にする</Button>
          )}
          {work.status === 'UNPUBLISHED' && (
            <Button onClick={() => setConfirmPublish(true)} size="sm" variant="default">再公開する</Button>
          )}
          <select
            value={(work as any).completionStatus || 'ONGOING'}
            onChange={async (e) => {
              try {
                const res = await api.updateWork(workId, { completionStatus: e.target.value } as any);
                setWork(res.data);
                setMessage(e.target.value === 'COMPLETED' ? '完結に設定しました' : e.target.value === 'HIATUS' ? '休載中に設定しました' : '連載中に設定しました');
              } catch { setMessage('変更に失敗しました'); }
            }}
            className="h-8 px-2 text-xs rounded-md border border-border bg-background"
          >
            <option value="ONGOING">連載中</option>
            <option value="COMPLETED">完結</option>
            <option value="HIATUS">休載中</option>
          </select>
          <Button onClick={() => setConfirmDelete(true)} variant="destructive" size="sm" className="px-2">
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

        <div className="space-y-4 min-w-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">エピソード</CardTitle>
              <Link href={`/works/${workId}/episodes/new`}>
                <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> 追加</Button>
              </Link>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {/* Prologue entry */}
                <li>
                  <div className="flex items-center justify-between rounded-md px-2 py-2 -mx-2 hover:bg-muted transition-colors group">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">序</span>
                      <Link
                        href={`/works/${workId}/prologue/edit`}
                        className="text-sm truncate hover:underline"
                      >
                        序章
                      </Link>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant={hasPrologue ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0">
                        {hasPrologue ? '設定済み' : '未設定'}
                      </Badge>
                      <Link href={`/works/${workId}/prologue/edit`}>
                        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </div>
                  </div>
                </li>

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
                            <button
                              onClick={(e) => { e.preventDefault(); handleToggleEpisodePublish(ep); }}
                              title={ep.publishedAt ? '下書きに戻す' : '公開する'}
                              className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              {ep.publishedAt ? <EyeOff className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                            </button>
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
            </CardContent>
          </Card>

          <CreationPlanCard workId={workId} creationPlan={creationPlan} onSaved={setCreationPlan} />

          {/* Character Registry */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                キャラクター設定
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showCharacters ? (
                <div className="border rounded-lg -mx-2 overflow-hidden" style={{ height: '500px' }}>
                  <CharacterRegistryPanel workId={workId} onClose={() => setShowCharacters(false)} />
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowCharacters(true)} className="w-full text-xs gap-1">
                  <Users className="h-3 w-3" /> キャラクター管理を開く
                </Button>
              )}
            </CardContent>
          </Card>

          <ScoreCard score={scoreDetail} workId={workId} onScoreUpdate={setScoreDetail} />

          {/* Reader Display Settings */}
          <ReaderDisplaySettings workId={workId} creationPlan={creationPlan} />
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

// ─── Creation Plan Editor ─────────────────────────────────────

function CreationPlanCard({
  workId,
  creationPlan,
  onSaved,
}: {
  workId: string;
  creationPlan: any;
  onSaved: (plan: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable state
  const [coreMessage, setCoreMessage] = useState('');
  const [targetEmotions, setTargetEmotions] = useState('');
  const [readerJourney, setReaderJourney] = useState('');
  const [plotText, setPlotText] = useState('');
  const [chapters, setChapters] = useState<{ title: string; summary: string }[]>([]);

  function startEditing() {
    const eb = creationPlan?.emotionBlueprint || {};
    setCoreMessage(eb.coreMessage || '');
    setTargetEmotions(eb.targetEmotions || '');
    setReaderJourney(eb.readerJourney || '');
    const po = creationPlan?.plotOutline;
    if (po?.type === 'structured' && po.actGroups?.length > 0) {
      // Convert structured plot to readable text for editing
      setPlotText(po.actGroups.map((g: any) => {
        const header = `【${g.label}】${g.description ? ` ${g.description}` : ''}`;
        const eps = (g.episodes || []).map((ep: any) => `  - ${ep.title || '（無題）'}${ep.whatHappens ? `: ${ep.whatHappens}` : ''}`).join('\n');
        return eps ? `${header}\n${eps}` : header;
      }).join('\n\n'));
    } else {
      setPlotText(typeof po === 'string' ? po : po?.text || '');
    }
    setChapters(
      (creationPlan?.chapterOutline || []).map((ch: any) => ({
        title: ch.title || '',
        summary: ch.summary || '',
      }))
    );
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const plan: any = {};
      if (coreMessage || targetEmotions || readerJourney) {
        plan.emotionBlueprint = { coreMessage, targetEmotions, readerJourney };
      }
      if (plotText.trim()) {
        plan.plotOutline = { text: plotText, aiAssisted: false };
      }
      if (chapters.length > 0) {
        plan.chapterOutline = chapters.filter((ch) => ch.title.trim());
      }
      await api.saveCreationPlan(workId, plan);
      onSaved({ ...creationPlan, ...plan });
      setEditing(false);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }

  const hasPlan = creationPlan && (
    creationPlan.emotionBlueprint ||
    creationPlan.characters?.length > 0 ||
    creationPlan.plotOutline ||
    creationPlan.chapterOutline?.length > 0 ||
    creationPlan.worldBuildingData
  );

  if (!hasPlan && !editing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> 設計メモ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">キャラクター、プロット、感情設計などのメモを追加できます。</p>
          <Button variant="outline" size="sm" onClick={startEditing} className="gap-1 text-xs">
            <Plus className="h-3 w-3" /> 設計メモを追加
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        className="cursor-pointer flex flex-row items-center justify-between space-y-0"
        onClick={() => !editing && setOpen(!open)}
      >
        <CardTitle className="text-base flex items-center gap-1.5">
          <BookOpen className="h-4 w-4" /> 設計メモ
        </CardTitle>
        <div className="flex items-center gap-1">
          {!editing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => { e.stopPropagation(); startEditing(); setOpen(true); }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {!editing && (open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
        </div>
      </CardHeader>
      {(open || editing) && (
        <CardContent className="text-sm space-y-4">
          {editing ? (
            <>
              {/* Emotion Blueprint */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">テーマ・想い</p>
                <Input
                  value={coreMessage}
                  onChange={(e) => setCoreMessage(e.target.value)}
                  placeholder="核となるメッセージ"
                  className="text-xs h-8"
                />
                <Input
                  value={targetEmotions}
                  onChange={(e) => setTargetEmotions(e.target.value)}
                  placeholder="読者に届けたい感情"
                  className="text-xs h-8"
                />
                <Input
                  value={readerJourney}
                  onChange={(e) => setReaderJourney(e.target.value)}
                  placeholder="読者の旅路"
                  className="text-xs h-8"
                />
              </div>

              {/* Characters — managed via Character Registry panel */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">キャラクター</p>
                <p className="text-[10px] text-muted-foreground">キャラクターの編集は「キャラクター設定」パネルから行えます</p>
              </div>

              {/* Plot */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">プロット</p>
                <Textarea
                  value={plotText}
                  onChange={(e) => setPlotText(e.target.value)}
                  placeholder="プロット構想"
                  rows={4}
                  className="text-xs"
                />
              </div>

              {/* Chapters */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">章立て</p>
                {chapters.map((ch, i) => (
                  <div key={i} className="flex gap-1 items-start">
                    <span className="text-[10px] text-muted-foreground mt-2 w-6 shrink-0">{i + 1}.</span>
                    <div className="flex-1 space-y-1">
                      <Input
                        value={ch.title}
                        onChange={(e) => {
                          const u = [...chapters];
                          u[i] = { ...u[i], title: e.target.value };
                          setChapters(u);
                        }}
                        placeholder="章タイトル"
                        className="text-xs h-7"
                      />
                      <Textarea
                        value={ch.summary}
                        onChange={(e) => {
                          const u = [...chapters];
                          u[i] = { ...u[i], summary: e.target.value };
                          setChapters(u);
                        }}
                        placeholder="概要"
                        rows={1}
                        className="text-xs"
                      />
                    </div>
                    <button
                      onClick={() => setChapters(chapters.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive mt-2"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => setChapters([...chapters, { title: '', summary: '' }])}
                >
                  <Plus className="h-3 w-3" /> 追加
                </Button>
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1 text-xs">
                  <Save className="h-3 w-3" />
                  {saving ? '保存中...' : '保存'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="gap-1 text-xs">
                  <X className="h-3 w-3" /> キャンセル
                </Button>
              </div>
            </>
          ) : (
            <>
              {creationPlan.emotionBlueprint && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">テーマ・想い</p>
                  {creationPlan.emotionBlueprint.coreMessage && (
                    <p className="text-xs">{creationPlan.emotionBlueprint.coreMessage}</p>
                  )}
                  {creationPlan.emotionBlueprint.targetEmotions && (
                    <p className="text-xs text-muted-foreground mt-1">感情: {creationPlan.emotionBlueprint.targetEmotions}</p>
                  )}
                  {creationPlan.emotionBlueprint.readerJourney && (
                    <p className="text-xs text-muted-foreground mt-1">読者の旅路: {creationPlan.emotionBlueprint.readerJourney}</p>
                  )}
                </div>
              )}
              {creationPlan.characters?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">キャラクター</p>
                  <p className="text-[10px] text-muted-foreground">
                    {creationPlan.characters.length}人のキャラクター設定あり — 詳細は「キャラクター設定」パネルで管理
                  </p>
                </div>
              )}
              {creationPlan.plotOutline && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">プロット</p>
                  {creationPlan.plotOutline.type === 'structured' && creationPlan.plotOutline.actGroups?.length > 0 ? (
                    <div className="space-y-2">
                      {creationPlan.plotOutline.actGroups.map((group: any) => (
                        <div key={group.id}>
                          <p className="text-xs font-medium">{group.label}</p>
                          {group.description && <p className="text-[10px] text-muted-foreground">{group.description}</p>}
                          {group.episodes?.map((ep: any) => (
                            <div key={ep.id} className="ml-2 mt-1 pl-2 border-l-2 border-primary/20">
                              <p className="text-[10px] font-medium">{ep.title || '（無題）'}</p>
                              {ep.whatHappens && <p className="text-[10px] text-muted-foreground">{ep.whatHappens}</p>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs whitespace-pre-wrap">
                      {typeof creationPlan.plotOutline === 'string'
                        ? creationPlan.plotOutline
                        : creationPlan.plotOutline.text || ''}
                    </p>
                  )}
                </div>
              )}
              {creationPlan.chapterOutline?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">章立て</p>
                  <div className="space-y-1">
                    {creationPlan.chapterOutline.map((ch: any, i: number) => (
                      <div key={i} className="text-xs">
                        <span className="font-medium">第{i + 1}話: {ch.title}</span>
                        {ch.summary && <p className="text-muted-foreground">{ch.summary}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {creationPlan.worldBuildingData && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">世界観</p>
                  <div className="space-y-1.5">
                    {creationPlan.worldBuildingData.basics?.era && (
                      <p className="text-xs"><span className="text-muted-foreground">時代:</span> {creationPlan.worldBuildingData.basics.era}</p>
                    )}
                    {creationPlan.worldBuildingData.basics?.setting && (
                      <p className="text-xs"><span className="text-muted-foreground">舞台:</span> {creationPlan.worldBuildingData.basics.setting}</p>
                    )}
                    {creationPlan.worldBuildingData.rules?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium">ルール</p>
                        {creationPlan.worldBuildingData.rules.map((r: any, i: number) => (
                          <p key={i} className="text-[10px] text-muted-foreground ml-1">• {r.name}: {r.description}</p>
                        ))}
                      </div>
                    )}
                    {creationPlan.worldBuildingData.terminology?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium">用語集</p>
                        {creationPlan.worldBuildingData.terminology.map((t: any, i: number) => (
                          <p key={i} className="text-[10px] text-muted-foreground ml-1">
                            <span className="font-medium text-foreground">{t.term}</span>
                            {t.reading && `（${t.reading}）`}: {t.definition}
                          </p>
                        ))}
                      </div>
                    )}
                    {creationPlan.worldBuildingData.items?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium">アイテム</p>
                        {creationPlan.worldBuildingData.items.map((item: any, i: number) => (
                          <p key={i} className="text-[10px] text-muted-foreground ml-1">• {item.name}{item.ability && `: ${item.ability}`}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Reader Display Settings ─────────────────────────────────

function ReaderDisplaySettings({
  workId,
  creationPlan,
}: {
  workId: string;
  creationPlan: any;
}) {
  const [isWorldPublic, setIsWorldPublic] = useState(false);
  const [isEmotionPublic, setIsEmotionPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (creationPlan) {
      setIsWorldPublic(creationPlan.isWorldPublic ?? false);
      setIsEmotionPublic(creationPlan.isEmotionPublic ?? false);
    }
  }, [creationPlan]);

  const hasWorldData = creationPlan?.worldBuildingData;
  const hasEmotionData = creationPlan?.emotionBlueprint;

  if (!hasWorldData && !hasEmotionData) return null;

  async function handleToggle(field: 'isWorldPublic' | 'isEmotionPublic', value: boolean) {
    setSaving(true);
    try {
      await api.updatePublicFlags(workId, { [field]: value });
      if (field === 'isWorldPublic') setIsWorldPublic(value);
      else setIsEmotionPublic(value);
    } catch {
      // revert
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="h-4 w-4" />
          読者表示設定
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasWorldData && (
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <div>
              <p className="text-xs font-medium">世界観タブを読者に公開</p>
              <p className="text-[10px] text-muted-foreground">用語集、ルール、アイテムなどが読者に表示されます</p>
            </div>
            <button
              onClick={() => handleToggle('isWorldPublic', !isWorldPublic)}
              disabled={saving}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                isWorldPublic ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isWorldPublic ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
        )}
        {hasEmotionData && (
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <div>
              <p className="text-xs font-medium">感情設計を読者に公開</p>
              <p className="text-[10px] text-muted-foreground">感情アークの可視化が読者に表示されます</p>
            </div>
            <button
              onClick={() => handleToggle('isEmotionPublic', !isEmotionPublic)}
              disabled={saving}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                isEmotionPublic ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isEmotionPublic ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
        )}
      </CardContent>
    </Card>
  );
}

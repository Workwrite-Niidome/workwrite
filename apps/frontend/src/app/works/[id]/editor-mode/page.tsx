'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Play, Pause, Check, ChevronRight, ChevronDown, Loader2, RefreshCw,
  Send, Crown, CheckCircle2, Edit3, Wand2, RotateCcw, Pencil, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { consumeSSEStream } from '@/lib/use-ai-stream';
import { cn } from '@/lib/utils';

interface EditorModeJob {
  id: string;
  workId: string;
  status: 'designing' | 'taste_check' | 'generating' | 'paused' | 'reviewing' | 'completed';
  aiMode: string;
  generationMode: string;
  totalEpisodes: number;
  completedEpisodes: number;
  creditsConsumed: number;
  episodes?: EditorEpisode[];
}

interface EditorEpisode {
  id: string;
  title: string;
  content: string;
  orderIndex: number;
  approved: boolean;
  wordCount: number;
}

export default function EditorModeGenerationPage() {
  const params = useParams();
  const router = useRouter();
  const workId = params.id as string;

  const [job, setJob] = useState<EditorModeJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Taste check state
  const [reviseInstruction, setReviseInstruction] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [reviseResult, setReviseResult] = useState('');

  // Generation state — always Opus
  const aiMode = 'premium' as const;
  const [generationMode, setGenerationMode] = useState<'confirm' | 'batch'>('batch');

  // First episode auto-generation state
  const [generatingFirst, setGeneratingFirst] = useState(false);
  const [generatingFirstText, setGeneratingFirstText] = useState('');

  // Episode review state
  const [expandedEpisode, setExpandedEpisode] = useState<string | null>(null);
  const [episodeReviseId, setEpisodeReviseId] = useState<string | null>(null);
  const [episodeReviseInstruction, setEpisodeReviseInstruction] = useState('');
  const [episodeStreaming, setEpisodeStreaming] = useState<string | null>(null);
  const [episodeStreamResult, setEpisodeStreamResult] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Poll interval ref
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res: any = await api.editorModeStatus(workId);
      const jobData = res.data || res;
      setJob(jobData);
      if (jobData.generationMode) setGenerationMode(jobData.generationMode === 'confirm' ? 'confirm' : 'batch');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-generate first episode when taste_check + 0 episodes
  const firstGenTriggered = useRef(false);
  useEffect(() => {
    if (!job || job.status !== 'taste_check') return;
    const episodes = job.episodes || [];
    const hasContent = episodes.length > 0 && episodes[0]?.content;
    if (hasContent || firstGenTriggered.current || generatingFirst) return;

    firstGenTriggered.current = true;
    setGeneratingFirst(true);
    setGeneratingFirstText('');

    (async () => {
      try {
        const token = api.getToken();
        const url = await api.editorModeGenerateFirst(workId);

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ aiMode }),
        });

        if (!res.ok) throw new Error(`Error: ${res.status}`);

        let accumulated = '';
        await consumeSSEStream(res, (parsed) => {
          if (parsed.text) {
            accumulated += parsed.text;
            setGeneratingFirstText(accumulated);
          }
        });

        // Refresh status to get the episode with content
        await fetchStatus();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to generate first episode');
      } finally {
        setGeneratingFirst(false);
      }
    })();
  }, [job, workId, fetchStatus, generatingFirst, aiMode]);

  // Poll when generating
  useEffect(() => {
    if (job?.status === 'generating') {
      pollRef.current = setInterval(fetchStatus, 3000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [job?.status, fetchStatus]);

  const handleTasteOk = async () => {
    setError(null);
    try {
      await api.editorModeStart(workId, { aiMode, generationMode });
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start');
    }
  };

  const handleReviseFirstEpisode = async () => {
    if (!reviseInstruction.trim() || isRevising) return;
    setIsRevising(true);
    setReviseResult('');
    setError(null);

    try {
      const firstEpisode = job?.episodes?.[0];
      if (!firstEpisode) return;

      const token = api.getToken();
      const url = await api.editorModeReviseEpisode(workId, firstEpisode.id);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ instruction: reviseInstruction, aiMode }),
      });

      if (!res.ok) throw new Error(`Error: ${res.status}`);

      let accumulated = '';
      await consumeSSEStream(res, (parsed) => {
        if (parsed.text) {
          accumulated += parsed.text;
          setReviseResult(accumulated);
        }
      });

      setReviseInstruction('');
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revise');
    } finally {
      setIsRevising(false);
    }
  };

  const handleBackToDesign = () => {
    router.push(`/works/new/editor-mode?resume=${workId}`);
  };

  const handlePause = async () => {
    try {
      await api.editorModePause(workId);
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to pause');
    }
  };

  const handleResume = async () => {
    try {
      await api.editorModeResume(workId, { aiMode, generationMode });
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resume');
    }
  };

  const handleChangeMode = async (newMode: 'confirm' | 'batch') => {
    setGenerationMode(newMode);
    try {
      await api.editorModeChangeMode(workId, { generationMode: newMode });
    } catch { /* ignore */ }
  };

  const handleApproveEpisode = async (episodeId: string) => {
    try {
      await api.editorModeApproveEpisode(workId, episodeId);
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleBulkApprove = async () => {
    const currentEpisodes = job?.episodes || [];
    const unapproved = currentEpisodes.filter(ep => !ep.approved);
    if (unapproved.length === 0) return;
    setBulkApproving(true);
    try {
      for (const ep of unapproved) {
        await api.editorModeApproveEpisode(workId, ep.id);
      }
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to bulk approve');
    } finally {
      setBulkApproving(false);
    }
  };

  const handleStartEditing = (ep: EditorEpisode) => {
    setEditingEpisodeId(ep.id);
    setEditingContent(ep.content);
  };

  const handleSaveEdit = async (episodeId: string) => {
    setSavingEdit(true);
    try {
      await api.editorModeUpdateEpisodeContent(workId, episodeId, editingContent);
      setEditingEpisodeId(null);
      setEditingContent('');
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save edit');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleReviseEpisode = async (episodeId: string) => {
    if (!episodeReviseInstruction.trim()) return;
    setEpisodeStreaming(episodeId);
    setEpisodeStreamResult('');
    setError(null);

    try {
      const token = api.getToken();
      const url = await api.editorModeReviseEpisode(workId, episodeId);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ instruction: episodeReviseInstruction, aiMode }),
      });

      if (!res.ok) throw new Error(`Error: ${res.status}`);

      let accumulated = '';
      await consumeSSEStream(res, (parsed) => {
        if (parsed.text) {
          accumulated += parsed.text;
          setEpisodeStreamResult(accumulated);
        }
      });

      setEpisodeReviseId(null);
      setEpisodeReviseInstruction('');
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revise');
    } finally {
      setEpisodeStreaming(null);
    }
  };

  const handleAutoFix = async (episodeId: string) => {
    setEpisodeStreaming(episodeId);
    setEpisodeStreamResult('');
    setError(null);

    try {
      const token = api.getToken();
      const url = await api.editorModeAutoFix(workId, episodeId);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ aiMode }),
      });

      if (!res.ok) throw new Error(`Error: ${res.status}`);

      let accumulated = '';
      await consumeSSEStream(res, (parsed) => {
        if (parsed.text) {
          accumulated += parsed.text;
          setEpisodeStreamResult(accumulated);
        }
      });

      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to auto-fix');
    } finally {
      setEpisodeStreaming(null);
    }
  };

  const handleRegenerate = async (episodeId: string) => {
    setEpisodeStreaming(episodeId);
    setEpisodeStreamResult('');
    setError(null);

    try {
      const token = api.getToken();
      const url = await api.editorModeRegenerateEpisode(workId, episodeId);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ aiMode }),
      });

      if (!res.ok) throw new Error(`Error: ${res.status}`);

      let accumulated = '';
      await consumeSSEStream(res, (parsed) => {
        if (parsed.text) {
          accumulated += parsed.text;
          setEpisodeStreamResult(accumulated);
        }
      });

      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setEpisodeStreaming(null);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      await api.editorModeComplete(workId);
      router.push(`/works/${workId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="px-4 py-12 text-center text-muted-foreground">
        <p>編集者モードのジョブが見つかりません。</p>
        <Button variant="link" onClick={() => router.push('/works/new/editor-mode')}>
          新規作成に戻る
        </Button>
      </div>
    );
  }

  const episodes = job.episodes || [];
  const approvedCount = episodes.filter(ep => ep.approved).length;
  const allApproved = episodes.length > 0 && approvedCount === episodes.length;

  // Determine if first episode is ready for taste check
  const firstEpisodeReady = episodes.length > 0 && !!episodes[0]?.content;

  return (
    <div className="px-4 py-8 max-w-4xl mx-auto space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {job.status === 'taste_check' && '第1話 テイスト確認'}
          {(job.status === 'generating' || job.status === 'paused') && '生成中'}
          {(job.status === 'reviewing' || job.status === 'completed') && 'エピソードレビュー'}
        </h1>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-[10px]">
            <Crown className="h-2.5 w-2.5 mr-0.5" /> Opus
          </Badge>
          <div className="text-xs text-muted-foreground">
            {job.creditsConsumed}cr消費済み
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
      )}

      {/* Phase 3: Taste Check */}
      {job.status === 'taste_check' && (
        <div className="space-y-6">
          {/* Generating first episode state */}
          {!firstEpisodeReady && (generatingFirst || !firstGenTriggered.current) && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-4 py-8">
                  <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium">第1話を生成中...</p>
                    <p className="text-xs text-muted-foreground">AIが物語のテイストを作成しています</p>
                  </div>
                  {generatingFirstText && (
                    <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap leading-relaxed text-sm max-h-[40vh] overflow-y-auto w-full mt-4 p-4 bg-muted/30 rounded-lg">
                      {generatingFirstText}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Episode content display (top) */}
          {firstEpisodeReady && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">第1話: {episodes[0].title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap leading-relaxed text-sm max-h-[60vh] overflow-y-auto">
                    {reviseResult || episodes[0].content}
                  </div>
                  {isRevising && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> 修正中...
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-3">
                {/* Revision input */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">修正指示</p>
                  <div className="flex gap-2">
                    <Textarea
                      value={reviseInstruction}
                      onChange={(e) => setReviseInstruction(e.target.value)}
                      placeholder="テイストの修正指示を入力..."
                      rows={2}
                      className="flex-1 resize-none"
                    />
                    <Button
                      onClick={handleReviseFirstEpisode}
                      disabled={!reviseInstruction.trim() || isRevising}
                      className="self-end"
                    >
                      {isRevising ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Mode selection for after taste check */}
                <Card className="border-indigo-400/30">
                  <CardContent className="pt-4 space-y-3">
                    <p className="text-sm font-medium">OKの場合の生成モード</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setGenerationMode('confirm')}
                        className={cn(
                          'p-3 rounded-lg border text-left text-sm transition-colors',
                          generationMode === 'confirm'
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                            : 'border-border hover:border-indigo-500/50',
                        )}
                      >
                        <p className="font-medium">確認モード</p>
                        <p className="text-xs text-muted-foreground mt-1">1話ごとに確認してから次へ</p>
                      </button>
                      <button
                        onClick={() => setGenerationMode('batch')}
                        className={cn(
                          'p-3 rounded-lg border text-left text-sm transition-colors',
                          generationMode === 'batch'
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                            : 'border-border hover:border-indigo-500/50',
                        )}
                      >
                        <p className="font-medium">一括モード</p>
                        <p className="text-xs text-muted-foreground mt-1">全話を一気にバッチ生成</p>
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* Action buttons (bottom) */}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleTasteOk} className="gap-2">
                    <Check className="h-4 w-4" /> このテイストでOK
                  </Button>
                  <Button variant="outline" onClick={handleBackToDesign} className="gap-2">
                    <RotateCcw className="h-4 w-4" /> 設計に戻る
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Phase 4: Generation Progress */}
      {(job.status === 'generating' || job.status === 'paused') && (
        <div className="space-y-6">
          {/* Progress */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  第{job.completedEpisodes}話 / 全{job.totalEpisodes}話
                  {job.status === 'generating' ? ' 生成中...' : ' 停止中'}
                </p>
                <Badge variant={job.status === 'generating' ? 'default' : 'secondary'}>
                  {job.status === 'generating' ? '生成中' : '停止中'}
                </Badge>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    job.status === 'generating' ? 'bg-indigo-500 animate-pulse' : 'bg-indigo-500',
                  )}
                  style={{ width: `${(job.completedEpisodes / job.totalEpisodes) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {job.creditsConsumed}cr消費済み
              </p>
            </CardContent>
          </Card>

          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            {job.status === 'generating' ? (
              <Button variant="outline" onClick={handlePause} className="gap-2">
                <Pause className="h-4 w-4" /> 停止
              </Button>
            ) : (
              <Button onClick={handleResume} className="gap-2">
                <Play className="h-4 w-4" /> 続きから生成
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => handleChangeMode(generationMode === 'confirm' ? 'batch' : 'confirm')}
              className="gap-2 text-sm"
            >
              {generationMode === 'confirm' ? '一括モードに切り替え' : '確認モードに切り替え'}
            </Button>
          </div>

          {/* Confirm mode: show current episode */}
          {generationMode === 'confirm' && job.status === 'paused' && episodes.length > 0 && (
            <ConfirmModeEpisode
              episode={episodes[episodes.length - 1]}
              onApprove={() => {
                handleApproveEpisode(episodes[episodes.length - 1].id).then(() => handleResume());
              }}
              onRevise={(instruction) => {
                setEpisodeReviseInstruction(instruction);
                handleReviseEpisode(episodes[episodes.length - 1].id);
              }}
              onRegenerate={() => handleRegenerate(episodes[episodes.length - 1].id)}
              isStreaming={episodeStreaming === episodes[episodes.length - 1].id}
              streamResult={episodeStreamResult}
            />
          )}
        </div>
      )}

      {/* Phase 5: Review */}
      {(job.status === 'reviewing' || job.status === 'completed') && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              承認済み: {approvedCount} / {episodes.length}話
            </p>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleBulkApprove}
                disabled={allApproved || bulkApproving}
                variant="outline"
                className="gap-1"
              >
                {bulkApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                一括承認
              </Button>
              <Button
                onClick={handlePublish}
                disabled={!allApproved || publishing}
                className="gap-2"
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                下書きとして保存
              </Button>
            </div>
          </div>

          {/* Episode list */}
          <div className="space-y-2">
            {episodes.map((ep) => (
              <Card key={ep.id} className={cn(
                ep.approved ? 'border-green-500/30 bg-green-50/30 dark:bg-green-950/10' : 'border-amber-400/20',
              )}>
                <button
                  onClick={() => setExpandedEpisode(expandedEpisode === ep.id ? null : ep.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedEpisode === ep.id ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">
                      第{ep.orderIndex + 1}話: {ep.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{ep.wordCount?.toLocaleString()}字</span>
                    <EpisodeStatusBadge approved={ep.approved} hasContent={!!ep.content} />
                  </div>
                </button>

                {expandedEpisode === ep.id && (
                  <CardContent className="border-t space-y-4">
                    {/* Episode content */}
                    {editingEpisodeId === ep.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          rows={20}
                          className="w-full text-sm font-mono leading-relaxed resize-y"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(ep.id)}
                            disabled={savingEdit}
                            className="gap-1"
                          >
                            {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            保存
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditingEpisodeId(null); setEditingContent(''); }}
                          >
                            取消
                          </Button>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {editingContent.length.toLocaleString()}字
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap leading-relaxed text-sm max-h-[50vh] overflow-y-auto">
                        {episodeStreaming === ep.id && episodeStreamResult
                          ? episodeStreamResult
                          : ep.content}
                      </div>
                    )}

                    {episodeStreaming === ep.id && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> 処理中...
                      </div>
                    )}

                    {/* Actions */}
                    {episodeStreaming !== ep.id && editingEpisodeId !== ep.id && (
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        <Button
                          size="sm"
                          variant={ep.approved ? 'secondary' : 'default'}
                          onClick={() => handleApproveEpisode(ep.id)}
                          disabled={ep.approved}
                          className={cn('gap-1', ep.approved && 'bg-green-500/10 text-green-600 border-green-500/30')}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {ep.approved ? '承認済み' : '承認'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEditing(ep)}
                          className="gap-1"
                        >
                          <Pencil className="h-3.5 w-3.5" /> 編集
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEpisodeReviseId(ep.id);
                            setEpisodeReviseInstruction('');
                          }}
                          className="gap-1"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> 修正指示
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAutoFix(ep.id)}
                          className="gap-1"
                        >
                          <Wand2 className="h-3.5 w-3.5" /> AI自動修正
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRegenerate(ep.id)}
                          className="gap-1"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> 再生成
                        </Button>
                      </div>
                    )}

                    {/* Revise input */}
                    {episodeReviseId === ep.id && (
                      <div className="flex gap-2 items-end">
                        <Textarea
                          value={episodeReviseInstruction}
                          onChange={(e) => setEpisodeReviseInstruction(e.target.value)}
                          placeholder="修正指示を入力..."
                          rows={2}
                          className="flex-1 resize-none text-sm"
                        />
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            onClick={() => handleReviseEpisode(ep.id)}
                            disabled={!episodeReviseInstruction.trim() || !!episodeStreaming}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEpisodeReviseId(null)}
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EpisodeStatusBadge({ approved, hasContent }: { approved: boolean; hasContent: boolean }) {
  if (approved) {
    return <Badge className="bg-green-500 text-white text-[10px]">承認済み</Badge>;
  }
  if (hasContent) {
    return <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">レビュー待ち</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] text-muted-foreground">未生成</Badge>;
}

function ConfirmModeEpisode({
  episode,
  onApprove,
  onRevise,
  onRegenerate,
  isStreaming,
  streamResult,
}: {
  episode: EditorEpisode;
  onApprove: () => void;
  onRevise: (instruction: string) => void;
  onRegenerate: () => void;
  isStreaming: boolean;
  streamResult: string;
}) {
  const [instruction, setInstruction] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">第{episode.orderIndex + 1}話: {episode.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap leading-relaxed text-sm max-h-[50vh] overflow-y-auto">
          {isStreaming && streamResult ? streamResult : episode.content}
        </div>

        {isStreaming && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 処理中...
          </div>
        )}

        {!isStreaming && (
          <div className="space-y-3 border-t pt-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onApprove} className="gap-1">
                <Check className="h-3.5 w-3.5" /> OK → 次へ
              </Button>
              <Button size="sm" variant="outline" onClick={onRegenerate} className="gap-1">
                <RefreshCw className="h-3.5 w-3.5" /> 再生成
              </Button>
            </div>
            <div className="flex gap-2 items-end">
              <Textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="修正指示..."
                rows={2}
                className="flex-1 resize-none text-sm"
              />
              <Button
                size="sm"
                onClick={() => { onRevise(instruction); setInstruction(''); }}
                disabled={!instruction.trim()}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

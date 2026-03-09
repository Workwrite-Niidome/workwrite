'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/dialog';
import { AiAssistPanel } from './ai-assist-panel';
import { VersionHistoryPanel } from './version-history-panel';
import { WordCountGoal } from './word-count-goal';
import { useAutosave } from '@/lib/use-autosave';
import { api } from '@/lib/api';
import { Sparkles, Maximize2, Minimize2, History, Loader2 } from 'lucide-react';

interface WritingEditorProps {
  workId: string;
  episodeId?: string;
  initialTitle?: string;
  initialContent?: string;
  onPublish?: (data: { title: string; content: string; scheduledAt?: string }) => Promise<void>;
}

export function WritingEditor({
  workId,
  episodeId,
  initialTitle = '',
  initialContent = '',
  onPublish,
}: WritingEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [focusMode, setFocusMode] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [scheduled, setScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [confirmDraft, setConfirmDraft] = useState<{ title: string; content: string } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ overall: number; tips: string[] } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { status: saveStatus, lastSavedAt, deleteDraft } = useAutosave({
    workId,
    episodeId,
    title,
    content,
  });

  // Load draft on mount
  useEffect(() => {
    if (initialContent || draftLoaded) return;
    api.getDraft(workId, episodeId).then((res) => {
      if (res.data && (res.data.title || res.data.content)) {
        setConfirmDraft({ title: res.data.title || '', content: res.data.content || '' });
      }
      setDraftLoaded(true);
    }).catch(() => setDraftLoaded(true));
  }, [workId, episodeId, initialContent, draftLoaded]);

  // Ctrl+S manual save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (episodeId && title.trim() && content.trim()) {
          api.saveDraft({ workId, episodeId, title, content }).catch(() => {});
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workId, episodeId, title, content]);

  // beforeunload warning
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (saveStatus === 'unsaved' || saveStatus === 'saving') {
        e.preventDefault();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  // Track text selection
  const handleSelect = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selected = content.slice(textarea.selectionStart, textarea.selectionEnd);
    setSelectedText(selected);
  }, [content]);

  const wordCount = content.length;
  const paragraphCount = content.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const estimatedReadTime = Math.max(1, Math.ceil(wordCount / 500));

  const handleInsertAi = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + '\n' + text);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const newContent = before + text + after;
    setContent(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  }, [content]);

  const handleReplaceSelection = useCallback((newText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.slice(0, start);
    const after = content.slice(end);
    setContent(before + newText + after);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + newText.length, start + newText.length);
    }, 0);
  }, [content]);

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      if (onPublish) {
        await onPublish({
          title,
          content,
          scheduledAt: scheduled ? scheduledAt : undefined,
        });
      } else {
        await api.createEpisode(workId, { title, content });
        router.push(`/works/${workId}/edit`);
      }
      await deleteDraft();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '投稿に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAiCheck() {
    if (!episodeId) return;
    setScoring(true);
    setScoreResult(null);
    try {
      const res = await api.scoreEpisode(episodeId);
      if (res.data) {
        setScoreResult({ overall: res.data.overall, tips: res.data.tips });
      }
    } catch {}
    setScoring(false);
  }

  function handleVersionRestore(restoredTitle: string, restoredContent: string) {
    setTitle(restoredTitle);
    setContent(restoredContent);
    setShowHistory(false);
  }

  const saveStatusText = (() => {
    switch (saveStatus) {
      case 'saving': return '保存中...';
      case 'saved': return `保存済み ${lastSavedAt?.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) ?? ''}`;
      case 'unsaved': return '未保存';
      case 'error': return '保存エラー';
      default: return '';
    }
  })();

  return (
    <div className={`flex flex-col h-[calc(100vh-4rem)] ${focusMode ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      {/* Toolbar */}
      <div className={`flex items-center gap-2 px-4 py-2 border-b ${focusMode ? 'justify-center' : ''}`}>
        <div className={`flex-1 ${focusMode ? 'max-w-2xl' : ''}`}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="エピソードタイトル"
            className="border-0 text-lg font-medium focus-visible:ring-0 px-0"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {!focusMode && episodeId && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs"
            >
              <History className="h-3.5 w-3.5 mr-1" />
              履歴
            </Button>
          )}
          {!focusMode && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAi(!showAi)}
              className="text-xs"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              AI
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFocusMode(!focusMode)}
          >
            {focusMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          {episodeId && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAiCheck}
              disabled={scoring || !content.trim()}
              className="text-xs"
            >
              {scoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'AIチェック'}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !content.trim()}
          >
            {submitting ? '投稿中...' : episodeId ? '更新する' : '投稿する'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-sm text-destructive bg-destructive/10">{error}</div>
      )}

      {/* Score result */}
      {scoreResult && (
        <div className="px-4 py-2 border-b bg-muted/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">AIチェック結果: {Math.round(scoreResult.overall)}点</span>
            <button onClick={() => setScoreResult(null)} className="text-xs text-muted-foreground hover:text-foreground">閉じる</button>
          </div>
          {scoreResult.tips.length > 0 && (
            <ul className="space-y-0.5">
              {scoreResult.tips.map((tip, i) => (
                <li key={i} className="text-xs text-muted-foreground">{'>'} {tip}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className={`flex-1 flex flex-col ${focusMode ? 'max-w-2xl mx-auto w-full' : ''}`}>
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onSelect={handleSelect}
            placeholder="本文を書き始めましょう..."
            className="flex-1 resize-none border-0 rounded-none focus-visible:ring-0 text-base leading-loose p-6"
            style={{ fontFamily: '"Noto Serif JP", "游明朝", "YuMincho", serif' }}
          />
        </div>

        {/* AI Panel */}
        {showAi && !focusMode && (
          <div className="w-80 border-l hidden md:block">
            <AiAssistPanel
              currentContent={content}
              selectedText={selectedText}
              onInsert={handleInsertAi}
              onReplace={handleReplaceSelection}
              onClose={() => setShowAi(false)}
            />
          </div>
        )}

        {/* Version History Panel */}
        {showHistory && !focusMode && episodeId && (
          <div className="w-72 border-l hidden md:block">
            <VersionHistoryPanel
              episodeId={episodeId}
              onRestore={handleVersionRestore}
              onClose={() => setShowHistory(false)}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{wordCount.toLocaleString()} 文字</span>
          <span>{paragraphCount} 段落</span>
          <span>約{estimatedReadTime}分</span>
          <span>{saveStatusText}</span>
          <WordCountGoal currentCount={wordCount} />
        </div>
        <div className="flex items-center gap-3">
          {/* Scheduled publish */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={scheduled}
              onChange={(e) => setScheduled(e.target.checked)}
              className="rounded"
            />
            <span>予約公開</span>
          </label>
          {scheduled && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="text-xs border rounded px-1.5 py-0.5 bg-background"
            />
          )}
        </div>
      </div>

      {/* Mobile AI panel - bottom sheet */}
      {showAi && !focusMode && (
        <div className="md:hidden fixed inset-x-0 bottom-0 h-[60vh] bg-background border-t z-40 overflow-hidden">
          <AiAssistPanel
            currentContent={content}
            selectedText={selectedText}
            onInsert={handleInsertAi}
            onReplace={handleReplaceSelection}
            onClose={() => setShowAi(false)}
          />
        </div>
      )}

      {/* Draft restore dialog */}
      <ConfirmDialog
        open={!!confirmDraft}
        onOpenChange={(v) => { if (!v) setConfirmDraft(null); }}
        title="下書きの復元"
        message="前回の下書きが見つかりました。復元しますか？"
        confirmLabel="復元する"
        cancelLabel="破棄する"
        onConfirm={() => {
          if (confirmDraft) {
            setTitle(confirmDraft.title);
            setContent(confirmDraft.content);
          }
          setConfirmDraft(null);
        }}
        onCancel={() => setConfirmDraft(null)}
      />
    </div>
  );
}

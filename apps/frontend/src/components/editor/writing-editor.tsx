'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/dialog';
import { AiAssistPanel } from './ai-assist-panel';
import { VersionHistoryPanel } from './version-history-panel';
import { useAutosave } from '@/lib/use-autosave';
import { api } from '@/lib/api';
import { Sparkles, Maximize2, Minimize2, History } from 'lucide-react';

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
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [confirmDraft, setConfirmDraft] = useState<{ title: string; content: string } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { status: saveStatus, deleteDraft } = useAutosave({
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
        await onPublish({ title, content });
      } else {
        await api.createEpisode(workId, { title, content });
        router.push(`/works/${workId}/edit`);
      }
      await deleteDraft();
      // Fire-and-forget: update cached story summary
      api.updateStorySummary(workId).catch(() => {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '投稿に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  function handleVersionRestore(restoredTitle: string, restoredContent: string) {
    setTitle(restoredTitle);
    setContent(restoredContent);
    setShowHistory(false);
  }

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
          <span className="text-xs text-muted-foreground mr-1">{content.length.toLocaleString()}字</span>
          {saveStatus === 'saving' && <span className="text-xs text-muted-foreground">保存中...</span>}
          {saveStatus === 'saved' && <span className="text-xs text-muted-foreground">保存済み</span>}
          {saveStatus === 'error' && <span className="text-xs text-destructive">保存エラー</span>}
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

      {/* Main area */}
      <div className="flex-1 flex min-h-0">
        {/* Editor */}
        <div className={`flex-1 flex flex-col min-h-0 ${focusMode ? 'max-w-2xl mx-auto w-full' : ''}`}>
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onSelect={handleSelect}
            placeholder="本文を書き始めましょう..."
            className="flex-1 resize-none border-0 rounded-none focus-visible:ring-0 text-base leading-loose p-6 overflow-y-auto"
            style={{ fontFamily: '"Noto Serif JP", "游明朝", "YuMincho", serif' }}
          />
        </div>

        {/* AI Panel */}
        {showAi && !focusMode && (
          <div className="w-80 border-l hidden md:flex md:flex-col min-h-0">
            <AiAssistPanel
              workId={workId}
              currentContent={content}
              currentTitle={title}
              selectedText={selectedText}
              onInsert={handleInsertAi}
              onReplace={handleReplaceSelection}
              onClose={() => setShowAi(false)}
            />
          </div>
        )}

        {/* Version History Panel */}
        {showHistory && !focusMode && episodeId && (
          <div className="w-72 border-l hidden md:flex md:flex-col min-h-0">
            <VersionHistoryPanel
              episodeId={episodeId}
              onRestore={handleVersionRestore}
              onClose={() => setShowHistory(false)}
            />
          </div>
        )}
      </div>

      {/* Mobile AI panel - bottom sheet */}
      {showAi && !focusMode && (
        <div className="md:hidden fixed inset-x-0 bottom-0 h-[60vh] bg-background border-t z-40 flex flex-col">
          <AiAssistPanel
            workId={workId}
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

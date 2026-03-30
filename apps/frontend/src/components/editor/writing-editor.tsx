'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog, Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AiAssistPanel } from './ai-assist-panel';
import { VersionHistoryPanel } from './version-history-panel';
import { ReferencePanel } from './reference-panel';
import { AiConsistencyCheck } from './ai-consistency-check';
import { useAutosave } from '@/lib/use-autosave';
import { api } from '@/lib/api';
import { Sparkles, Maximize2, Minimize2, History, BookOpen, HelpCircle, Type, ArrowLeft } from 'lucide-react';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface WritingEditorProps {
  workId: string;
  episodeId?: string;
  initialTitle?: string;
  initialContent?: string;
  isPublished?: boolean;
  onPublish?: (data: { title: string; content: string; scheduledAt?: string }) => Promise<void>;
  onSaveDraft?: (data: { title: string; content: string }) => Promise<void>;
}

export function WritingEditor({
  workId,
  episodeId,
  initialTitle = '',
  initialContent = '',
  isPublished = false,
  onPublish,
  onSaveDraft,
}: WritingEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [focusMode, setFocusMode] = useState(false);
  const [showAi, setShowAi] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [confirmDraft, setConfirmDraft] = useState<{ title: string; content: string } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [rubyPopover, setRubyPopover] = useState<{ base: string; start: number; end: number } | null>(null);
  const [rubyReading, setRubyReading] = useState('');
  const [cursorLine, setCursorLine] = useState('');
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [aiPanelWidth, setAiPanelWidth] = useState(320);
  const aiResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rubyInputRef = useRef<HTMLInputElement>(null);

  const handleAiResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    aiResizeRef.current = { startX: e.clientX, startWidth: aiPanelWidth };
    const handleMove = (ev: MouseEvent) => {
      if (!aiResizeRef.current) return;
      const delta = aiResizeRef.current.startX - ev.clientX;
      setAiPanelWidth(Math.min(600, Math.max(280, aiResizeRef.current.startWidth + delta)));
    };
    const handleUp = () => {
      aiResizeRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [aiPanelWidth]);

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

  // Track cursor line for ruby preview
  const updateCursorLine = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pos = textarea.selectionStart;
    const lineStart = content.lastIndexOf('\n', pos - 1) + 1;
    const lineEnd = content.indexOf('\n', pos);
    const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
    setCursorLine(line);
  }, [content]);

  // Track text selection — preserve selection when clicking away to AI panel
  const handleSelect = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    // Only update selection state when the textarea is actually focused
    // This prevents clearing selectedText when user clicks AI panel buttons
    if (document.activeElement !== textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start !== end) {
      setSelectedText(content.slice(start, end));
    } else {
      // User clicked within textarea without selecting — clear selection
      setSelectedText('');
    }
    updateCursorLine();
  }, [content, updateCursorLine]);

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

  const handleInsertRuby = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);

    if (!selected) {
      // No selection: insert template and select the base text
      const template = '｜漢字《よみ》';
      const before = content.slice(0, start);
      const after = content.slice(end);
      setContent(before + template + after);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 1, start + 3);
      }, 0);
      return;
    }

    // Open popover for reading input
    setRubyReading('');
    setRubyPopover({ base: selected, start, end });
    setTimeout(() => rubyInputRef.current?.focus(), 50);
  }, [content]);

  const handleRubyConfirm = useCallback(() => {
    if (!rubyPopover || !rubyReading.trim()) return;
    const { base, start, end } = rubyPopover;
    const ruby = `｜${base}《${rubyReading.trim()}》`;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const textarea = textareaRef.current;
    const scrollTop = textarea?.scrollTop ?? 0;
    setContent(before + ruby + after);
    setRubyPopover(null);
    setRubyReading('');
    setTimeout(() => {
      if (textarea) {
        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(start + ruby.length, start + ruby.length);
        textarea.scrollTop = scrollTop;
      }
    }, 0);
  }, [content, rubyPopover, rubyReading]);

  const handleRubyCancel = useCallback(() => {
    setRubyPopover(null);
    setRubyReading('');
    textareaRef.current?.focus();
  }, []);

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

  async function handleSaveDraft() {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      if (onSaveDraft) {
        await onSaveDraft({ title, content });
      } else {
        await api.createEpisode(workId, { title, content, publish: false });
        router.push(`/works/${workId}/edit`);
      }
      await deleteDraft();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      if (onPublish) {
        await onPublish({ title, content });
      } else {
        await api.createEpisode(workId, { title, content, publish: true });
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

  function handleBack() {
    const hasChanges = title !== initialTitle || content !== initialContent;
    if (hasChanges && (title.trim() || content.trim())) {
      setShowBackConfirm(true);
    } else {
      router.push(`/works/${workId}/edit`);
    }
  }

  async function handleBackWithDraft() {
    setShowBackConfirm(false);
    if (title.trim() && content.trim()) {
      setSubmitting(true);
      try {
        if (onSaveDraft) {
          // onSaveDraft callback handles navigation itself
          await onSaveDraft({ title, content });
          await deleteDraft();
          return;
        } else if (episodeId) {
          await api.updateEpisode(episodeId, { title, content });
        } else {
          await api.createEpisode(workId, { title, content, publish: false });
        }
        await deleteDraft();
      } catch {
        // Draft save failed, but still navigate back
      } finally {
        setSubmitting(false);
      }
    }
    router.push(`/works/${workId}/edit`);
  }

  function handleBackWithoutSave() {
    setShowBackConfirm(false);
    router.push(`/works/${workId}/edit`);
  }

  function handleVersionRestore(restoredTitle: string, restoredContent: string) {
    setTitle(restoredTitle);
    setContent(restoredContent);
    setShowHistory(false);
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${focusMode ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      {/* Toolbar */}
      <div className={`flex-shrink-0 border-b ${focusMode ? '' : ''}`}>
        {/* Row 1: Title */}
        <div className={`flex items-center gap-2 px-4 pt-2 pb-1 ${focusMode ? 'justify-center' : ''}`}>
          {!focusMode && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleBack}
              className="shrink-0 -ml-2"
              title="戻る"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className={`flex-1 min-w-0 ${focusMode ? 'max-w-2xl' : ''}`}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="エピソードタイトル"
              className="border-0 text-lg font-medium focus-visible:ring-0 px-0"
            />
          </div>
        </div>
        {/* Row 2: Actions */}
        <div className={`flex items-center gap-1.5 px-4 pb-2 ${focusMode ? 'justify-center' : ''}`}>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{content.length.toLocaleString()}字</span>
          <span className="text-xs whitespace-nowrap shrink-0">
            {saveStatus === 'saving' && <span className="text-muted-foreground">保存中...</span>}
            {saveStatus === 'saved' && <span className="text-muted-foreground">&#x2713;</span>}
            {saveStatus === 'error' && <span className="text-destructive">保存エラー</span>}
          </span>
          <div className="flex-1" />
          <div className="relative">
            <Button
              size="sm"
              variant={rubyPopover ? 'secondary' : 'ghost'}
              onClick={handleInsertRuby}
              className="text-xs"
              title="ルビを振る（テキストを選択してクリック）"
            >
              <Type className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">ルビ</span>
            </Button>
            {rubyPopover && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-lg p-3 w-64">
                <p className="text-xs text-muted-foreground mb-2">
                  「{rubyPopover.base}」のルビ
                </p>
                <div className="flex gap-2">
                  <Input
                    ref={rubyInputRef}
                    value={rubyReading}
                    onChange={(e) => setRubyReading(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleRubyConfirm(); }
                      if (e.key === 'Escape') handleRubyCancel();
                    }}
                    placeholder="よみがな"
                    className="text-xs h-7 flex-1"
                  />
                  <Button size="sm" onClick={handleRubyConfirm} disabled={!rubyReading.trim()} className="h-7 text-xs px-2">
                    確定
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">Enter で確定 / Esc でキャンセル</p>
              </div>
            )}
          </div>
          {!focusMode && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowReference(!showReference)}
              className="text-xs"
            >
              <BookOpen className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">参照</span>
            </Button>
          )}
          {!focusMode && episodeId && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs"
            >
              <History className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">履歴</span>
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
              <span className="hidden sm:inline">AI</span>
            </Button>
          )}
          {!focusMode && (
            <a href="/guide/writers" target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost" className="text-xs">
                <HelpCircle className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">ガイド</span>
              </Button>
            </a>
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
            variant="outline"
            onClick={handleSaveDraft}
            disabled={submitting || !title.trim() || !content.trim()}
          >
            {submitting ? '保存中...' : '下書き保存'}
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !content.trim()}
          >
            {submitting ? '投稿中...' : isPublished ? '更新' : '公開する'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 px-4 py-2 text-sm text-destructive bg-destructive/10">{error}</div>
      )}

      {/* Main area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Reference Panel */}
        {showReference && !focusMode && (
          <div className="w-72 flex-shrink-0 border-r hidden md:flex md:flex-col min-h-0 overflow-hidden">
            <ReferencePanel workId={workId} onClose={() => setShowReference(false)} />
          </div>
        )}

        {/* Editor */}
        <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${focusMode ? 'max-w-2xl mx-auto w-full' : ''}`}>
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => { setContent(e.target.value); setTimeout(updateCursorLine, 0); }}
            onSelect={handleSelect}
            onClick={updateCursorLine}
            onKeyUp={updateCursorLine}
            placeholder="本文を書き始めましょう..."
            className="flex-1 resize-none border-0 rounded-none focus-visible:ring-0 text-base leading-loose p-6 overflow-y-auto"
            style={{ fontFamily: '"Noto Serif JP", "游明朝", "YuMincho", serif' }}
          />
          {/* Ruby preview bar — shows current line with ruby rendered */}
          {cursorLine && /[｜|][^《》]+《[^》]+》|[一-龥々〇ヶ]+《[^》]+》/.test(cursorLine) && (
            <div className="flex-shrink-0 border-t border-border px-6 py-2 bg-muted/30">
              <p className="text-[10px] text-muted-foreground mb-0.5">ルビプレビュー</p>
              <p
                className="text-base leading-loose"
                style={{ fontFamily: '"Noto Serif JP", "游明朝", "YuMincho", serif' }}
                dangerouslySetInnerHTML={{
                  __html: escapeHtml(cursorLine)
                    .replace(/[｜|]([^｜|《》\n]+)《([^》\n]+)》/g, '<ruby>$1<rp>(</rp><rt>$2</rt><rp>)</rp></ruby>')
                    .replace(/([一-龥々〇ヶ]+)《([^》\n]+)》/g, '<ruby>$1<rp>(</rp><rt>$2</rt><rp>)</rp></ruby>'),
                }}
              />
            </div>
          )}
          {episodeId && !focusMode && (
            <AiConsistencyCheck workId={workId} episodeId={episodeId} content={content} />
          )}
        </div>

        {/* AI Panel */}
        {showAi && !focusMode && (
          <div className="flex-shrink-0 border-l hidden md:flex md:flex-col min-h-0 overflow-hidden relative" style={{ width: aiPanelWidth }}>
            {/* Resize handle */}
            <div
              onMouseDown={handleAiResizeStart}
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
            />
            <AiAssistPanel
              workId={workId}
              episodeId={episodeId}
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
        <>
          <div className="md:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setShowAi(false)} />
          <div className="md:hidden fixed inset-x-0 bottom-0 h-[70vh] bg-background border-t z-40 flex flex-col rounded-t-xl">
            <div className="flex-shrink-0 flex justify-center py-2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <AiAssistPanel
                workId={workId}
                episodeId={episodeId}
                currentContent={content}
                selectedText={selectedText}
                onInsert={handleInsertAi}
                onReplace={handleReplaceSelection}
                onClose={() => setShowAi(false)}
              />
            </div>
          </div>
        </>
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

      {/* Back confirmation dialog */}
      <Dialog open={showBackConfirm} onOpenChange={setShowBackConfirm}>
        <DialogHeader>
          <DialogTitle>下書きを保存しますか？</DialogTitle>
        </DialogHeader>
        <DialogDescription>変更が保存されていません。下書きとして保存してから戻りますか？</DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowBackConfirm(false)}>
            キャンセル
          </Button>
          <Button variant="ghost" onClick={handleBackWithoutSave}>
            保存せず戻る
          </Button>
          <Button onClick={handleBackWithDraft} disabled={submitting}>
            {submitting ? '保存中...' : '下書き保存して戻る'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

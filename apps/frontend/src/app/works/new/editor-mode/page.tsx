'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Send, Loader2,
  Bot, ArrowLeft, MessageSquare,
  Sparkles, Pen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { api } from '@/lib/api';
import { consumeSSEStream } from '@/lib/use-ai-stream';
import { cn } from '@/lib/utils';
import { DesignDisplay } from '@/components/editor-mode-design/design-display';
import type { DesignData, ChatMessage } from '@/components/editor-mode-design/types';
import { normalizeDesignUpdate } from '@/components/editor-mode-design/normalize';

const GENRE_CHIPS = ['ファンタジー', 'SF', 'ミステリー', '恋愛', 'ホラー', '現代文学', '歴史'];

function EditorModeDesignContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeWorkId = searchParams.get('resume');

  // Core state
  const [phase, setPhase] = useState<'brief' | 'generating' | 'review'>(resumeWorkId ? 'generating' : 'brief');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [briefValue, setBriefValue] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [design, setDesign] = useState<DesignData>({});
  const [creditsConsumed, setCreditConsumed] = useState(0);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [workId, setWorkId] = useState<string | null>(resumeWorkId);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [highlightedKeys, setHighlightedKeys] = useState<Set<string>>(new Set());

  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always Opus
  const aiMode = 'premium' as const;

  // Load credits on mount
  useEffect(() => {
    api.getAiStatus()
      .then((res: any) => {
        if (res.data?.tier?.credits?.total !== undefined) {
          setCreditsRemaining(res.data.tier.credits.total);
        }
      })
      .catch(() => {});
  }, []);

  // Resume: load existing design + jump to review
  useEffect(() => {
    if (!resumeWorkId) return;
    api.editorModeStatus(resumeWorkId)
      .then((res: any) => {
        const job = res?.data || res;
        if (job?.designChatHistory && Array.isArray(job.designChatHistory)) {
          setMessages(job.designChatHistory.filter((m: any) => m.role && m.content).map((m: any) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content.replace(/__DESIGN_UPDATE__[\s\S]*?(__END_UPDATE__|$)/g, '').trim(),
          })));
        }
        if (job?.creditsConsumed) setCreditConsumed(job.creditsConsumed);
        if (job?.designChatHistory) {
          let merged: Partial<DesignData> = {};
          for (const msg of (job.designChatHistory as any[])) {
            if (msg.role !== 'assistant') continue;
            const patterns = [
              /__DESIGN_UPDATE__\s*([\s\S]*?)__END_UPDATE__/,
              /__DESIGN_UPDATE__\s*```json\s*([\s\S]*?)```/,
              /__DESIGN_UPDATE__\s*(\{[\s\S]*?\})\s*$/,
            ];
            for (const pattern of patterns) {
              const match = msg.content.match(pattern);
              if (match) {
                try {
                  const parsed = normalizeDesignUpdate(JSON.parse(match[1]));
                  for (const [k, v] of Object.entries(parsed)) {
                    if (v !== undefined && v !== null) {
                      (merged as any)[k] = v;
                    }
                  }
                } catch { /* skip */ }
                break;
              }
            }
          }
          if (Object.keys(merged).length > 0) {
            setDesign(merged);
          }
        }
        setPhase('review');
      })
      .catch(() => {
        setPhase('brief');
      });
  }, [resumeWorkId]);

  // Auto-scroll chat (only in review phase, not during initial generation)
  useEffect(() => {
    if (phase === 'review') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, phase]);

  /** Flash highlight on changed keys for 4 seconds */
  const flashHighlight = useCallback((keys: string[]) => {
    if (keys.length === 0) return;
    setHighlightedKeys(new Set(keys));
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedKeys(new Set()), 4000);
  }, []);

  const applyDesignUpdate = useCallback((raw: any) => {
    const update = normalizeDesignUpdate(raw);
    const keys = Object.keys(update);
    setDesign(prev => ({ ...prev, ...update }));
    flashHighlight(keys);
  }, [flashHighlight]);

  /**
   * Core message sending logic.
   * @param isInitial — true for the first brief submission (no chat UI, only generating screen)
   */
  const sendMessage = useCallback(async (message: string, existingMessages: ChatMessage[] = messages, isInitial = false) => {
    if (!message.trim() || isStreaming) return;
    setError(null);

    // For refinement messages, add to chat. For initial brief, don't show in chat.
    const newMessages: ChatMessage[] = isInitial
      ? existingMessages
      : [...existingMessages, { role: 'user', content: message }];
    if (!isInitial) setMessages(newMessages);
    setIsStreaming(true);
    setStreamingText('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = api.getToken();
      const chatUrl = await api.editorModeChat(workId || '_new');

      const res = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message, aiMode, designState: design }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Error: ${res.status}`);
      }

      let accumulated = '';
      await consumeSSEStream(res, (parsed) => {
        if (parsed.error) {
          setError(parsed.error);
          return;
        }
        if (parsed.text) {
          accumulated += parsed.text;
          const cleanForDisplay = accumulated.replace(/__DESIGN_UPDATE__[\s\S]*$/g, '').trim();
          // During initial generation, only update streamingText (shown on generating screen)
          // During refinement, update both streamingText and chat messages
          setStreamingText(cleanForDisplay);
          if (!isInitial) {
            setMessages([...newMessages, { role: 'assistant', content: cleanForDisplay }]);
          }
        }
        if (parsed.workId) {
          setWorkId(parsed.workId);
          const url = new URL(window.location.href);
          if (!url.searchParams.has('resume')) {
            url.searchParams.set('resume', parsed.workId);
            window.history.replaceState({}, '', url.toString());
          }
        }
        if (parsed.creditsConsumed !== undefined) {
          setCreditConsumed(parsed.creditsConsumed);
        }
        if (parsed.creditsRemaining !== undefined) {
          setCreditsRemaining(parsed.creditsRemaining);
        }
        if (parsed.designUpdate) {
          applyDesignUpdate(parsed.designUpdate);
        }
      });

      // Parse __DESIGN_UPDATE__ from accumulated text
      const patterns = [
        /__DESIGN_UPDATE__\s*```json\s*([\s\S]*?)```\s*(__END_UPDATE__)?/,
        /__DESIGN_UPDATE__\s*(\{[\s\S]*?\})\s*__END_UPDATE__/,
        /__DESIGN_UPDATE__\s*(\{[\s\S]*?\})\s*$/,
      ];
      for (const pattern of patterns) {
        const designMatch = accumulated.match(pattern);
        if (designMatch) {
          try {
            const raw = JSON.parse(designMatch[1]);
            applyDesignUpdate(raw);
          } catch { /* skip */ }
          // For refinement, store clean AI response in chat
          if (!isInitial) {
            const cleanContent = accumulated
              .replace(/__DESIGN_UPDATE__[\s\S]*?(__END_UPDATE__|$)/, '')
              .replace(/\s*---\s*$/, '')
              .trim();
            setMessages([...newMessages, { role: 'assistant', content: cleanContent }]);
          }
          break;
        }
      }

      setPhase('review');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      if (phase === 'generating') setPhase('brief');
    } finally {
      setIsStreaming(false);
      setStreamingText('');
      api.getAiStatus()
        .then((res: any) => {
          if (res.data?.tier?.credits?.total !== undefined) {
            setCreditsRemaining(res.data.tier.credits.total);
          }
        })
        .catch(() => {});
      if (workId) {
        api.editorModeStatus(workId)
          .then((res: any) => {
            const job = res?.data || res;
            if (job?.creditsConsumed !== undefined) {
              setCreditConsumed(job.creditsConsumed);
            }
          })
          .catch(() => {});
      }
    }
  }, [isStreaming, messages, aiMode, workId, design, applyDesignUpdate, phase]);

  const handleBriefSubmit = useCallback(() => {
    const genrePrefix = selectedGenres.length > 0 ? `[ジャンル: ${selectedGenres.join(', ')}] ` : '';
    const fullMessage = genrePrefix + briefValue.trim();
    if (!fullMessage.trim()) return;
    setPhase('generating');
    sendMessage(fullMessage, [], true); // isInitial = true → no chat UI
  }, [briefValue, selectedGenres, sendMessage]);

  const handleRefinementSend = useCallback(() => {
    if (!inputValue.trim() || isStreaming) return;
    const msg = inputValue.trim();
    setInputValue('');
    sendMessage(msg);
  }, [inputValue, isStreaming, sendMessage]);

  // Mobile chat sheet state
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /** Called when user clicks "修正を依頼" on a design section */
  const handleRequestRevision = useCallback((sectionLabel: string, _context: string) => {
    const prefix = `【${sectionLabel}について】`;
    setInputValue(prefix + ' ');
    // On mobile, open the bottom sheet
    setChatSheetOpen(true);
    // Focus the input after sheet opens
    setTimeout(() => inputRef.current?.focus(), 350);
  }, []);

  const handleFinalize = async () => {
    if (!workId || !design.episodeCount || !design.charCountPerEpisode) return;
    setFinalizing(true);
    setError(null);

    try {
      await api.editorModeFinalizeDesign(workId, {
        totalEpisodes: design.episodeCount,
        charCountPerEpisode: design.charCountPerEpisode,
        aiMode,
      });
      router.push(`/works/${workId}/editor-mode`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to finalize design');
    } finally {
      setFinalizing(false);
    }
  };

  const toggleGenre = (g: string) => {
    setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  // ─── Phase: Brief ───
  if (phase === 'brief') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-2xl space-y-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/works/new')}
            className="text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            戻る
          </Button>

          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 text-indigo-500 mb-2">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-medium">編集者モード</span>
            </div>
            <h1 className="text-2xl font-bold">どんな物語を作りたいですか？</h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              ジャンル、テーマ、雰囲気、キャラクター像…自由に書いてください。AIが完全な設計書を生成します。
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {GENRE_CHIPS.map(g => (
              <button
                key={g}
                onClick={() => toggleGenre(g)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  selectedGenres.includes(g)
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
                    : 'border-border text-muted-foreground hover:border-indigo-500/30 hover:text-foreground',
                )}
              >
                {g}
              </button>
            ))}
          </div>

          <Textarea
            value={briefValue}
            onChange={(e) => setBriefValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && briefValue.trim()) {
                e.preventDefault();
                handleBriefSubmit();
              }
            }}
            placeholder="例: 記憶を失った少女が、崩壊しつつある幻想世界を旅しながら自分の正体を知る物語。切なくも温かい雰囲気で、最後に大きなどんでん返しを..."
            rows={5}
            className="text-sm resize-none"
          />

          <div className="flex items-center justify-end">
            <CreditDisplay consumed={creditsConsumed} remaining={creditsRemaining} />
          </div>

          <Button
            onClick={handleBriefSubmit}
            disabled={!briefValue.trim()}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
            size="lg"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            設計書を生成 (10cr)
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            Claude Opusが全体の設計書（キャラクター・世界観・プロット・感情設計）を一括生成します
          </p>
        </div>
      </div>
    );
  }

  // ─── Phase: Generating ───
  if (phase === 'generating') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-xl space-y-6 text-center">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-medium">設計書を生成中</h2>
            <p className="text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                AIが物語の設計書を構築しています
                <span className="inline-flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </span>
            </p>
          </div>

          {streamingText && (
            <div className="text-left bg-secondary/50 rounded-lg p-4 max-h-64 overflow-y-auto">
              <div className="flex items-start gap-2">
                <Bot className="h-4 w-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {streamingText}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
              {error}
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => { setPhase('brief'); setError(null); }}
              >
                やり直す
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Shared chat UI (reused in desktop panel and mobile bottom sheet) ───
  const chatMessagesUI = (
    <>
      {messages.map((msg, i) => (
        <div key={i} className={cn('flex items-start gap-2', msg.role === 'user' && 'flex-row-reverse')}>
          <div className={cn(
            'h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0',
            msg.role === 'user' ? 'bg-primary/10' : 'bg-indigo-500/10',
          )}>
            {msg.role === 'user' ? (
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Bot className="h-3.5 w-3.5 text-indigo-500" />
            )}
          </div>
          <div className={cn(
            'rounded-lg p-3 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap',
            msg.role === 'user' ? 'bg-primary/5 border border-primary/20' : 'bg-secondary/50',
          )}>
            {msg.content}
          </div>
        </div>
      ))}
      {isStreaming && (
        <div className="flex items-start gap-2">
          <div className="h-7 w-7 rounded-full bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
            <Bot className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-sm leading-relaxed max-w-[85%]">
            {streamingText ? (
              <p className="whitespace-pre-wrap">{streamingText}</p>
            ) : (
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </div>
        </div>
      )}
      <div ref={chatEndRef} />
    </>
  );

  const chatInputUI = (
    <div className="flex gap-2 items-end">
      <Textarea
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && inputValue.trim() && !isStreaming) {
            e.preventDefault();
            handleRefinementSend();
          }
        }}
        placeholder='修正指示を入力... 例: 「主人公の性格をもっと内向的にして」'
        rows={2}
        className="flex-1 resize-none text-sm"
      />
      <Button
        onClick={handleRefinementSend}
        disabled={!inputValue.trim() || isStreaming}
        className="self-end bg-indigo-500 hover:bg-indigo-600 text-white"
      >
        {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );

  // Last assistant message preview for mobile bar
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');

  // ─── Phase: Review ───
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push('/works/new')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-sm font-medium truncate">
            {design.title || '設計書レビュー'}
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <CreditDisplay consumed={creditsConsumed} remaining={creditsRemaining} />
          <Button
            onClick={handleFinalize}
            disabled={finalizing || !workId || !design.episodeCount || !design.charCountPerEpisode}
            size="sm"
            className="bg-indigo-500 hover:bg-indigo-600 text-white"
          >
            {finalizing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Pen className="h-3.5 w-3.5 mr-1" />
            )}
            <span className="hidden sm:inline">設計を確定して執筆へ</span>
            <span className="sm:hidden">確定</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2">
          <div className="p-2 text-xs text-destructive bg-destructive/10 rounded-md">{error}</div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Design display (full width on mobile, 60% on desktop) */}
        <div className="flex-1 lg:flex-[3] overflow-y-auto lg:border-r pb-16 lg:pb-0">
          <div className="p-4 max-w-3xl">
            <DesignDisplay
              design={design}
              onChange={(partial) => setDesign(prev => ({ ...prev, ...partial }))}
              onRequestRevision={handleRequestRevision}
              highlightedKeys={highlightedKeys}
            />
          </div>
        </div>

        {/* Desktop: Chat panel (right 40%) */}
        <div className="hidden lg:flex lg:flex-[2] flex-col min-h-0">
          <div className="flex-shrink-0 px-4 py-2 border-b bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">対話 — 修正指示・ブラッシュアップ (5cr/回)</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessagesUI}
          </div>
          <div className="flex-shrink-0 border-t p-3">
            {chatInputUI}
          </div>
        </div>

        {/* Mobile: Persistent bottom bar (opens chat sheet) */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 border-t bg-background z-40">
          <button
            onClick={() => setChatSheetOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              {isStreaming ? (
                <p className="text-xs text-indigo-500 font-medium">AI応答中...</p>
              ) : lastAssistantMsg ? (
                <p className="text-xs text-muted-foreground truncate">{lastAssistantMsg.content}</p>
              ) : (
                <p className="text-xs text-muted-foreground">修正指示を入力...</p>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground/70">5cr/回</span>
          </button>
        </div>

        {/* Mobile: Chat bottom sheet */}
        <BottomSheet
          open={chatSheetOpen}
          onClose={() => setChatSheetOpen(false)}
          title="対話 — 修正指示・ブラッシュアップ"
        >
          <div className="flex flex-col" style={{ height: '70vh' }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessagesUI}
            </div>
            <div className="flex-shrink-0 border-t p-3">
              {chatInputUI}
            </div>
          </div>
        </BottomSheet>
      </div>
    </div>
  );
}

function CreditDisplay({ consumed, remaining }: { consumed: number; remaining: number | null }) {
  return (
    <div className="text-xs text-muted-foreground">
      消費: <span className="font-medium text-foreground">{consumed}cr</span>
      {remaining !== null && (
        <> / 残り: <span className="font-medium text-foreground">{remaining}cr</span></>
      )}
    </div>
  );
}

export default function EditorModeDesignPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[70vh]" />}>
      <EditorModeDesignContent />
    </Suspense>
  );
}

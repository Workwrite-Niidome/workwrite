'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Send, Crown, Loader2,
  Bot, ArrowLeft, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { consumeSSEStream } from '@/lib/use-ai-stream';
import { cn } from '@/lib/utils';
import { DesignPanel } from '@/components/editor-mode-design/design-panel';
import { TAB_DEFINITIONS } from '@/components/editor-mode-design/types';
import type { DesignData, ChatMessage, DesignTab } from '@/components/editor-mode-design/types';
import { normalizeDesignUpdate } from '@/components/editor-mode-design/normalize';

/** Given updated design keys, find which tab they belong to */
function computeHighlightedTab(updatedKeys: string[]): DesignTab | null {
  for (const tab of TAB_DEFINITIONS) {
    if (tab.designKeys.some(k => updatedKeys.includes(k))) {
      return tab.key;
    }
  }
  return null;
}

function EditorModeDesignContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeWorkId = searchParams.get('resume');
  const [aiMode, setAiMode] = useState<'normal' | 'premium'>('normal');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [design, setDesign] = useState<DesignData>({});
  const [creditsConsumed, setCreditConsumed] = useState(0);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [workId, setWorkId] = useState<string | null>(resumeWorkId);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [highlightedTab, setHighlightedTab] = useState<DesignTab | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Resume: load existing chat history
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
        // Merge ALL __DESIGN_UPDATE__ blocks from chat history (oldest to newest)
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
      })
      .catch(() => {});
  }, [resumeWorkId]);

  // Auto-scroll chat
  const chatContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  /** Flash highlighted tab for 3 seconds when design updates arrive */
  const flashHighlightedTab = useCallback((updatedKeys: string[]) => {
    const tab = computeHighlightedTab(updatedKeys);
    if (!tab) return;
    setHighlightedTab(tab);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedTab(null), 3000);
  }, []);

  const applyDesignUpdate = useCallback((raw: any) => {
    const update = normalizeDesignUpdate(raw);
    const keys = Object.keys(update);
    setDesign(prev => ({ ...prev, ...update }));
    flashHighlightedTab(keys);
  }, [flashHighlightedTab]);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return;
    const message = inputValue.trim();
    setInputValue('');
    setError(null);

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: message }];
    setMessages(newMessages);
    setIsStreaming(true);

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
          setMessages([...newMessages, { role: 'assistant', content: accumulated }]);
        }
        if (parsed.workId) {
          setWorkId(parsed.workId);
          // Update URL so page refresh can resume
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

      // Check for __DESIGN_UPDATE__ block in accumulated text
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
            const cleanContent = accumulated
              .replace(/__DESIGN_UPDATE__[\s\S]*?(__END_UPDATE__|$)/, '')
              .replace(/\s*---\s*$/, '')
              .trim();
            setMessages([...newMessages, { role: 'assistant', content: cleanContent }]);
          } catch {
            const cleanContent = accumulated
              .replace(/__DESIGN_UPDATE__[\s\S]*?(__END_UPDATE__|$)/, '')
              .trim();
            if (cleanContent !== accumulated) {
              setMessages([...newMessages, { role: 'assistant', content: cleanContent }]);
            }
          }
          break;
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsStreaming(false);
      // Refresh credit balance and consumed count after each message
      api.getAiStatus()
        .then((res: any) => {
          if (res.data?.tier?.credits?.total !== undefined) {
            setCreditsRemaining(res.data.tier.credits.total);
          }
        })
        .catch(() => {});
      // Also refresh consumed credits from server
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
  }, [inputValue, isStreaming, messages, aiMode, workId, applyDesignUpdate]);

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

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push('/works/new')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-sm font-medium">編集者モード - 設計対話</h1>
        </div>
        <div className="flex items-center gap-3">
          <ModeSelector aiMode={aiMode} onModeChange={setAiMode} />
          <CreditDisplay consumed={creditsConsumed} remaining={creditsRemaining} />
        </div>
      </div>

      {/* Main content: split pane */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Left: Chat */}
        <div className="flex-1 flex flex-col min-h-0 lg:border-r">
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="bg-secondary/50 rounded-lg p-3 text-sm leading-relaxed max-w-[85%]">
                  どんな物語を作りたいですか？ジャンル、雰囲気、テーマなど自由に教えてください。
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex items-start gap-3', msg.role === 'user' && 'flex-row-reverse')}>
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                  msg.role === 'user' ? 'bg-primary/10' : 'bg-indigo-500/10',
                )}>
                  {msg.role === 'user' ? (
                    <MessageSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Bot className="h-4 w-4 text-indigo-500" />
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
            {isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <span className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {error && (
            <div className="px-4 py-2">
              <div className="p-2 text-xs text-destructive bg-destructive/10 rounded-md">{error}</div>
            </div>
          )}

          {/* Input */}
          <div className="flex-shrink-0 border-t p-3">
            <div className="flex gap-2">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && inputValue.trim() && !isStreaming) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="作品のビジョンを伝えましょう... (Ctrl+Enter)"
                rows={2}
                className="flex-1 resize-none"
              />
              <Button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isStreaming}
                className="self-end"
              >
                {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Design Panel */}
        <div className="lg:w-96 flex-shrink-0 border-t lg:border-t-0 overflow-y-auto">
          <DesignPanel
            design={design}
            onChange={(partial) => setDesign(prev => ({ ...prev, ...partial }))}
            onFinalize={handleFinalize}
            finalizing={finalizing}
            creditsRemaining={creditsRemaining}
            creditsConsumed={creditsConsumed}
            highlightedTab={highlightedTab}
          />
        </div>
      </div>
    </div>
  );
}

// Sub-components

function ModeSelector({ aiMode, onModeChange }: { aiMode: 'normal' | 'premium'; onModeChange: (mode: 'normal' | 'premium') => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onModeChange('normal')}
        className={cn(
          'flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] font-medium border transition-colors',
          aiMode === 'normal'
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'border-border text-muted-foreground hover:border-primary/30',
        )}
      >
        通常 <span className="opacity-60">1cr</span>
      </button>
      <button
        onClick={() => onModeChange('premium')}
        className={cn(
          'flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] font-medium border transition-colors',
          aiMode === 'premium'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-600'
            : 'border-border text-muted-foreground hover:border-amber-500/30',
        )}
      >
        <Crown className="h-2.5 w-2.5" />
        高精度 <span className="opacity-60">5cr</span>
      </button>
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

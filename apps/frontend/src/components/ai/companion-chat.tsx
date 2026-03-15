'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type CompanionMessage } from '@/lib/api';
import { consumeSSEStream } from '@/lib/use-ai-stream';
import { useAuth } from '@/lib/auth-context';

interface CompanionChatProps {
  workId: string;
}

export function CompanionChat({ workId }: CompanionChatProps) {
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [tier, setTier] = useState<{ plan: string; canUseAi: boolean; remainingFreeUses: number | null } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    Promise.all([
      api.getCompanionHistory(workId).catch(() => ({ data: [], messages: [] })),
      api.getAiStatus().catch(() => ({ data: { available: false, model: '', tier: undefined } })),
    ]).then(([histRes, statusRes]) => {
      const msgs = (histRes as any).data || (histRes as any).messages || [];
      setMessages(Array.isArray(msgs) ? msgs : []);
      const statusData = (statusRes as any).data || statusRes;
      if (statusData.tier) {
        setTier(statusData.tier);
      }
    }).finally(() => setLoading(false));
  }, [workId, isAuthenticated]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || streaming) return;
    setError('');
    const userMsg: CompanionMessage = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setStreaming(true);

    const assistantMsg: CompanionMessage = { role: 'assistant', content: '', timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const response = await api.fetchSSE(`/ai/companion/${workId}/chat`, { message: userMsg.content });

      await consumeSSEStream(response, (parsed) => {
        if (parsed.error) {
          setError(parsed.error);
          // Remove empty assistant message
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1);
            return prev;
          });
          return;
        }
        if (parsed.text) {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content + parsed.text };
            }
            return updated;
          });
        }
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === 'assistant' && !last.content) {
          updated[updated.length - 1] = { ...last, content: 'エラーが発生しました。もう一度お試しください。' };
        }
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  async function handleClear() {
    await api.clearCompanionHistory(workId).catch(() => {});
    setMessages([]);
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-4">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">ログインが必要です</p>
          <p className="text-xs text-muted-foreground mt-1">AI読書コンパニオンを利用するにはログインしてください。</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-12 w-2/3 ml-auto" />
      </div>
    );
  }

  const isFree = tier?.plan === 'free';
  const remainingUses = tier?.remainingFreeUses ?? null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div>
          <p className="text-sm font-medium">AI読書コンパニオン</p>
          <p className="text-xs text-muted-foreground">
            ネタバレなしで作品について語れます
            {isFree && remainingUses !== null && (
              <span className="ml-1">（残り{remainingUses}回/週）</span>
            )}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleClear} className="h-8 w-8" title="会話をクリア">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            この作品について質問してみましょう
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}>
              {msg.content || (streaming && i === messages.length - 1 ? (
                <span className="inline-flex gap-1">
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
                </span>
              ) : '')}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-destructive bg-destructive/10 border-t border-destructive/20">
          {error}
        </div>
      )}

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && handleSend()}
            placeholder="メッセージを入力..."
            disabled={streaming}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
          />
          <Button size="sm" onClick={handleSend} disabled={streaming || !input.trim()} className="min-h-[40px]">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

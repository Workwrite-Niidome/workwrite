'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, type CompanionMessage, type CharacterMatch } from '@/lib/api';
import { consumeSSEStream } from '@/lib/use-ai-stream';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';


const PRESET_MESSAGES = [
  'あなたはどんな人？',
  'あなたの世界ってどんなところ？',
  '最近どんなことがあった？',
];

interface CharacterChatPopupProps {
  character: CharacterMatch;
  open: boolean;
  onClose: () => void;
}

export function CharacterChatPopup({ character, open, onClose }: CharacterChatPopupProps) {
  const { isAuthenticated } = useAuth();
  const [phase, setPhase] = useState<'preset' | 'confirm' | 'chat'>('preset');
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [input, setInput] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [useSonnet, setUseSonnet] = useState(false);
  const [credits, setCredits] = useState<{ total: number; monthly: number; purchased: number } | null>(null);
  const [readProgress, setReadProgress] = useState<{ readCount: number; totalCount: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const c = character;
  const costPerMessage = useSonnet ? 2 : 1;

  // Load initial data when popup opens
  useEffect(() => {
    if (!open || !isAuthenticated || initialized.current) return;
    initialized.current = true;

    Promise.all([
      api.getAiStatus().catch(() => ({ data: { tier: undefined } })),
      api.getCharacterTalkHistory(c.work.id, c.id).catch(() => ({ data: { messages: [] } })),
    ]).then(([statusRes, histRes]) => {
      const statusData = (statusRes as any).data || statusRes;
      if (statusData.tier?.credits) {
        setCredits(statusData.tier.credits);
      }
      const raw = histRes as any;
      const msgs = raw?.data?.messages || raw?.messages || raw?.data || [];
      const msgArray = Array.isArray(msgs) ? msgs : [];
      setMessages(msgArray);
      // If there's existing conversation, go directly to chat
      if (msgArray.length > 0) {
        setPhase('chat');
      }
    });
  }, [open, isAuthenticated, c.work.id, c.id]);

  // Reset and abort when popup closes
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      initialized.current = false;
      setPhase('preset');
      setMessages([]);
      setInput('');
      setPendingMessage('');
      setError('');
      setStreaming(false);
    }
  }, [open]);

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const startChat = useCallback((message: string) => {
    setPendingMessage(message);
    setPhase('confirm');
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setError('');
    const userMsg: CompanionMessage = { role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setStreaming(true);

    const assistantMsg: CompanionMessage = { role: 'assistant', content: '', timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await api.fetchSSE(`/ai/character-talk/${c.work.id}/chat`, {
        message: text.trim(),
        mode: 'character',
        characterId: c.id,
        useSonnet,
      }, controller.signal);

      await consumeSSEStream(response, (parsed) => {
        if (controller.signal.aborted) return;
        if (parsed.error) {
          setError(parsed.error);
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
        if (parsed.credits) {
          setCredits(parsed.credits);
        }
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
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
  }, [c.work.id, c.id, useSonnet]);

  const confirmAndSend = useCallback(async () => {
    setPhase('chat');
    await sendMessage(pendingMessage);
  }, [pendingMessage, sendMessage]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Bottom Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md md:rounded-xl border-t md:border border-border bg-background shadow-xl animate-in slide-in-from-bottom md:zoom-in-95 md:fade-in-0"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium truncate">{c.name}</h3>
            <p className="text-[10px] text-muted-foreground truncate">{c.work.title}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Preset phase */}
        {phase === 'preset' && (
          <div className="p-4 space-y-3" style={{ maxHeight: 'calc(85vh - 56px)', overflowY: 'auto' }}>
            {credits && (
              <p className="text-[11px] text-muted-foreground">
                残高: {credits.total}cr | 1回 {costPerMessage}cr
              </p>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">話しかける</p>
              {PRESET_MESSAGES.map((msg) => (
                <button
                  key={msg}
                  onClick={() => startChat(msg)}
                  className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-border hover:bg-secondary hover:border-primary/20 transition-colors"
                >
                  {msg}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && input.trim()) startChat(input.trim()); }}
                placeholder="自由に聞く..."
                className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <Button
                size="sm"
                disabled={!input.trim()}
                onClick={() => input.trim() && startChat(input.trim())}
                className="min-h-[40px]"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setUseSonnet(false)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[10px] border transition-colors',
                  !useSonnet ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground',
                )}
              >
                少し話してみる (1cr)
              </button>
              <button
                onClick={() => setUseSonnet(true)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[10px] border transition-colors',
                  useSonnet ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground',
                )}
              >
                じっくり会話する (2cr)
              </button>
            </div>
          </div>
        )}

        {/* Confirm phase */}
        {phase === 'confirm' && (
          <div className="p-6 space-y-4 text-center">
            <Coins className="h-8 w-8 mx-auto text-primary" />
            <div>
              <p className="text-sm font-medium">クレジットを使用します</p>
              <p className="text-xs text-muted-foreground mt-1">
                {costPerMessage}cr消費して{c.name}と会話を開始します
              </p>
              {credits && (
                <p className="text-xs text-muted-foreground mt-1">
                  残高: {credits.total}cr → {credits.total - costPerMessage}cr
                </p>
              )}
            </div>
            <div className="bg-muted rounded-lg p-3 text-left">
              <p className="text-xs text-muted-foreground">あなたのメッセージ:</p>
              <p className="text-sm mt-1">{pendingMessage}</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setPhase('preset')}>
                戻る
              </Button>
              <Button onClick={confirmAndSend}>
                {costPerMessage}crで送信
              </Button>
            </div>
          </div>
        )}

        {/* Chat phase */}
        {phase === 'chat' && (
          <div className="flex flex-col" style={{ height: 'calc(85vh - 56px)' }}>
            {/* Mode toggle */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <button
                onClick={() => setUseSonnet(false)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] border transition-colors',
                  !useSonnet ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground',
                )}
              >
                少し話してみる
              </button>
              <button
                onClick={() => setUseSonnet(true)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] border transition-colors',
                  useSonnet ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground',
                )}
              >
                じっくり会話する
              </button>
              {credits && (
                <span className="text-[11px] text-muted-foreground ml-auto">
                  残{credits.total}cr
                </span>
              )}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  {c.name}との会話を始めましょう
                </p>
              )}
              {messages.map((msg, i) => (
                <div key={`${msg.role}-${i}-${msg.timestamp}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                  )}>
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

            {/* Error */}
            {error && (
              <div className="px-4 py-2 text-xs text-destructive bg-destructive/10 border-t border-destructive/20">
                {error}
                {error.includes('クレジット') && (
                  <a href="/settings/billing" className="underline ml-1">クレジットを追加購入</a>
                )}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && sendMessage(input)}
                  placeholder="メッセージを入力..."
                  disabled={streaming}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                />
                <Button size="sm" onClick={() => sendMessage(input)} disabled={streaming || !input.trim()} className="min-h-[40px]">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

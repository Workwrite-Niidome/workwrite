'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, ArrowLeft, MessageCircle, Sparkles, Users, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type CompanionMessage, type TalkableCharacter, type ConversationSummary } from '@/lib/api';
import { consumeSSEStream } from '@/lib/use-ai-stream';
import { useAuth } from '@/lib/auth-context';

interface CharacterTalkChatProps {
  workId: string;
  episodeId?: string;
  initialCharacterId?: string;
  initialMessage?: string;
}

export function CharacterTalkChat({ workId, episodeId, initialCharacterId, initialMessage }: CharacterTalkChatProps) {
  const { isAuthenticated } = useAuth();
  const [phase, setPhase] = useState<'select' | 'chat'>('select');
  const [mode, setMode] = useState<'companion' | 'character'>('companion');
  const [selectedCharacter, setSelectedCharacter] = useState<TalkableCharacter | null>(null);
  const [characters, setCharacters] = useState<TalkableCharacter[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [useSonnet, setUseSonnet] = useState(false);
  const [credits, setCredits] = useState<{ total: number; monthly: number; purchased: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialHandled = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    Promise.all([
      api.getCharacterTalkCharacters(workId, episodeId).catch(() => ({ data: [] })),
      api.getAiStatus().catch(() => ({ data: { available: false, model: '', tier: undefined } })),
      api.getCharacterTalkConversations(workId).catch(() => ({ data: [] })),
    ]).then(([charsRes, statusRes, convsRes]) => {
      const chars = (charsRes as any).data || [];
      const charList: TalkableCharacter[] = Array.isArray(chars) ? chars : [];
      setCharacters(charList);

      const statusData = (statusRes as any).data || statusRes;
      if (statusData.tier?.credits) {
        setCredits(statusData.tier.credits);
      }

      const convs = (convsRes as any).data || [];
      setConversations(Array.isArray(convs) ? convs : []);

      // Auto-select character and set initial message from match card
      if (initialCharacterId && !initialHandled.current) {
        initialHandled.current = true;
        const targetChar = charList.find((c) => c.id === initialCharacterId);
        if (targetChar) {
          setSelectedCharacter(targetChar);
          setMode('character');
          setPhase('chat');
          if (initialMessage) {
            setInput(initialMessage);
          }
          // Load history
          api.getCharacterTalkHistory(workId, targetChar.id)
            .then((histRes) => {
              const raw = histRes as any;
              const msgs = raw?.data?.messages || raw?.messages || raw?.data || [];
              setMessages(Array.isArray(msgs) ? msgs : []);
            })
            .catch(() => {});
        }
      }
    }).finally(() => setLoading(false));
  }, [workId, isAuthenticated]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function getConversationCount(charId: string | null): number {
    const conv = conversations.find((c) =>
      charId ? c.characterId === charId : c.mode === 'companion'
    );
    return conv?.messageCount ?? 0;
  }

  async function selectCharacter(char: TalkableCharacter | null) {
    setSelectedCharacter(char);
    setMode(char ? 'character' : 'companion');
    setPhase('chat');
    setMessages([]);
    setError('');

    try {
      const histRes = await api.getCharacterTalkHistory(workId, char?.id);
      const raw = histRes as any;
      // API returns { data: { messages: [...] } } via TransformInterceptor
      const msgs = raw?.data?.messages || raw?.messages || raw?.data || [];
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch {
      // No history yet
    }
  }

  function goBack() {
    setPhase('select');
    setSelectedCharacter(null);
    setMessages([]);
    setError('');
    // Refresh conversations
    api.getCharacterTalkConversations(workId)
      .then((res) => {
        const convs = (res as any).data || [];
        setConversations(Array.isArray(convs) ? convs : []);
      })
      .catch(() => {});
  }

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
      const response = await api.fetchSSE(`/ai/character-talk/${workId}/chat`, {
        message: userMsg.content,
        mode,
        characterId: selectedCharacter?.id,
        useSonnet,
      });

      await consumeSSEStream(response, (parsed) => {
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
    await api.clearCharacterTalkConversation(workId, selectedCharacter?.id).catch(() => {});
    setMessages([]);
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-4">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">ログインが必要です</p>
          <p className="text-xs text-muted-foreground mt-1">キャラクタートークを利用するにはログインしてください。</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-12 w-2/3 ml-auto" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // Selection phase
  if (phase === 'select') {
    const companionCount = getConversationCount(null);

    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold">キャラクタートーク</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Beta</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">登場人物と直接会話しよう</p>
          {credits && (
            <p className="text-xs text-muted-foreground mt-1">
              1cr/回 | 残高: {credits.total}cr
            </p>
          )}
        </div>

        <div className="flex-1 p-4 space-y-3">
          {/* Companion option */}
          <button
            onClick={() => selectCharacter(null)}
            className="w-full text-left border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">コンパニオン</span>
                  {companionCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-5">
                      <MessageCircle className="h-3 w-3 mr-0.5" />
                      {companionCount}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">作品について語る</p>
              </div>
            </div>
          </button>

          {/* Character cards */}
          {characters.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="h-6 w-6 mx-auto mb-2 animate-pulse" />
              <p className="text-xs">登場人物を抽出中</p>
              <p className="text-[10px] mt-1">完了までお待ちください</p>
            </div>
          )}
          {characters.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                登場人物
              </p>
              <div className="grid grid-cols-1 gap-2">
                {characters.map((char) => {
                  const count = getConversationCount(char.id);
                  return (
                    <button
                      key={char.id}
                      onClick={() => selectCharacter(char)}
                      className="w-full text-left border border-border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold">{char.name[0]}</span>
                        </div>
                        <span className="text-sm font-medium truncate flex-1 min-w-0">{char.name}</span>
                        {count > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                            <MessageCircle className="h-3 w-3 mr-0.5" />
                            {count}
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Chat phase
  const chatTitle = selectedCharacter ? selectedCharacter.name : 'コンパニオン';
  const costPerMessage = useSonnet ? 2 : 1;

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={goBack} className="h-8 w-8 shrink-0" title="戻る">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <p className="text-sm font-medium">{chatTitle}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClear} className="h-8 w-8 shrink-0" title="会話をクリア">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-1 ml-10">
          <button
            onClick={() => setUseSonnet(false)}
            className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${!useSonnet ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            少し話してみる
          </button>
          <button
            onClick={() => setUseSonnet(true)}
            className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${useSonnet ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            じっくり会話する
          </button>
          {credits && (
            <span className="text-[11px] text-muted-foreground">
              残{credits.total}cr
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            {selectedCharacter
              ? `${selectedCharacter.name}に話しかけてみましょう`
              : 'この作品について質問してみましょう'}
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

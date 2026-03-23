'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, ArrowLeft, MessageCircle, Sparkles, Crown, Users, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type CompanionMessage, type TalkableCharacter, type ConversationSummary } from '@/lib/api';
import { consumeSSEStream } from '@/lib/use-ai-stream';
import { useAuth } from '@/lib/auth-context';

interface CharacterTalkChatProps {
  workId: string;
}

export function CharacterTalkChat({ workId }: CharacterTalkChatProps) {
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
  const [useOpus, setUseOpus] = useState(false);
  const [credits, setCredits] = useState<{ total: number; monthly: number; purchased: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    Promise.all([
      api.getCharacterTalkCharacters(workId).catch(() => ({ data: [] })),
      api.getAiStatus().catch(() => ({ data: { available: false, model: '', tier: undefined } })),
      api.getCharacterTalkConversations(workId).catch(() => ({ data: [] })),
    ]).then(([charsRes, statusRes, convsRes]) => {
      const chars = (charsRes as any).data || [];
      setCharacters(Array.isArray(chars) ? chars : []);

      const statusData = (statusRes as any).data || statusRes;
      if (statusData.tier?.credits) {
        setCredits(statusData.tier.credits);
      }

      const convs = (convsRes as any).data || [];
      setConversations(Array.isArray(convs) ? convs : []);
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

  function getModelLabel(): { label: string; color: string } {
    if (useOpus) return { label: 'Opus', color: 'bg-purple-500 text-white' };
    // Default model depends on plan; show Sonnet as default upgraded, Haiku for free
    if (credits && credits.total > 0) return { label: 'Sonnet', color: 'bg-blue-500 text-white' };
    return { label: 'Haiku', color: 'bg-gray-500 text-white' };
  }

  async function selectCharacter(char: TalkableCharacter | null) {
    setSelectedCharacter(char);
    setMode(char ? 'character' : 'companion');
    setPhase('chat');
    setMessages([]);
    setError('');

    try {
      const histRes = await api.getCharacterTalkHistory(workId, char?.id);
      const msgs = (histRes as any).data || (histRes as any).messages || [];
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
        useOpus,
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
          <h2 className="text-base font-bold">キャラクタートーク</h2>
          <p className="text-xs text-muted-foreground mt-1">登場人物と直接会話しよう</p>
          {credits && (
            <p className="text-xs text-muted-foreground mt-1">
              クレジット残高: {credits.total}
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
              <p className="text-xs">登場人物を準備中...</p>
              <p className="text-[10px] mt-1">エピソードを読むとキャラクターが表示されます</p>
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
                      className="w-full text-left border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold">{char.name[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{char.name}</span>
                            <span className="text-xs text-muted-foreground">({char.role})</span>
                            {count > 0 && (
                              <Badge variant="secondary" className="text-[10px] h-5">
                                <MessageCircle className="h-3 w-3 mr-0.5" />
                                {count}
                              </Badge>
                            )}
                          </div>
                          {char.personality && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{char.personality}</p>
                          )}
                        </div>
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
  const modelInfo = getModelLabel();
  const chatTitle = selectedCharacter ? selectedCharacter.name : 'コンパニオン';

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goBack} className="h-8 w-8" title="戻る">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{chatTitle}</p>
              <Badge className={`text-[10px] h-5 ${modelInfo.color}`}>
                {modelInfo.label}
              </Badge>
            </div>
            {selectedCharacter && (
              <p className="text-xs text-muted-foreground">{selectedCharacter.role}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {credits && credits.purchased > 0 && (
            <Button
              variant={useOpus ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setUseOpus(!useOpus)}
              title="Opusモードを切り替え"
            >
              <Crown className="h-3 w-3" />
              Opus
            </Button>
          )}
          {credits && (
            <span className="text-xs text-muted-foreground ml-1">
              残{credits.total}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={handleClear} className="h-8 w-8" title="会話をクリア">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
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

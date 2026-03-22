'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Send, Crown, Sparkles, Check, Loader2, ChevronRight,
  Edit3, Bot, ArrowLeft, Plus, Trash2, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { consumeSSEStream } from '@/lib/use-ai-stream';
import { cn } from '@/lib/utils';

interface DesignData {
  genre?: string;
  theme?: string;
  afterReading?: string;
  protagonist?: { name: string; role: string; personality: string; speechStyle: string };
  characters?: { name: string; role: string; personality: string; speechStyle: string }[];
  worldBuilding?: string;
  conflict?: string;
  plotOutline?: string;
  tone?: string;
  episodeCount?: number;
  charCountPerEpisode?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const CHECKLIST_ITEMS = [
  { key: 'genre', label: 'ジャンル・舞台' },
  { key: 'theme', label: 'テーマ・コアメッセージ' },
  { key: 'afterReading', label: '読者に届けたい感情・読後感' },
  { key: 'protagonist', label: '主人公' },
  { key: 'characters', label: '主要キャラクター（2人以上）' },
  { key: 'worldBuilding', label: '世界観・ルール' },
  { key: 'conflict', label: 'コンフリクト（中心的な葛藤）' },
  { key: 'plotOutline', label: 'プロット概要' },
  { key: 'tone', label: 'トーン・文体' },
  { key: 'episodeCount', label: '話数・各話の文字数目安' },
] as const;

/** Normalize AI's __DESIGN_UPDATE__ output to match our DesignData shape */
function normalizeDesignUpdate(raw: any): Partial<DesignData> {
  const d: Partial<DesignData> = {};
  const str = (v: any) => v && v !== 'null' ? String(v) : undefined;
  if (str(raw.genre_setting || raw.genre)) d.genre = str(raw.genre_setting || raw.genre);
  if (str(raw.theme)) d.theme = str(raw.theme);
  if (str(raw.emotion || raw.afterReading)) d.afterReading = str(raw.emotion || raw.afterReading);
  if (raw.protagonist && raw.protagonist !== 'null') {
    d.protagonist = typeof raw.protagonist === 'string'
      ? { name: raw.protagonist, role: '', personality: '', speechStyle: '' }
      : raw.protagonist;
  }
  if (raw.characters && raw.characters !== 'null') {
    if (Array.isArray(raw.characters)) {
      d.characters = raw.characters;
    } else if (typeof raw.characters === 'string') {
      // AI returned characters as a text description — store as-is for checklist display
      d.characters = raw.characters as any;
    }
  }
  if (str(raw.world || raw.worldBuilding)) d.worldBuilding = str(raw.world || raw.worldBuilding);
  if (str(raw.conflict)) d.conflict = str(raw.conflict);
  if (str(raw.plot || raw.plotOutline)) d.plotOutline = str(raw.plot || raw.plotOutline);
  if (str(raw.tone)) d.tone = str(raw.tone);
  const scope = raw.scope || raw.episodeCount;
  if (scope && scope !== 'null') {
    const scopeStr = String(scope);
    // Extract episode count and char count from strings like "10話 × 3000字" or "8話"
    const epMatch = scopeStr.match(/(\d+)\s*話/);
    const charMatch = scopeStr.match(/(\d+)\s*字/);
    if (epMatch) d.episodeCount = parseInt(epMatch[1], 10);
    if (charMatch) d.charCountPerEpisode = parseInt(charMatch[1], 10);
    // Fallback: just a number
    if (!epMatch && !charMatch) {
      const numMatch = scopeStr.match(/(\d+)/);
      if (numMatch) d.episodeCount = parseInt(numMatch[1], 10);
    }
  }
  return d;
}

function isChecklistItemFilled(design: DesignData, key: string): boolean {
  switch (key) {
    case 'genre': return !!design.genre;
    case 'theme': return !!design.theme;
    case 'afterReading': return !!design.afterReading;
    case 'protagonist': return !!(typeof design.protagonist === 'object' ? design.protagonist?.name : design.protagonist);
    case 'characters': return Array.isArray(design.characters) ? design.characters.length >= 2 : !!design.characters;
    case 'worldBuilding': return !!design.worldBuilding;
    case 'conflict': return !!design.conflict;
    case 'plotOutline': return !!design.plotOutline;
    case 'tone': return !!design.tone;
    case 'episodeCount': return !!design.episodeCount;
    default: return false;
  }
}

function EditorModeDesignContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeWorkId = searchParams.get('resume');
  const [phase, setPhase] = useState<'designing' | 'reviewing'>('designing');
  const [aiMode, setAiMode] = useState<'normal' | 'premium'>('normal');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [design, setDesign] = useState<DesignData>({});
  const [creditsConsumed, setCreditConsumed] = useState(0);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [workId, setWorkId] = useState<string | null>(resumeWorkId);
  const [error, setError] = useState<string | null>(null);
  const [reviseField, setReviseField] = useState<string | null>(null);
  const [reviseInstruction, setReviseInstruction] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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
            // Try multiple patterns
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
                  // Only merge non-null values
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

  // Auto-scroll chat (only within the chat container, not the whole page)
  const chatContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const filledCount = CHECKLIST_ITEMS.filter(item => isChecklistItemFilled(design, item.key)).length;
  const allFilled = filledCount === CHECKLIST_ITEMS.length;

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
        body: JSON.stringify({ message, aiMode }),
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
        }
        if (parsed.creditsConsumed !== undefined) {
          setCreditConsumed(parsed.creditsConsumed);
        }
        if (parsed.creditsRemaining !== undefined) {
          setCreditsRemaining(parsed.creditsRemaining);
        }
        if (parsed.designUpdate) {
          setDesign(prev => ({ ...prev, ...normalizeDesignUpdate(parsed.designUpdate) }));
        }
      });

      // Check for __DESIGN_UPDATE__ block in accumulated text (multiple formats)
      // Format 1: __DESIGN_UPDATE__ ```json {...} ```
      // Format 2: __DESIGN_UPDATE__ {...} __END_UPDATE__
      // Format 3: __DESIGN_UPDATE__\n{...}\n__END_UPDATE__
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
            const designUpdate = normalizeDesignUpdate(raw);
            setDesign(prev => ({ ...prev, ...designUpdate }));
            // Remove the entire design update block from displayed message
            const cleanContent = accumulated
              .replace(/__DESIGN_UPDATE__[\s\S]*?(__END_UPDATE__|$)/, '')
              .replace(/\s*---\s*$/, '')
              .trim();
            setMessages([...newMessages, { role: 'assistant', content: cleanContent }]);
          } catch {
            // Failed to parse, try removing the raw block anyway
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
    }
  }, [inputValue, isStreaming, messages, aiMode, workId]);

  const handleReviseSection = async (field: string, instruction: string) => {
    if (!instruction.trim() || isRevising) return;
    setIsRevising(true);
    setError(null);

    try {
      const token = api.getToken();
      const chatUrl = await api.editorModeChat(workId || '_new');

      const res = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: `${field}セクションを修正してください: ${instruction}`,
          aiMode,
          workId,
          reviseField: field,
        }),
      });

      if (!res.ok) throw new Error(`Error: ${res.status}`);

      let accumulated = '';
      await consumeSSEStream(res, (parsed) => {
        if (parsed.text) accumulated += parsed.text;
        if (parsed.designUpdate) {
          setDesign(prev => ({ ...prev, ...normalizeDesignUpdate(parsed.designUpdate) }));
        }
        if (parsed.creditsConsumed !== undefined) setCreditConsumed(parsed.creditsConsumed);
        if (parsed.creditsRemaining !== undefined) setCreditsRemaining(parsed.creditsRemaining);
      });

      const designMatch = accumulated.match(/__DESIGN_UPDATE__\s*```json\s*([\s\S]*?)```/);
      if (designMatch) {
        try {
          setDesign(prev => ({ ...prev, ...normalizeDesignUpdate(JSON.parse(designMatch[1])) }));
        } catch { /* ignore */ }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRevising(false);
      setReviseField(null);
      setReviseInstruction('');
    }
  };

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

  if (phase === 'reviewing') {
    return (
      <div className="px-4 py-8 max-w-4xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setPhase('designing')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> 対話に戻る
          </Button>
          <div className="flex items-center gap-3 text-sm">
            <ModeSelector aiMode={aiMode} onModeChange={setAiMode} />
            <CreditDisplay consumed={creditsConsumed} remaining={creditsRemaining} />
          </div>
        </div>

        <h1 className="text-xl font-bold">設計レビュー</h1>
        <p className="text-sm text-muted-foreground">設計内容を確認・編集してください。各セクションは直接編集するか、AIに修正指示を出せます。</p>

        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
        )}

        {/* Editable sections */}
        <div className="space-y-4">
          <EditableSection
            label="ジャンル・舞台"
            value={design.genre || ''}
            onChange={(v) => setDesign(prev => ({ ...prev, genre: v }))}
            onRevise={(instruction) => handleReviseSection('genre', instruction)}
            reviseField={reviseField}
            setReviseField={setReviseField}
            reviseInstruction={reviseInstruction}
            setReviseInstruction={setReviseInstruction}
            isRevising={isRevising}
            fieldKey="genre"
          />

          <EditableSection
            label="テーマ"
            value={design.theme || ''}
            onChange={(v) => setDesign(prev => ({ ...prev, theme: v }))}
            onRevise={(instruction) => handleReviseSection('theme', instruction)}
            reviseField={reviseField}
            setReviseField={setReviseField}
            reviseInstruction={reviseInstruction}
            setReviseInstruction={setReviseInstruction}
            isRevising={isRevising}
            fieldKey="theme"
            multiline
          />

          <EditableSection
            label="読後感"
            value={design.afterReading || ''}
            onChange={(v) => setDesign(prev => ({ ...prev, afterReading: v }))}
            onRevise={(instruction) => handleReviseSection('afterReading', instruction)}
            reviseField={reviseField}
            setReviseField={setReviseField}
            reviseInstruction={reviseInstruction}
            setReviseInstruction={setReviseInstruction}
            isRevising={isRevising}
            fieldKey="afterReading"
            multiline
          />

          {/* Characters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                キャラクター
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setDesign(prev => ({
                    ...prev,
                    characters: [...(prev.characters || []), { name: '', role: '', personality: '', speechStyle: '' }],
                  }))}
                >
                  <Plus className="h-3 w-3" /> 追加
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Protagonist */}
              {design.protagonist && (
                <CharacterCard
                  character={design.protagonist}
                  label="主人公"
                  onChange={(updated) => setDesign(prev => ({ ...prev, protagonist: updated }))}
                />
              )}
              {/* Other characters */}
              {typeof design.characters === 'string' && (
                <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground">{design.characters}</div>
              )}
              {Array.isArray(design.characters) && design.characters.map((char, idx) => (
                <CharacterCard
                  key={idx}
                  character={char}
                  label={`キャラクター ${idx + 1}`}
                  onChange={(updated) => {
                    const newChars = [...(design.characters || [])];
                    newChars[idx] = updated;
                    setDesign(prev => ({ ...prev, characters: newChars }));
                  }}
                  onDelete={() => {
                    const newChars = (design.characters || []).filter((_, i) => i !== idx);
                    setDesign(prev => ({ ...prev, characters: newChars }));
                  }}
                />
              ))}
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setReviseField('characters');
                    setReviseInstruction('');
                  }}
                >
                  <Bot className="h-3 w-3 mr-1" /> AIに修正させる
                </Button>
              </div>
              {reviseField === 'characters' && (
                <ReviseInput
                  instruction={reviseInstruction}
                  setInstruction={setReviseInstruction}
                  onSubmit={() => handleReviseSection('characters', reviseInstruction)}
                  onCancel={() => setReviseField(null)}
                  isRevising={isRevising}
                />
              )}
            </CardContent>
          </Card>

          <EditableSection
            label="世界観"
            value={design.worldBuilding || ''}
            onChange={(v) => setDesign(prev => ({ ...prev, worldBuilding: v }))}
            onRevise={(instruction) => handleReviseSection('worldBuilding', instruction)}
            reviseField={reviseField}
            setReviseField={setReviseField}
            reviseInstruction={reviseInstruction}
            setReviseInstruction={setReviseInstruction}
            isRevising={isRevising}
            fieldKey="worldBuilding"
            multiline
          />

          <EditableSection
            label="葛藤"
            value={design.conflict || ''}
            onChange={(v) => setDesign(prev => ({ ...prev, conflict: v }))}
            onRevise={(instruction) => handleReviseSection('conflict', instruction)}
            reviseField={reviseField}
            setReviseField={setReviseField}
            reviseInstruction={reviseInstruction}
            setReviseInstruction={setReviseInstruction}
            isRevising={isRevising}
            fieldKey="conflict"
            multiline
          />

          <EditableSection
            label="プロット概要"
            value={design.plotOutline || ''}
            onChange={(v) => setDesign(prev => ({ ...prev, plotOutline: v }))}
            onRevise={(instruction) => handleReviseSection('plotOutline', instruction)}
            reviseField={reviseField}
            setReviseField={setReviseField}
            reviseInstruction={reviseInstruction}
            setReviseInstruction={setReviseInstruction}
            isRevising={isRevising}
            fieldKey="plotOutline"
            multiline
          />

          <EditableSection
            label="トーン"
            value={design.tone || ''}
            onChange={(v) => setDesign(prev => ({ ...prev, tone: v }))}
            onRevise={(instruction) => handleReviseSection('tone', instruction)}
            reviseField={reviseField}
            setReviseField={setReviseField}
            reviseInstruction={reviseInstruction}
            setReviseInstruction={setReviseInstruction}
            isRevising={isRevising}
            fieldKey="tone"
            multiline
          />

          {/* Episode count + char count */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">話数</label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={design.episodeCount || ''}
                    onChange={(e) => setDesign(prev => ({ ...prev, episodeCount: Number(e.target.value) || undefined }))}
                    placeholder="例: 10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">文字数目安（1話あたり）</label>
                  <Input
                    type="number"
                    min={500}
                    max={20000}
                    step={500}
                    value={design.charCountPerEpisode || ''}
                    onChange={(e) => setDesign(prev => ({ ...prev, charCountPerEpisode: Number(e.target.value) || undefined }))}
                    placeholder="例: 3000"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Credit estimate */}
        {design.episodeCount && design.charCountPerEpisode && (
          <Card className="border-indigo-400/30 bg-indigo-50/10 dark:bg-indigo-950/10">
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium mb-2">推定クレジット消費</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">通常モード（Sonnet）</p>
                  <p className="font-bold">{design.episodeCount} x 1 = {design.episodeCount}cr</p>
                </div>
                <div>
                  <p className="text-muted-foreground">高精度モード（Opus）</p>
                  <p className="font-bold">{design.episodeCount} x 5 = {design.episodeCount * 5}cr</p>
                </div>
              </div>
              {creditsRemaining !== null && (
                <p className="text-sm mt-2">
                  残りクレジット: <span className="font-bold">{creditsRemaining}cr</span>
                  {creditsRemaining < (aiMode === 'premium' ? design.episodeCount * 5 : design.episodeCount) && (
                    <span className="text-destructive ml-2">
                      クレジットが不足しています。
                      <a href="/settings/billing" className="underline ml-1">追加購入</a>
                    </span>
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Finalize button */}
        <div className="flex justify-end">
          <Button
            onClick={handleFinalize}
            disabled={!design.episodeCount || !design.charCountPerEpisode || finalizing}
            className="gap-2"
          >
            {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
            設計を確定して第1話を生成
          </Button>
        </div>
      </div>
    );
  }

  // Phase 1: Design Chat
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

        {/* Right: Checklist */}
        <div className="lg:w-80 flex-shrink-0 border-t lg:border-t-0 overflow-y-auto p-4 space-y-4">
          <div>
            <h2 className="text-sm font-medium mb-1">設計チェックリスト</h2>
            <p className="text-xs text-muted-foreground mb-3">{filledCount} / {CHECKLIST_ITEMS.length} 完了</p>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mb-4">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${(filledCount / CHECKLIST_ITEMS.length) * 100}%` }}
              />
            </div>
            <ChecklistWithPreview design={design} />
          </div>

          {/* Design preview */}
          {filledCount > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">設計プレビュー</h3>
              {design.genre && (
                <div className="text-xs"><span className="font-medium">ジャンル:</span> {design.genre}</div>
              )}
              {design.theme && (
                <div className="text-xs"><span className="font-medium">テーマ:</span> {design.theme}</div>
              )}
              {design.protagonist?.name && (
                <div className="text-xs"><span className="font-medium">主人公:</span> {design.protagonist.name}</div>
              )}
              {design.characters && (
                <div className="text-xs">
                  <span className="font-medium">キャラ:</span>{' '}
                  {typeof design.characters === 'string' ? design.characters : Array.isArray(design.characters) ? design.characters.map((c: any) => c.name).filter(Boolean).join(', ') : ''}
                </div>
              )}
              {design.tone && (
                <div className="text-xs"><span className="font-medium">トーン:</span> {design.tone}</div>
              )}
              {design.episodeCount && (
                <div className="text-xs"><span className="font-medium">話数:</span> {design.episodeCount}話</div>
              )}
            </div>
          )}

          {/* Transition button */}
          {allFilled && (
            <Button
              onClick={() => setPhase('reviewing')}
              className="w-full gap-2 bg-indigo-500 hover:bg-indigo-600"
            >
              設計完了 → レビューへ
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
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

function EditableSection({
  label,
  value,
  onChange,
  onRevise,
  reviseField,
  setReviseField,
  reviseInstruction,
  setReviseInstruction,
  isRevising,
  fieldKey,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onRevise: (instruction: string) => void;
  reviseField: string | null;
  setReviseField: (f: string | null) => void;
  reviseInstruction: string;
  setReviseInstruction: (v: string) => void;
  isRevising: boolean;
  fieldKey: string;
  multiline?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{label}</label>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => {
              setReviseField(fieldKey);
              setReviseInstruction('');
            }}
          >
            <Bot className="h-3 w-3 mr-1" /> AIに修正させる
          </Button>
        </div>
        {multiline ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="text-sm"
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-sm"
          />
        )}
        {reviseField === fieldKey && (
          <ReviseInput
            instruction={reviseInstruction}
            setInstruction={setReviseInstruction}
            onSubmit={() => onRevise(reviseInstruction)}
            onCancel={() => setReviseField(null)}
            isRevising={isRevising}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ReviseInput({
  instruction,
  setInstruction,
  onSubmit,
  onCancel,
  isRevising,
}: {
  instruction: string;
  setInstruction: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isRevising: boolean;
}) {
  return (
    <div className="flex gap-2 items-end border-t border-border/50 pt-2">
      <Textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="修正指示を入力..."
        rows={2}
        className="flex-1 text-xs resize-none"
      />
      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={!instruction.trim() || isRevising}
          className="h-7 text-xs"
        >
          {isRevising ? <Loader2 className="h-3 w-3 animate-spin" /> : '送信'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-7 text-xs"
        >
          キャンセル
        </Button>
      </div>
    </div>
  );
}

function CharacterCard({
  character,
  label,
  onChange,
  onDelete,
}: {
  character: { name: string; role: string; personality: string; speechStyle: string };
  label: string;
  onChange: (updated: { name: string; role: string; personality: string; speechStyle: string }) => void;
  onDelete?: () => void;
}) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {onDelete && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">名前</label>
          <Input
            value={character.name}
            onChange={(e) => onChange({ ...character, name: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">役割</label>
          <Input
            value={character.role}
            onChange={(e) => onChange({ ...character, role: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">性格</label>
          <Input
            value={character.personality}
            onChange={(e) => onChange({ ...character, personality: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">口調</label>
          <Input
            value={character.speechStyle}
            onChange={(e) => onChange({ ...character, speechStyle: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
      </div>
    </div>
  );
}


function getDesignValueForKey(design: DesignData, key: string): string | null {
  switch (key) {
    case 'genre': return design.genre || null;
    case 'theme': return design.theme || null;
    case 'afterReading': return design.afterReading || null;
    case 'protagonist': {
      const p = design.protagonist;
      if (typeof p === 'string') return p;
      return p?.name ? `${p.name}（${p.role || ''}）— ${p.personality || ''}` : null;
    }
    case 'characters': {
      const chars = design.characters;
      if (!chars) return null;
      if (typeof chars === 'string') return chars;
      if (!Array.isArray(chars) || chars.length === 0) return null;
      return chars.map((c: any) => typeof c === 'string' ? c : `${c.name}（${c.role || ''}）`).join('、');
    }
    case 'worldBuilding': return design.worldBuilding || null;
    case 'conflict': return design.conflict || null;
    case 'plotOutline': return design.plotOutline || null;
    case 'tone': return design.tone || null;
    case 'episodeCount': {
      if (!design.episodeCount) return null;
      return `${design.episodeCount}話 × ${design.charCountPerEpisode || '?'}字`;
    }
    default: return null;
  }
}

function ChecklistWithPreview({ design }: { design: DesignData }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  return (
    <ul className="space-y-1">
      {CHECKLIST_ITEMS.map((item) => {
        const filled = isChecklistItemFilled(design, item.key);
        const value = getDesignValueForKey(design, item.key);
        const isExpanded = expandedKey === item.key;

        return (
          <li key={item.key}>
            <button
              onClick={() => filled && setExpandedKey(isExpanded ? null : item.key)}
              className={cn(
                'w-full flex items-center gap-2 text-sm py-1.5 px-2 rounded-md transition-colors text-left',
                filled ? 'hover:bg-muted cursor-pointer' : 'cursor-default',
                isExpanded && 'bg-muted',
              )}
            >
              <div className={cn(
                'h-5 w-5 rounded-full flex items-center justify-center border transition-colors shrink-0',
                filled ? 'bg-green-500 border-green-500 text-white' : 'border-border',
              )}>
                {filled && <Check className="h-3 w-3" />}
              </div>
              <span className={cn('flex-1', filled ? 'text-foreground' : 'text-muted-foreground')}>
                {item.label}
              </span>
              {filled && (
                <ChevronRight className={cn(
                  'h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0',
                  isExpanded && 'rotate-90',
                )} />
              )}
            </button>
            {isExpanded && value && (
              <div className="ml-9 mr-2 mb-2 p-2 rounded bg-muted/50 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap animate-in fade-in slide-in-from-top-1 duration-200">
                {value}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function EditorModeDesignPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[70vh]" />}>
      <EditorModeDesignContent />
    </Suspense>
  );
}

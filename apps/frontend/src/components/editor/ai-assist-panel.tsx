'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TemplateSelector, type PromptTemplate } from './template-selector';
import { useAiStream } from '@/lib/use-ai-stream';
import { api } from '@/lib/api';
import { X, Copy, ArrowDownToLine, StopCircle, Replace, Wand2, BookCheck, PenLine, Crown, Sparkles, FileText, SlidersHorizontal, Send, UserPlus, Check, Loader2 } from 'lucide-react';

interface AiAssistPanelProps {
  workId: string;
  currentContent: string;
  currentTitle?: string;
  selectedText?: string;
  onInsert: (text: string) => void;
  onReplace?: (text: string) => void;
  onClose: () => void;
}

interface HistoryItem {
  slug: string;
  result: string;
  timestamp: Date;
}

export function AiAssistPanel({ workId, currentContent, currentTitle, selectedText, onInsert, onReplace, onClose }: AiAssistPanelProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [tier, setTier] = useState<{
    plan: string; canUseAi: boolean; canUseThinking: boolean; canUseOpus?: boolean; remainingFreeUses: number | null;
  } | null>(null);
  const [premiumMode, setPremiumMode] = useState(false);
  const [charCount, setCharCount] = useState(1000);
  const [customPrompt, setCustomPrompt] = useState('');
  const [freePrompt, setFreePrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [creationPlan, setCreationPlan] = useState<any>(null);
  const [storySummary, setStorySummary] = useState<any>(null);
  const [episodes, setEpisodes] = useState<{ title: string; content: string }[]>([]);
  const [structuredContext, setStructuredContext] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [newChars, setNewChars] = useState<{ name: string; role: string; gender: string; personality: string; speechStyle: string; description: string }[] | null>(null);
  const [savedChars, setSavedChars] = useState<Set<string>>(new Set());
  const { result, isStreaming, error, generate, abort, reset } = useAiStream();

  useEffect(() => {
    api.getAiStatus()
      .then((res) => {
        setAvailable(res.data.available);
        if (res.data.tier) setTier(res.data.tier);
      })
      .catch(() => setAvailable(false));
    api.getPromptTemplates()
      .then((res) => setTemplates(res.data))
      .catch(() => {});
    if (workId) {
      // Load creation plan for context (includes storySummary)
      api.getCreationPlan(workId)
        .then((res) => {
          if (res.data) {
            setCreationPlan(res.data);
            if (res.data.storySummary) setStorySummary(res.data.storySummary);
          }
        })
        .catch(() => {});
      // Load structured context from StoryCharacter + StoryArc tables
      api.getStoryContext(workId)
        .then((res) => { if (res) setStructuredContext(typeof res === 'string' ? res : (res as any).data || null); })
        .catch(() => {});
      // Load episode titles as fallback (if no story summary)
      api.getEpisodes(workId)
        .then((res) => {
          if (res.data) {
            const sorted = [...res.data].sort((a: any, b: any) => a.orderIndex - b.orderIndex);
            setEpisodes(sorted.map((ep: any) => ({
              title: ep.title,
              content: '',
            })));
          }
        })
        .catch(() => {});
    }
  }, [workId]);

  // Save to history when generation completes
  useEffect(() => {
    if (!isStreaming && result && result.length > 0) {
      setHistory((prev) => [
        { slug: 'last', result, timestamp: new Date() },
        ...prev.slice(0, 4),
      ]);
    }
  }, [isStreaming, result]);

  function handleCopy() {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleExtractCharacters() {
    if (!result) return;
    setExtracting(true);
    setNewChars(null);
    try {
      const existing = (creationPlan?.characters || []).map((c: any) => ({ name: c.name, role: c.role }));
      const res = await api.extractCharacters(result, existing);
      setNewChars(res.characters || []);
    } catch {
      setNewChars([]);
    } finally {
      setExtracting(false);
    }
  }

  async function handleSaveCharacter(char: { name: string; role: string; gender: string; personality: string; speechStyle: string; description: string }) {
    if (!workId || savedChars.has(char.name)) return;
    const existingChars = creationPlan?.characters || [];
    const newChar = {
      name: char.name,
      role: char.role,
      description: char.description,
      personality: char.personality,
      speechStyle: char.speechStyle,
      gender: char.gender,
      aiSuggested: true,
    };
    const updatedChars = [...existingChars, newChar];
    try {
      await api.saveCreationPlan(workId, { characters: updatedChars });
      setCreationPlan((prev: any) => ({ ...prev, characters: updatedChars }));
      setSavedChars((prev) => new Set([...prev, char.name]));
    } catch { /* ignore */ }
  }

  function buildContextVars(): Record<string, string> {
    const vars: Record<string, string> = { content: selectedText || currentContent };
    // Pass workId so backend can auto-inject structural context
    if (workId) vars.workId = workId;
    const contextParts: string[] = [];

    // Current chapter info
    if (currentTitle) {
      contextParts.push(`現在執筆中の章: 「${currentTitle}」`);
    }
    if (currentContent && currentContent.length > 100) {
      const summary = currentContent.slice(0, 300).replace(/\n+/g, ' ');
      contextParts.push(`現在の原稿冒頭: ${summary}...`);
    }

    // Structured context from StoryCharacter + StoryArc tables (characters + arc)
    if (structuredContext) {
      contextParts.push(structuredContext);
    } else if (creationPlan?.characters?.length > 0) {
      // Fallback: character sheets from creation plan JSON
      const charSheets = creationPlan.characters.map((c: any) => {
        const lines = [`■ ${c.name}${c.role ? `（${c.role}）` : ''}`];
        if (c.description) lines.push(`  概要: ${c.description}`);
        if (c.personality) lines.push(`  性格: ${c.personality}`);
        if (c.firstPerson) lines.push(`  一人称: ${c.firstPerson}`);
        if (c.speechStyle) lines.push(`  口調: ${c.speechStyle}`);
        if (c.gender) lines.push(`  性別: ${c.gender}`);
        if (c.background) lines.push(`  背景: ${c.background}`);
        if (c.motivation) lines.push(`  動機: ${c.motivation}`);
        return lines.join('\n');
      }).join('\n\n');
      contextParts.push(`【登場キャラクター設定（厳守）】\n${charSheets}`);
    }

    // Plot and chapter outline (always from creation plan, regardless of structuredContext)
    if (creationPlan?.plotOutline) {
      const plot = typeof creationPlan.plotOutline === 'string'
        ? creationPlan.plotOutline
        : creationPlan.plotOutline.text || '';
      if (plot) contextParts.push(`【プロット】\n${plot}`);
    }
    if (creationPlan?.chapterOutline?.length > 0) {
      const chapterSummary = creationPlan.chapterOutline
        .map((ch: any, i: number) => {
          const parts = [`第${i + 1}話「${ch.title}」`];
          if (ch.summary) parts.push(`: ${ch.summary}`);
          if (ch.emotionTarget) parts.push(` [感情: ${ch.emotionTarget}]`);
          if (ch.characters?.length > 0) parts.push(` [登場: ${ch.characters.join('、')}]`);
          return parts.join('');
        })
        .join('\n');
      contextParts.push(`【章立て】\n${chapterSummary}`);
    }

    // Emotion blueprint (always from creation plan)
    if (creationPlan?.emotionBlueprint) {
      const eb = creationPlan.emotionBlueprint;
      if (eb.coreMessage) contextParts.push(`テーマ: ${eb.coreMessage}`);
      if (eb.targetEmotions) contextParts.push(`読者に届けたい感情: ${eb.targetEmotions}`);
      if (eb.readerJourney) contextParts.push(`読者の旅路: ${eb.readerJourney}`);
    }

    // Use cached story summary if available (token-efficient)
    if (storySummary) {
      const parts: string[] = [];
      if (storySummary.overallSummary) parts.push(`【物語の流れ】\n${storySummary.overallSummary}`);
      if (storySummary.episodes?.length > 0) {
        // Always include all episode summaries for consistency
        const epText = storySummary.episodes.map((ep: any) => {
          let line = `「${ep.title}」: ${ep.summary}`;
          if (ep.keyEvents?.length) line += ` [${ep.keyEvents.join(', ')}]`;
          if (ep.endState) line += ` → ${ep.endState}`;
          return line;
        }).join('\n');
        parts.push(`【各話の要約】\n${epText}`);
      }
      if (storySummary.characters?.length > 0) {
        const charText = storySummary.characters.map((c: any) => {
          let line = `${c.name}: ${c.currentState}`;
          if (c.relationships) line += `（${c.relationships}）`;
          return line;
        }).join('\n');
        parts.push(`【キャラクター現況】\n${charText}`);
      }
      if (storySummary.openThreads?.length > 0) {
        parts.push(`【未解決の伏線・展開】\n${storySummary.openThreads.join('\n')}`);
      }
      if (storySummary.worldRules?.length > 0) {
        parts.push(`【世界観・ルール】\n${storySummary.worldRules.join('\n')}`);
      }
      if (storySummary.timeline) parts.push(`時間経過: ${storySummary.timeline}`);
      if (storySummary.tone) parts.push(`トーン: ${storySummary.tone}`);
      contextParts.push(parts.join('\n\n'));
    } else if (episodes.length > 0) {
      // Fallback: episode titles (summary not yet generated)
      const epList = episodes.map((ep, i) => `第${i + 1}話「${ep.title}」`).join('\n');
      contextParts.push(`【これまでの章（要約未生成 — タイトルのみ）】\n${epList}`);
    }

    if (contextParts.length > 0) {
      vars.context = contextParts.join('\n\n');
    }
    vars.char_count = String(charCount);
    if (customPrompt.trim()) {
      vars.custom_instruction = customPrompt.trim();
    }
    return vars;
  }

  function handleQuickAction(slug: string) {
    reset();
    generate(slug, buildContextVars(), premiumMode);
  }

  if (available === false || (tier && !tier.canUseAi)) {
    const isQuotaExhausted = tier && !tier.canUseAi;
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-sm font-medium">AI アシスト</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            {isQuotaExhausted ? (
              <>今週のAI使用回数の上限に達しました。<br />プランをアップグレードすると無制限にご利用いただけます。</>
            ) : (
              <>AI機能は現在利用できません。<br />管理者がAPIキーを設定するとご利用いただけます。</>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-medium">AI アシスト</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-8 space-y-3" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Tier info */}
        {tier && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {tier.plan === 'premium' && <><Crown className="inline h-3 w-3 text-amber-500 mr-1" />プレミアム</>}
              {tier.plan === 'standard' && <><Crown className="inline h-3 w-3 text-purple-500 mr-1" />スタンダード</>}
              {tier.plan === 'starter' && <><Sparkles className="inline h-3 w-3 text-blue-500 mr-1" />スターター</>}
              {tier.plan === 'free' && <>無料プラン（残り {tier.remainingFreeUses} 回/週）</>}
            </span>
            {tier.canUseThinking && (
              <button
                onClick={() => setPremiumMode(!premiumMode)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                  premiumMode
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600'
                    : 'border-border text-muted-foreground hover:border-amber-500/30'
                }`}
              >
                <Crown className="h-2.5 w-2.5" />
                {premiumMode
                  ? (tier.canUseOpus ? 'Opusモード ON' : 'じっくりモード ON')
                  : (tier.canUseOpus ? 'Opusモード' : 'じっくりモード')}
              </button>
            )}
          </div>
        )}

        {/* Context indicator */}
        {(creationPlan || episodes.length > 0) && (
          <div className="p-2 bg-muted/50 rounded-md border border-border">
            <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <BookCheck className="h-3.5 w-3.5 text-muted-foreground" /> コンテキスト読み込み済み
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {creationPlan?.emotionBlueprint?.coreMessage && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">テーマ</span>
              )}
              {creationPlan?.characters?.length > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">{creationPlan.characters.length}キャラ</span>
              )}
              {creationPlan?.plotOutline && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">プロット</span>
              )}
              {creationPlan?.chapterOutline?.length > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">{creationPlan.chapterOutline.length}章立て</span>
              )}
              {storySummary && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">
                  要約キャッシュ
                </span>
              )}
              {!storySummary && episodes.length > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">
                  {episodes.length}話（タイトルのみ）
                </span>
              )}
            </div>
          </div>
        )}

        {/* Selected text indicator */}
        {selectedText && (
          <div className="p-2 bg-primary/5 rounded-md border border-primary/20">
            <p className="text-xs font-medium text-primary flex items-center gap-1.5">
              <Replace className="h-3.5 w-3.5" /> 選択テキスト ({selectedText.length}文字)
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{selectedText.slice(0, 100)}{selectedText.length > 100 ? '...' : ''}</p>
          </div>
        )}

        {/* Quick actions */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">クイックアクション</p>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1"
              onClick={() => handleQuickAction('chapter-opening')}
              disabled={isStreaming}
            >
              <FileText className="h-3 w-3" /> 章の書き出し
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1"
              onClick={() => handleQuickAction('proofread')}
              disabled={isStreaming}
            >
              <BookCheck className="h-3 w-3" /> 校正
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1"
              onClick={() => handleQuickAction('continue-writing')}
              disabled={isStreaming}
            >
              <PenLine className="h-3 w-3" /> 続きを書く
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1"
              onClick={() => handleQuickAction('style-adjust')}
              disabled={isStreaming}
            >
              <Wand2 className="h-3 w-3" /> 文体調整
            </Button>
          </div>
        </div>

        {/* Character count */}
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <SlidersHorizontal className="h-3 w-3" /> 生成文字数: {charCount.toLocaleString()}字
          </p>
          <input
            type="range"
            min={100}
            max={5000}
            step={100}
            value={charCount}
            onChange={(e) => setCharCount(Number(e.target.value))}
            className="w-full h-1.5 accent-foreground"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>100</span>
            <span>5000</span>
          </div>
        </div>

        {/* Custom instruction */}
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">追加指示（任意）</p>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="例: 緊張感のある場面にして、主人公の心情を丁寧に描写して..."
            rows={2}
            className="w-full text-xs p-2 rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Free-form prompt */}
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Send className="h-3 w-3" /> AIに直接指示
          </p>
          <div className="flex gap-1.5">
            <textarea
              value={freePrompt}
              onChange={(e) => setFreePrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && freePrompt.trim() && !isStreaming) {
                  e.preventDefault();
                  const vars = buildContextVars();
                  vars.user_prompt = freePrompt.trim();
                  reset();
                  generate('free-prompt', vars, premiumMode);
                  setFreePrompt('');
                }
              }}
              placeholder="AIへの指示を入力... (Ctrl+Enter で送信)"
              rows={2}
              className="flex-1 text-xs p-2 rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              size="sm"
              variant="default"
              className="self-end h-8 px-2"
              disabled={!freePrompt.trim() || isStreaming}
              onClick={() => {
                const vars = buildContextVars();
                vars.user_prompt = freePrompt.trim();
                reset();
                generate('free-prompt', vars, premiumMode);
                setFreePrompt('');
              }}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Selected text preview */}
        {selectedText && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">選択テキスト</p>
            <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground line-clamp-3 italic">
              {selectedText}
            </div>
          </div>
        )}

        <TemplateSelector
          templates={templates}
          onGenerate={(slug, vars) => {
            reset();
            const contextVars = buildContextVars();
            generate(slug, { ...contextVars, ...vars }, premiumMode);
          }}
          isStreaming={isStreaming}
          currentContent={selectedText || currentContent}
        />

        {error && (
          <div className="p-2 text-xs text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {(result || isStreaming) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">AI応答</p>
              {isStreaming && (
                <button
                  onClick={abort}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <StopCircle className="h-3 w-3" /> 停止
                </button>
              )}
            </div>
            <div className="p-3 bg-secondary/50 rounded-md text-sm leading-relaxed whitespace-pre-wrap">
              {result}
              {isStreaming && <span className="inline-block w-1 h-4 bg-foreground animate-pulse ml-0.5" />}
            </div>
            {!isStreaming && result && (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => onInsert(result)} className="flex-1 text-xs">
                    <ArrowDownToLine className="h-3 w-3 mr-1" /> 挿入
                  </Button>
                  {selectedText && onReplace && (
                    <Button size="sm" variant="outline" onClick={() => onReplace(result)} className="flex-1 text-xs">
                      <Replace className="h-3 w-3 mr-1" /> 置換
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={handleCopy} className="flex-1 text-xs">
                    <Copy className="h-3 w-3 mr-1" /> {copied ? 'コピー済み' : 'コピー'}
                  </Button>
                </div>

                {/* Extract new characters */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleExtractCharacters}
                  disabled={extracting}
                  className="w-full text-xs text-muted-foreground gap-1"
                >
                  {extracting ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                  {extracting ? '検出中...' : '新キャラクター・設定を検出'}
                </Button>

                {newChars !== null && newChars.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center">新しいキャラクターは検出されませんでした</p>
                )}

                {newChars && newChars.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">検出されたキャラクター:</p>
                    {newChars.map((ch) => {
                      const isSaved = savedChars.has(ch.name);
                      return (
                        <div key={ch.name} className="p-2 bg-muted/30 rounded border border-border/50 text-xs space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{ch.name}（{ch.role}）</span>
                            <Button
                              size="sm"
                              variant={isSaved ? 'ghost' : 'secondary'}
                              className="h-6 text-[10px] gap-0.5"
                              onClick={() => handleSaveCharacter(ch)}
                              disabled={isSaved}
                            >
                              {isSaved ? <><Check className="h-2.5 w-2.5" /> 保存済み</> : '設定に追加'}
                            </Button>
                          </div>
                          <p className="text-muted-foreground">{ch.gender} / {ch.personality}</p>
                          {ch.speechStyle && <p className="text-muted-foreground">口調: {ch.speechStyle}</p>}
                          <p className="text-muted-foreground">{ch.description}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* History */}
        {history.length > 0 && !isStreaming && !result && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">履歴</p>
            {history.map((item, i) => (
              <button
                key={i}
                onClick={() => onInsert(item.result)}
                className="w-full text-left p-2 bg-muted/30 rounded text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <p className="line-clamp-2">{item.result}</p>
                <p className="text-[10px] mt-0.5">
                  {item.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

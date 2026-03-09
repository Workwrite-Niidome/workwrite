'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TemplateSelector, type PromptTemplate } from './template-selector';
import { useAiStream } from '@/lib/use-ai-stream';
import { api } from '@/lib/api';
import { X, Copy, ArrowDownToLine, StopCircle, Replace, Wand2, BookCheck, PenLine, Crown, Sparkles, FileText, SlidersHorizontal } from 'lucide-react';

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
    plan: string; canUseAi: boolean; canUseThinking: boolean; remainingFreeUses: number | null;
  } | null>(null);
  const [premiumMode, setPremiumMode] = useState(false);
  const [charCount, setCharCount] = useState(1000);
  const [customPrompt, setCustomPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [creationPlan, setCreationPlan] = useState<any>(null);
  const [episodes, setEpisodes] = useState<{ title: string; content: string }[]>([]);
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
      // Load creation plan for context
      api.getCreationPlan(workId)
        .then((res) => { if (res.data) setCreationPlan(res.data); })
        .catch(() => {});
      // Load previous episodes for story continuity
      api.getEpisodes(workId)
        .then((res) => {
          if (res.data) {
            const sorted = [...res.data].sort((a: any, b: any) => a.orderIndex - b.orderIndex);
            // Keep all episodes with summaries for context
            // Recent 3 episodes get more content, older ones get shorter summaries
            const summaries = sorted.map((ep: any, i: number) => {
              const contentLen = i >= sorted.length - 3 ? 800 : 200;
              return {
                title: ep.title,
                content: (ep.content || '').slice(0, contentLen),
              };
            });
            setEpisodes(summaries);
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

  function buildContextVars(): Record<string, string> {
    const vars: Record<string, string> = { content: selectedText || currentContent };
    const contextParts: string[] = [];

    // Current chapter info
    if (currentTitle) {
      contextParts.push(`現在執筆中の章: 「${currentTitle}」`);
    }
    if (currentContent && currentContent.length > 100) {
      const summary = currentContent.slice(0, 300).replace(/\n+/g, ' ');
      contextParts.push(`現在の原稿冒頭: ${summary}...`);
    }

    if (creationPlan) {
      if (creationPlan.emotionBlueprint) {
        const eb = creationPlan.emotionBlueprint;
        if (eb.coreMessage) contextParts.push(`テーマ: ${eb.coreMessage}`);
        if (eb.targetEmotions) contextParts.push(`読者に届けたい感情: ${eb.targetEmotions}`);
        if (eb.readerJourney) contextParts.push(`読者の旅路: ${eb.readerJourney}`);
      }
      if (creationPlan.characters?.length > 0) {
        const charSummary = creationPlan.characters
          .map((c: any) => `${c.name}${c.role ? `(${c.role})` : ''}: ${c.description || ''}`.trim())
          .join('\n');
        contextParts.push(`キャラクター:\n${charSummary}`);
      }
      if (creationPlan.plotOutline) {
        const plot = typeof creationPlan.plotOutline === 'string'
          ? creationPlan.plotOutline
          : creationPlan.plotOutline.text || '';
        if (plot) contextParts.push(`プロット:\n${plot}`);
      }
      if (creationPlan.chapterOutline?.length > 0) {
        const chapterSummary = creationPlan.chapterOutline
          .map((ch: any, i: number) => `第${i + 1}話「${ch.title}」: ${ch.summary || ''}`.trim())
          .join('\n');
        contextParts.push(`章立て:\n${chapterSummary}`);
      }
    }

    // Include previous episodes for story continuity
    if (episodes.length > 0) {
      const epSummary = episodes
        .map((ep, i) => `第${i + 1}話「${ep.title}」: ${ep.content}...`)
        .join('\n\n');
      contextParts.push(`これまでの章:\n${epSummary}`);
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
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-medium">AI アシスト</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Tier info */}
        {tier && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {tier.plan === 'premium' && <><Crown className="inline h-3 w-3 text-amber-500 mr-1" />プレミアム</>}
              {tier.plan === 'standard' && <><Sparkles className="inline h-3 w-3 text-blue-500 mr-1" />スタンダード</>}
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
                {premiumMode ? 'じっくりモード ON' : 'じっくりモード'}
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
              {episodes.length > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">{episodes.length}話の履歴</span>
              )}
            </div>
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

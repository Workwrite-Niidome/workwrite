'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TemplateSelector, type PromptTemplate } from './template-selector';
import { useAiStream, type AiMode } from '@/lib/use-ai-stream';
import { api, type AiGenerationHistoryItem } from '@/lib/api';
import { X, Copy, ArrowDownToLine, StopCircle, Replace, Wand2, BookCheck, PenLine, Crown, FileText, Send, UserPlus, Check, Loader2, History, Trash2, MessageSquare, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface AiAssistPanelProps {
  workId: string;
  episodeId?: string;
  currentContent: string;
  currentTitle?: string;
  selectedText?: string;
  onInsert: (text: string) => void;
  onReplace?: (text: string) => void;
  onClose: () => void;
}

// Writing slugs where character extraction makes sense
const WRITING_SLUGS = new Set(['chapter-opening', 'continue-writing', 'character-dev', 'plot-ideas', 'free-prompt']);

export function AiAssistPanel({ workId, episodeId, currentContent, currentTitle, selectedText, onInsert, onReplace, onClose }: AiAssistPanelProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [tier, setTier] = useState<{
    plan: string; canUseAi: boolean; canUseThinking: boolean; canUseOpus?: boolean; remainingFreeUses: number | null;
  } | null>(null);
  const [aiMode, setAiMode] = useState<AiMode>('thinking');
  const [charCount, setCharCount] = useState(1000);
  const [customPrompt, setCustomPrompt] = useState('');
  const [freePrompt, setFreePrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [creationPlan, setCreationPlan] = useState<any>(null);
  const [storySummary, setStorySummary] = useState<any>(null);
  const [episodes, setEpisodes] = useState<{ title: string; content: string }[]>([]);
  const [structuredContext, setStructuredContext] = useState<string | null>(null);
  const [currentEpisodeOrder, setCurrentEpisodeOrder] = useState<number | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [newChars, setNewChars] = useState<{ name: string; role: string; gender: string; personality: string; speechStyle: string; description: string }[] | null>(null);
  const [savedChars, setSavedChars] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [currentSlug, setCurrentSlug] = useState<string>('');

  // History state
  const [historyItems, setHistoryItems] = useState<AiGenerationHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);

  // Cost estimation & confirmation state
  const [pendingAction, setPendingAction] = useState<{
    type: 'quick' | 'followUp' | 'freePrompt';
    slug: string;
    vars: Record<string, string>;
    aiMode: AiMode;
    estimate: { credits: number; balance: { total: number }; isLightFeature: boolean; inputChars: number; outputTokens: number };
    followUpMessage?: string;
  } | null>(null);
  const [estimatingCost, setEstimatingCost] = useState(false);

  const { result, isStreaming, error, conversationId, generate, generateFollowUp, abort, reset } = useAiStream();

  const TEMPLATE_LABELS: Record<string, string> = {
    'chapter-opening': '章の書き出し',
    'continue-writing': '続きを書く',
    'character-dev': 'キャラクター深掘り',
    'scene-enhance': 'シーン描写の強化',
    'dialogue-improve': '会話の改善',
    'plot-ideas': 'プロット展開',
    'style-adjust': '文体調整',
    'proofread': '校正',
    'synopsis-gen': 'あらすじ生成',
    'free-prompt': '自由プロンプト',
  };

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
      api.getCreationPlan(workId)
        .then((res) => {
          if (res.data) {
            setCreationPlan(res.data);
            if (res.data.storySummary) setStorySummary(res.data.storySummary);
          }
        })
        .catch(() => {});
      api.getStoryContext(workId)
        .then((res) => { if (res) setStructuredContext(typeof res === 'string' ? res : (res as any).data || null); })
        .catch(() => {});
      api.getEpisodes(workId)
        .then((res) => {
          if (res.data) {
            const sorted = [...res.data].sort((a: any, b: any) => a.orderIndex - b.orderIndex);
            setEpisodes(sorted.map((ep: any) => ({ title: ep.title, content: '' })));
            if (episodeId) {
              const current = res.data.find((ep: any) => ep.id === episodeId);
              if (current) setCurrentEpisodeOrder(current.orderIndex);
            }
          }
        })
        .catch(() => {});
      loadHistory();
    }
  }, [workId]);

  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      // Streaming ended — refresh credit balance in header
      api.getAiStatus()
        .then((res) => { if (res.data.tier) setTier(res.data.tier); })
        .catch(() => {});
      if (result && result.length > 0) {
        loadHistory();
      }
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, result]);

  function commitResult() {
    if (result && result.length > 0) {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: result }]);
    }
  }

  function loadHistory() {
    api.getAiHistory(workId, { limit: 10 })
      .then((res) => {
        setHistoryItems(res.data);
        setHistoryTotal(res.total);
      })
      .catch(() => {});
  }

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
      name: char.name, role: char.role, description: char.description,
      personality: char.personality, speechStyle: char.speechStyle, gender: char.gender,
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
    if (workId) vars.workId = workId;
    // episodeOrder: 1-based for display in prompts
    if (currentEpisodeOrder != null) {
      vars.episodeOrder = String(currentEpisodeOrder + 1);
    } else {
      vars.episodeOrder = String(episodes.length + 1);
    }
    const contextParts: string[] = [];

    if (currentTitle) contextParts.push(`現在執筆中の章: 「${currentTitle}」`);
    if (currentContent && currentContent.length > 100) {
      const summary = currentContent.slice(0, 300).replace(/\n+/g, ' ');
      contextParts.push(`現在の原稿冒頭: ${summary}...`);
    }

    if (structuredContext) {
      contextParts.push(structuredContext);
    } else if (creationPlan?.characters?.length > 0) {
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

    if (creationPlan?.plotOutline) {
      let plot = '';
      if (typeof creationPlan.plotOutline === 'string') {
        plot = creationPlan.plotOutline;
      } else if (creationPlan.plotOutline.type === 'structured' && creationPlan.plotOutline.actGroups?.length > 0) {
        plot = creationPlan.plotOutline.actGroups.map((group: any) => {
          const header = `【${group.label}】${group.description ? ` ${group.description}` : ''}`;
          const eps = (group.episodes || []).map((ep: any, i: number) => {
            const parts = [`  ${i + 1}. ${ep.title || '（無題）'}`];
            if (ep.whatHappens) parts.push(`     何が起きるか: ${ep.whatHappens}`);
            if (ep.whyItHappens) parts.push(`     なぜ起きるか: ${ep.whyItHappens}`);
            if (ep.characters?.length > 0) parts.push(`     登場: ${ep.characters.join('、')}`);
            if (ep.emotionTarget) parts.push(`     感情目標: ${ep.emotionTarget}`);
            return parts.join('\n');
          }).join('\n');
          return eps ? `${header}\n${eps}` : header;
        }).join('\n\n');
      } else {
        plot = creationPlan.plotOutline.text || '';
      }
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

    if (creationPlan?.worldBuildingData) {
      const wb = creationPlan.worldBuildingData;
      const wbParts: string[] = [];
      if (wb.basics?.era) wbParts.push(`時代: ${wb.basics.era}`);
      if (wb.basics?.setting) wbParts.push(`舞台: ${wb.basics.setting}`);
      if (wb.basics?.civilizationLevel) wbParts.push(`文明レベル: ${wb.basics.civilizationLevel}`);
      for (const rule of wb.rules || []) {
        if (rule.name) wbParts.push(`ルール「${rule.name}」: ${rule.description}${rule.constraints ? `（制約: ${rule.constraints}）` : ''}`);
      }
      for (const term of wb.terminology || []) {
        if (term.term) wbParts.push(`${term.term}${term.reading ? `（${term.reading}）` : ''}: ${term.definition}`);
      }
      if (wb.infoAsymmetry?.commonKnowledge) wbParts.push(`一般常識: ${wb.infoAsymmetry.commonKnowledge}`);
      if (wb.infoAsymmetry?.hiddenTruths) wbParts.push(`隠された真実: ${wb.infoAsymmetry.hiddenTruths}`);
      for (const item of wb.items || []) {
        if (item.name) wbParts.push(`アイテム「${item.name}」: ${[item.ability, item.constraints].filter(Boolean).join('、')}`);
      }
      if (wbParts.length > 0) contextParts.push(`【世界観設定（厳守）】\n${wbParts.join('\n')}`);
    }

    if (creationPlan?.emotionBlueprint) {
      const eb = creationPlan.emotionBlueprint;
      if (eb.coreMessage) contextParts.push(`テーマ: ${eb.coreMessage}`);
      if (eb.targetEmotions) contextParts.push(`読者に届けたい感情: ${eb.targetEmotions}`);
      if (eb.readerJourney) contextParts.push(`読者の旅路: ${eb.readerJourney}`);
      if (eb.inspiration) contextParts.push(`インスピレーション: ${eb.inspiration}`);
      if (eb.readerOneLiner) contextParts.push(`読者に一言: ${eb.readerOneLiner}`);
    }

    if (storySummary) {
      const parts: string[] = [];
      if (storySummary.overallSummary) parts.push(`【物語の流れ】\n${storySummary.overallSummary}`);
      if (storySummary.episodes?.length > 0) {
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
      if (storySummary.openThreads?.length > 0) parts.push(`【未解決の伏線・展開】\n${storySummary.openThreads.join('\n')}`);
      if (storySummary.worldRules?.length > 0) parts.push(`【世界観・ルール】\n${storySummary.worldRules.join('\n')}`);
      if (storySummary.timeline) parts.push(`時間経過: ${storySummary.timeline}`);
      if (storySummary.tone) parts.push(`トーン: ${storySummary.tone}`);
      contextParts.push(parts.join('\n\n'));
    } else if (episodes.length > 0) {
      const epList = episodes.map((ep, i) => `第${i + 1}話「${ep.title}」`).join('\n');
      contextParts.push(`【これまでの章（要約未生成 — タイトルのみ）】\n${epList}`);
    }

    if (contextParts.length > 0) vars.context = contextParts.join('\n\n');
    vars.char_count = String(charCount);
    if (customPrompt.trim()) vars.custom_instruction = customPrompt.trim();
    return vars;
  }

  async function handleQuickAction(slug: string) {
    setEstimatingCost(true);
    setPendingAction(null);
    const vars = buildContextVars();
    try {
      const res = await api.estimateAiCost({ templateSlug: slug, variables: vars, aiMode });
      // Update header credit display with fresh balance
      if (res.balance) {
        setTier((prev: any) => prev ? { ...prev, credits: res.balance } : prev);
      }
      if (res.isLightFeature || res.estimate.credits === 0) {
        // Free feature — skip confirmation
        setChatMessages([]);
        setCurrentSlug(slug);
        setNewChars(null);
        reset();
        generate(slug, vars, undefined, aiMode);
      } else {
        setPendingAction({
          type: 'quick',
          slug,
          vars,
          aiMode,
          estimate: {
            credits: res.estimate.credits,
            balance: res.balance,
            isLightFeature: false,
            inputChars: res.estimate.breakdown.inputChars,
            outputTokens: res.estimate.breakdown.estimatedOutputTokens,
          },
        });
      }
    } catch (e: any) {
      console.error('estimateAiCost failed:', e);
      // Show error instead of silently proceeding
      setChatMessages([{ role: 'system', content: `見積もり取得に失敗しました: ${e?.message || '不明なエラー'}` }]);
    }
    setEstimatingCost(false);
  }

  async function handleFollowUp() {
    if (!followUpInput.trim() || !conversationId || isStreaming) return;
    const msg = followUpInput.trim();
    setEstimatingCost(true);
    setPendingAction(null);
    const vars = buildContextVars();
    try {
      const res = await api.estimateAiCost({
        templateSlug: currentSlug || 'free-prompt',
        variables: vars,
        aiMode,
        conversationId: conversationId || undefined,
        followUpMessage: msg,
      });
      // Update header credit display with fresh balance
      if (res.balance) {
        setTier((prev: any) => prev ? { ...prev, credits: res.balance } : prev);
      }
      if (res.isLightFeature || res.estimate.credits === 0) {
        executeFollowUp(msg, vars);
      } else {
        setPendingAction({
          type: 'followUp',
          slug: currentSlug || 'free-prompt',
          vars,
          aiMode,
          estimate: {
            credits: res.estimate.credits,
            balance: res.balance,
            isLightFeature: false,
            inputChars: res.estimate.breakdown.inputChars,
            outputTokens: res.estimate.breakdown.estimatedOutputTokens,
          },
          followUpMessage: msg,
        });
      }
    } catch (e: any) {
      console.error('estimateAiCost failed:', e);
    }
    setEstimatingCost(false);
  }

  function executeFollowUp(msg: string, vars: Record<string, string>) {
    commitResult();
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setFollowUpInput('');
    setNewChars(null);
    generateFollowUp({
      templateSlug: currentSlug || 'free-prompt',
      variables: vars,
      aiMode,
      conversationId: conversationId || undefined,
      followUpMessage: msg,
    });
  }

  function confirmPendingAction() {
    if (!pendingAction) return;
    if (pendingAction.type === 'quick') {
      setChatMessages([]);
      setCurrentSlug(pendingAction.slug);
      setNewChars(null);
      reset();
      generate(pendingAction.slug, pendingAction.vars, undefined, pendingAction.aiMode);
    } else if (pendingAction.type === 'followUp' && pendingAction.followUpMessage) {
      executeFollowUp(pendingAction.followUpMessage, pendingAction.vars);
    } else if (pendingAction.type === 'freePrompt') {
      setChatMessages([]);
      setCurrentSlug(pendingAction.slug);
      setNewChars(null);
      reset();
      generate(pendingAction.slug, pendingAction.vars, undefined, pendingAction.aiMode);
    }
    setPendingAction(null);
  }

  function cancelPendingAction() {
    setPendingAction(null);
  }

  function handleNewConversation() {
    setChatMessages([]);
    setNewChars(null);
    reset();
  }

  function handleInsertFromHistory(item: AiGenerationHistoryItem) {
    const lastAssistant = [...item.messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant) onInsert(lastAssistant.content);
  }

  async function handleDeleteHistory(id: string) {
    try {
      await api.deleteAiHistory(id);
      setHistoryItems((prev) => prev.filter((item) => item.id !== id));
      setHistoryTotal((prev) => prev - 1);
    } catch { /* ignore */ }
  }

  function handleResumeConversation(item: AiGenerationHistoryItem) {
    setChatMessages(item.messages);
    setCurrentSlug(item.templateSlug);
    setShowHistory(false);
    reset();
  }

  // Credit cost label (minimum estimate for display)
  const creditLabel = pendingAction
    ? String(pendingAction.estimate.credits)
    : aiMode === 'premium' ? '5+' : aiMode === 'thinking' ? '2+' : '1+';

  if (available === false || (tier && !tier.canUseAi)) {
    const isQuotaExhausted = tier && !tier.canUseAi;
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-sm font-medium">AI アシスト</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            {isQuotaExhausted ? (
              <>クレジットが不足しています。<br /><a href="/settings/billing" className="underline">プランをアップグレード</a>するか、クレジットを追加購入してください。</>
            ) : (
              <>AI機能は現在利用できません。<br />管理者がAPIキーを設定するとご利用いただけます。</>
            )}
          </p>
        </div>
      </div>
    );
  }

  const hasConversation = chatMessages.length > 0 || result || isStreaming;
  const contextItemCount = [
    creationPlan?.characters?.length > 0,
    creationPlan?.plotOutline,
    creationPlan?.chapterOutline?.length > 0,
    storySummary,
    episodes.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-medium">AI アシスト</h3>
        <div className="flex items-center gap-1">
          {tier && (
            <span className="text-xs text-muted-foreground mr-2">
              残り {(tier as any).credits?.total ?? tier.remainingFreeUses ?? '?'} クレジット
            </span>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-1.5 rounded transition-colors ${showHistory ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
            title="生成履歴"
          >
            <History className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-8 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* History Panel */}
        {showHistory && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">生成履歴 ({historyTotal}件)</p>
            {historyItems.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">まだ生成履歴がありません</p>
            ) : (
              <div className="space-y-1.5">
                {historyItems.map((item) => {
                  const lastAssistant = [...item.messages].reverse().find((m) => m.role === 'assistant');
                  const msgCount = item.messages.filter((m) => m.role === 'user').length;
                  return (
                    <div key={item.id} className="p-2.5 bg-muted/30 rounded-lg border border-border/50 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {TEMPLATE_LABELS[item.templateSlug] || item.templateSlug}
                          {msgCount > 1 && <span className="text-muted-foreground ml-1">({msgCount}往復)</span>}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(item.updatedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {lastAssistant && (
                        <p className="text-muted-foreground line-clamp-2">{lastAssistant.content}</p>
                      )}
                      <div className="flex gap-1 pt-0.5">
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => handleResumeConversation(item)}>
                          <MessageSquare className="h-3 w-3 mr-1" /> 再開
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => handleInsertFromHistory(item)}>
                          <ArrowDownToLine className="h-3 w-3 mr-1" /> 挿入
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-muted-foreground hover:text-destructive ml-auto" onClick={() => handleDeleteHistory(item.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="border-b border-border my-2" />
          </div>
        )}

        {/* Selected text indicator */}
        {selectedText && (
          <div className="p-2.5 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-xs font-medium text-primary flex items-center gap-1.5">
              <Replace className="h-3.5 w-3.5" /> 選択テキスト ({selectedText.length}文字)
            </p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{selectedText.slice(0, 100)}{selectedText.length > 100 ? '...' : ''}</p>
          </div>
        )}

        {/* Cost confirmation bar */}
        {pendingAction && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 space-y-2">
            <p className="text-xs font-medium">コスト確認</p>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                入力: 約{Math.round(pendingAction.estimate.inputChars / 1000 * 10) / 10}K文字
                {' / '}生成: 約{Math.round(pendingAction.estimate.outputTokens / 2000 * 10) / 10}K文字
              </p>
              <p>
                消費クレジット: <span className="font-bold text-foreground">{pendingAction.estimate.credits}cr</span>
                <span className="ml-2">（残高: {pendingAction.estimate.balance.total}cr）</span>
              </p>
            </div>
            {pendingAction.estimate.balance.total < pendingAction.estimate.credits && (
              <p className="text-xs text-destructive">
                クレジット不足です。<a href="/settings/billing" className="underline ml-1">クレジットを追加</a>
              </p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={confirmPendingAction}
                disabled={pendingAction.estimate.balance.total < pendingAction.estimate.credits}
                className="h-7 text-xs"
              >
                {pendingAction.estimate.credits}cr で実行
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelPendingAction} className="h-7 text-xs">
                キャンセル
              </Button>
            </div>
          </div>
        )}

        {/* AI quality mode + character count — always visible at top */}
        {!pendingAction && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">生成品質</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setAiMode('normal')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    aiMode === 'normal'
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  簡易
                  <span className="block text-[10px] opacity-60 mt-0.5">1cr〜</span>
                </button>
                {tier?.canUseThinking && (
                  <button
                    onClick={() => setAiMode('thinking')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      aiMode === 'thinking'
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    通常
                    <span className="block text-[10px] opacity-60 mt-0.5">5cr〜</span>
                  </button>
                )}
                {tier?.canUseOpus && (
                  <button
                    onClick={() => setAiMode('premium')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      aiMode === 'premium'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-600'
                        : 'border-border text-muted-foreground hover:border-amber-500/30'
                    }`}
                  >
                    <Crown className="h-3 w-3 inline mr-0.5" />
                    高精度
                    <span className="block text-[10px] opacity-60 mt-0.5">30cr〜</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                生成する文字数: <span className="text-foreground">{charCount.toLocaleString()}字</span>
              </p>
              <input type="range" min={300} max={5000} step={100} value={charCount}
                onChange={(e) => setCharCount(Number(e.target.value))} className="w-full h-1.5 accent-foreground" />
              <div className="flex justify-between text-[10px] text-muted-foreground"><span>短め</span><span>長め</span></div>
            </div>
          </div>
        )}

        {/* Main actions — always visible */}
        {!pendingAction && (
          <div className="space-y-3">
            {!hasConversation && (
              <p className="text-xs font-medium text-muted-foreground">
                {estimatingCost ? '見積もり取得中...' : '何をしますか？'}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleQuickAction('chapter-opening')}
                disabled={isStreaming || estimatingCost}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">章の書き出し</span>
                <span className="text-[10px] text-muted-foreground">{charCount.toLocaleString()}字</span>
              </button>
              <button
                onClick={() => handleQuickAction('continue-writing')}
                disabled={isStreaming || estimatingCost || !currentContent.trim()}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                <PenLine className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">続きを書く</span>
                <span className="text-[10px] text-muted-foreground">{charCount.toLocaleString()}字</span>
              </button>
              <button
                onClick={() => handleQuickAction('proofread')}
                disabled={isStreaming || estimatingCost || !currentContent.trim()}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                <BookCheck className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">校正・推敲</span>
              </button>
              <button
                onClick={() => handleQuickAction('style-adjust')}
                disabled={isStreaming || estimatingCost || !currentContent.trim()}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                <Wand2 className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">文体調整</span>
              </button>
            </div>

            {/* Free-form prompt */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">AIに自由に指示する</p>
              <div className="flex gap-1.5">
                <textarea value={freePrompt} onChange={(e) => setFreePrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && freePrompt.trim() && !isStreaming && !estimatingCost) {
                      e.preventDefault();
                      const vars = buildContextVars();
                      vars.user_prompt = freePrompt.trim();
                      handleQuickAction('free-prompt');
                    }
                  }}
                  placeholder="例: 主人公の心情をもっと丁寧に描写して..."
                  rows={2} className="flex-1 text-xs p-2.5 rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
                <Button size="sm" variant="default" className="self-end h-9 px-3"
                  disabled={!freePrompt.trim() || isStreaming || estimatingCost}
                  onClick={() => {
                    const vars = buildContextVars();
                    vars.user_prompt = freePrompt.trim();
                    handleQuickAction('free-prompt');
                  }}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Advanced settings — collapsed by default */}
            <div className="border-t border-border pt-3">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                詳細設定
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3">
                  {/* Custom instruction */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">追加の指示</p>
                    <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="例: 緊張感のある場面にして..."
                      rows={2} className="w-full text-xs p-2.5 rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
                  </div>

                  {/* Context indicator */}
                  {contextItemCount > 0 && (
                    <div className="p-2.5 bg-muted/50 rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground">
                        作品情報を自動で参照しています
                        {creationPlan?.characters?.length > 0 && ` / ${creationPlan.characters.length}人のキャラクター`}
                        {episodes.length > 0 && ` / ${episodes.length}話`}
                      </p>
                    </div>
                  )}

                  {/* Other templates */}
                  <TemplateSelector
                    templates={templates}
                    onGenerate={(slug) => {
                      handleQuickAction(slug);
                    }}
                    isStreaming={isStreaming || estimatingCost}
                    currentContent={selectedText || currentContent}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 text-xs text-destructive bg-destructive/10 rounded-lg">{error}</div>
        )}

        {/* Chat conversation view */}
        {hasConversation && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {TEMPLATE_LABELS[currentSlug] || 'AI会話'}
              </p>
              <div className="flex items-center gap-1">
                {isStreaming && (
                  <button onClick={abort} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded hover:bg-muted">
                    <StopCircle className="h-3.5 w-3.5" /> 停止
                  </button>
                )}
                <button onClick={handleNewConversation} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded hover:bg-muted" title="やり直す">
                  <RotateCcw className="h-3.5 w-3.5" /> やり直す
                </button>
              </div>
            </div>

            {/* Past messages */}
            {chatMessages.map((msg, i) => {
              const isLastAssistant = msg.role === 'assistant' && i === chatMessages.length - 1;
              const isOlderAssistant = msg.role === 'assistant' && !isLastAssistant;
              return (
                <div key={i} className={`text-xs rounded-lg p-3 ${msg.role === 'user' ? 'bg-primary/5 border border-primary/20' : 'bg-secondary/50'}`}>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    {msg.role === 'user' ? 'あなた' : 'AI'}
                  </p>
                  <div className={`whitespace-pre-wrap leading-relaxed ${
                    isLastAssistant ? 'max-h-80 overflow-y-auto' : isOlderAssistant ? 'line-clamp-6' : ''
                  }`}>{msg.content}</div>
                  {isOlderAssistant && (
                    <div className="flex gap-1 mt-2">
                      {currentSlug === 'proofread' && onReplace ? (
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => onReplace(msg.content)}>
                          <Replace className="h-3 w-3 mr-1" /> 差し替え
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => onInsert(msg.content)}>
                          <ArrowDownToLine className="h-3 w-3 mr-1" /> 挿入
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { navigator.clipboard.writeText(msg.content); }}>
                        <Copy className="h-3 w-3 mr-1" /> コピー
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Current streaming / completed result */}
            {(isStreaming || (result && !(chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.role === 'assistant' && chatMessages[chatMessages.length - 1]?.content === result))) && (
              <div className="text-xs rounded-lg p-3 bg-secondary/50 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">AI</p>
                  {isStreaming && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      生成中...
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                {result && (
                  <div className="flex gap-1.5">
                    {currentSlug === 'proofread' && onReplace ? (
                      <Button size="sm" variant="outline" onClick={() => { onReplace(result); commitResult(); }} className="flex-1 text-xs h-8">
                        <Replace className="h-3.5 w-3.5 mr-1" /> 差し替え
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { onInsert(result); commitResult(); }} className="flex-1 text-xs h-8">
                          <ArrowDownToLine className="h-3.5 w-3.5 mr-1" /> 挿入
                        </Button>
                        {selectedText && onReplace && (
                          <Button size="sm" variant="outline" onClick={() => { onReplace(result); commitResult(); }} className="flex-1 text-xs h-8">
                            <Replace className="h-3.5 w-3.5 mr-1" /> 置換
                          </Button>
                        )}
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => { handleCopy(); commitResult(); }} className="flex-1 text-xs h-8">
                      <Copy className="h-3.5 w-3.5 mr-1" /> {copied ? 'OK' : 'コピー'}
                    </Button>
                  </div>
                )}

                {/* Result text */}
                {isStreaming && !result ? (
                  <div className="flex items-center gap-2 py-3">
                    <span className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                    {result}
                    {isStreaming && <span className="inline-block w-1 h-4 bg-foreground animate-pulse ml-0.5" />}
                  </div>
                )}

                {/* Extract characters — only for writing templates */}
                {result && WRITING_SLUGS.has(currentSlug) && (
                  <div className="space-y-2 border-t border-border/50 pt-2">
                    <Button size="sm" variant="ghost" onClick={handleExtractCharacters} disabled={extracting}
                      className="w-full text-xs text-muted-foreground gap-1 h-7">
                      {extracting ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                      {extracting ? '検出中...' : '新キャラクターを検出して登録'}
                    </Button>

                    {newChars !== null && newChars.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center">新しいキャラクターは見つかりませんでした</p>
                    )}
                    {newChars && newChars.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">見つかったキャラクター:</p>
                        {newChars.map((ch) => {
                          const isSaved = savedChars.has(ch.name);
                          return (
                            <div key={ch.name} className="p-2.5 bg-muted/30 rounded-lg border border-border/50 text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{ch.name}（{ch.role}）</span>
                                <Button size="sm" variant={isSaved ? 'ghost' : 'secondary'} className="h-6 text-xs gap-0.5"
                                  onClick={() => handleSaveCharacter(ch)} disabled={isSaved}>
                                  {isSaved ? <><Check className="h-3 w-3" /> 保存済み</> : '設定に追加'}
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

            {/* Follow-up input */}
            {!isStreaming && conversationId && (
              <div className="space-y-1.5 pt-2 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground">修正の指示</p>
                <div className="flex gap-1.5">
                  <textarea
                    value={followUpInput}
                    onChange={(e) => setFollowUpInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && followUpInput.trim()) {
                        e.preventDefault();
                        handleFollowUp();
                      }
                    }}
                    placeholder="例: もう少し暗い雰囲気にして..."
                    rows={2}
                    className="flex-1 text-xs p-2.5 rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Button size="sm" variant="default" className="self-end h-9 px-3"
                    disabled={!followUpInput.trim() || isStreaming || estimatingCost}
                    onClick={handleFollowUp}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  約{creditLabel}クレジット/回（実行前に確認あり）
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

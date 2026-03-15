'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TemplateSelector, type PromptTemplate } from './template-selector';
import { useAiStream } from '@/lib/use-ai-stream';
import { api, type AiGenerationHistoryItem } from '@/lib/api';
import { X, Copy, ArrowDownToLine, StopCircle, Replace, Wand2, BookCheck, PenLine, Crown, Sparkles, FileText, SlidersHorizontal, Send, UserPlus, Check, Loader2, History, Trash2, MessageSquare, RotateCcw } from 'lucide-react';

interface AiAssistPanelProps {
  workId: string;
  currentContent: string;
  currentTitle?: string;
  selectedText?: string;
  onInsert: (text: string) => void;
  onReplace?: (text: string) => void;
  onClose: () => void;
}

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
  const [creationPlan, setCreationPlan] = useState<any>(null);
  const [storySummary, setStorySummary] = useState<any>(null);
  const [episodes, setEpisodes] = useState<{ title: string; content: string }[]>([]);
  const [structuredContext, setStructuredContext] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [newChars, setNewChars] = useState<{ name: string; role: string; gender: string; personality: string; speechStyle: string; description: string }[] | null>(null);
  const [savedChars, setSavedChars] = useState<Set<string>>(new Set());

  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [currentSlug, setCurrentSlug] = useState<string>('');

  // History state
  const [historyItems, setHistoryItems] = useState<AiGenerationHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);

  const { result, isStreaming, error, conversationId, generate, generateFollowUp, abort, reset } = useAiStream();

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
          }
        })
        .catch(() => {});
      loadHistory();
    }
  }, [workId]);

  // When generation completes, update chat messages
  useEffect(() => {
    if (!isStreaming && result && result.length > 0) {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: result }]);
      loadHistory();
    }
  }, [isStreaming, result]);

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
      personality: char.personality, speechStyle: char.speechStyle, gender: char.gender, aiSuggested: true,
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

  function handleQuickAction(slug: string) {
    setChatMessages([]);
    setCurrentSlug(slug);
    setNewChars(null);
    reset();
    generate(slug, buildContextVars(), premiumMode);
  }

  function handleFollowUp() {
    if (!followUpInput.trim() || !conversationId || isStreaming) return;
    const msg = followUpInput.trim();
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setFollowUpInput('');
    setNewChars(null);
    generateFollowUp({
      templateSlug: currentSlug || 'free-prompt',
      variables: buildContextVars(),
      premiumMode,
      conversationId,
      followUpMessage: msg,
    });
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
    // Set conversationId by triggering a dummy state — the actual conversationId
    // will be set on next follow-up send
  }

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

  const hasConversation = chatMessages.length > 0 || result;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-medium">AI アシスト</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-1 rounded transition-colors ${showHistory ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}
            title="生成履歴"
          >
            <History className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-8 space-y-3" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* History Panel */}
        {showHistory && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <History className="h-3 w-3" /> 生成履歴 ({historyTotal}件)
            </p>
            {historyItems.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">まだ生成履歴がありません</p>
            ) : (
              <div className="space-y-1.5">
                {historyItems.map((item) => {
                  const lastAssistant = [...item.messages].reverse().find((m) => m.role === 'assistant');
                  const msgCount = item.messages.filter((m) => m.role === 'user').length;
                  return (
                    <div key={item.id} className="p-2 bg-muted/30 rounded border border-border/50 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {TEMPLATE_LABELS[item.templateSlug] || item.templateSlug}
                          {msgCount > 1 && <span className="text-muted-foreground ml-1">({msgCount}往復)</span>}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{item.creditCost}cr</span>
                      </div>
                      {item.promptSummary && (
                        <p className="text-muted-foreground line-clamp-1">{item.promptSummary}</p>
                      )}
                      {lastAssistant && (
                        <p className="text-muted-foreground line-clamp-2">{lastAssistant.content}</p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.updatedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5" onClick={() => handleResumeConversation(item)}>
                            <MessageSquare className="h-2.5 w-2.5 mr-0.5" /> 会話を再開
                          </Button>
                          <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5" onClick={() => handleInsertFromHistory(item)}>
                            <ArrowDownToLine className="h-2.5 w-2.5 mr-0.5" /> 挿入
                          </Button>
                          <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteHistory(item.id)}>
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="border-b border-border my-2" />
          </div>
        )}

        {/* Tier info + Credit balance */}
        {tier && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {tier.plan === 'pro' && <><Crown className="inline h-3 w-3 text-amber-500 mr-1" />Pro</>}
                {tier.plan === 'standard' && <><Crown className="inline h-3 w-3 text-purple-500 mr-1" />Standard</>}
                {tier.plan === 'free' && <>Free</>}
              </span>
              <span className="font-medium">
                {(tier as any).credits?.total ?? tier.remainingFreeUses ?? '?'}
                <span className="text-muted-foreground font-normal ml-0.5">cr</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
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
                    ? (tier.canUseOpus ? '高精度モード ON' : 'じっくりモード ON')
                    : (tier.canUseOpus ? '高精度モード' : 'じっくりモード')}
                </button>
              )}
              <span className="text-[10px] text-muted-foreground">
                {premiumMode ? (tier.canUseOpus ? '5cr/回' : '2cr/回') : '1cr/回'}
              </span>
            </div>
            {(tier as any).credits?.total === 0 && (
              <div className="p-2 bg-amber-500/10 rounded-md border border-amber-500/20">
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  クレジットが不足しています。
                  <a href="/settings/billing" className="underline ml-1">プランを確認</a>
                </p>
              </div>
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
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">要約キャッシュ</span>
              )}
              {!storySummary && episodes.length > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">{episodes.length}話（タイトルのみ）</span>
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

        {/* Quick actions - hidden during active conversation */}
        {!hasConversation && (
          <>
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">クイックアクション</p>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => handleQuickAction('chapter-opening')} disabled={isStreaming}>
                  <FileText className="h-3 w-3" /> 章の書き出し
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => handleQuickAction('proofread')} disabled={isStreaming}>
                  <BookCheck className="h-3 w-3" /> 校正
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => handleQuickAction('continue-writing')} disabled={isStreaming}>
                  <PenLine className="h-3 w-3" /> 続きを書く
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => handleQuickAction('style-adjust')} disabled={isStreaming}>
                  <Wand2 className="h-3 w-3" /> 文体調整
                </Button>
              </div>
            </div>

            {/* Character count */}
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <SlidersHorizontal className="h-3 w-3" /> 生成文字数: {charCount.toLocaleString()}字
              </p>
              <input type="range" min={100} max={5000} step={100} value={charCount}
                onChange={(e) => setCharCount(Number(e.target.value))} className="w-full h-1.5 accent-foreground" />
              <div className="flex justify-between text-[10px] text-muted-foreground"><span>100</span><span>5000</span></div>
            </div>

            {/* Custom instruction */}
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">追加指示（任意）</p>
              <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="例: 緊張感のある場面にして、主人公の心情を丁寧に描写して..."
                rows={2} className="w-full text-xs p-2 rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>

            {/* Free-form prompt */}
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Send className="h-3 w-3" /> AIに直接指示
              </p>
              <div className="flex gap-1.5">
                <textarea value={freePrompt} onChange={(e) => setFreePrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && freePrompt.trim() && !isStreaming) {
                      e.preventDefault();
                      setChatMessages([]);
                      setCurrentSlug('free-prompt');
                      setNewChars(null);
                      const vars = buildContextVars();
                      vars.user_prompt = freePrompt.trim();
                      reset();
                      generate('free-prompt', vars, premiumMode);
                      setFreePrompt('');
                    }
                  }}
                  placeholder="AIへの指示を入力... (Ctrl+Enter で送信)"
                  rows={2} className="flex-1 text-xs p-2 rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
                <Button size="sm" variant="default" className="self-end h-8 px-2"
                  disabled={!freePrompt.trim() || isStreaming}
                  onClick={() => {
                    setChatMessages([]);
                    setCurrentSlug('free-prompt');
                    setNewChars(null);
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

            <TemplateSelector
              templates={templates}
              onGenerate={(slug, vars) => {
                setChatMessages([]);
                setCurrentSlug(slug);
                setNewChars(null);
                reset();
                const contextVars = buildContextVars();
                generate(slug, { ...contextVars, ...vars }, premiumMode);
              }}
              isStreaming={isStreaming}
              currentContent={selectedText || currentContent}
            />
          </>
        )}

        {error && (
          <div className="p-2 text-xs text-destructive bg-destructive/10 rounded-md">{error}</div>
        )}

        {/* Chat conversation view */}
        {hasConversation && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> AI会話
                {chatMessages.filter((m) => m.role === 'user').length > 0 && (
                  <span className="text-[10px]">({chatMessages.filter((m) => m.role === 'user').length}往復)</span>
                )}
              </p>
              <div className="flex items-center gap-1">
                {isStreaming && (
                  <button onClick={abort} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <StopCircle className="h-3 w-3" /> 停止
                  </button>
                )}
                <button onClick={handleNewConversation} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" title="新しい会話">
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Past messages in conversation */}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`text-xs rounded-md p-2 ${msg.role === 'user' ? 'bg-primary/5 border border-primary/20' : 'bg-secondary/50'}`}>
                <p className="text-[10px] font-medium text-muted-foreground mb-1">
                  {msg.role === 'user' ? 'あなた' : 'AI'}
                </p>
                <div className="whitespace-pre-wrap leading-relaxed line-clamp-6">{msg.content}</div>
                {msg.role === 'assistant' && (
                  <div className="flex gap-1 mt-1.5">
                    <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5" onClick={() => onInsert(msg.content)}>
                      <ArrowDownToLine className="h-2.5 w-2.5 mr-0.5" /> 挿入
                    </Button>
                    {selectedText && onReplace && (
                      <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5" onClick={() => onReplace(msg.content)}>
                        <Replace className="h-2.5 w-2.5 mr-0.5" /> 置換
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5" onClick={() => { navigator.clipboard.writeText(msg.content); }}>
                      <Copy className="h-2.5 w-2.5 mr-0.5" /> コピー
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {/* Current streaming result */}
            {(result || isStreaming) && !chatMessages.some((m) => m.content === result) && (
              <div className="text-xs rounded-md p-2 bg-secondary/50">
                <p className="text-[10px] font-medium text-muted-foreground mb-1">AI</p>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {result}
                  {isStreaming && <span className="inline-block w-1 h-4 bg-foreground animate-pulse ml-0.5" />}
                </div>
              </div>
            )}

            {/* Action buttons after generation */}
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
                <Button size="sm" variant="ghost" onClick={handleExtractCharacters} disabled={extracting}
                  className="w-full text-xs text-muted-foreground gap-1">
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
                            <Button size="sm" variant={isSaved ? 'ghost' : 'secondary'} className="h-6 text-[10px] gap-0.5"
                              onClick={() => handleSaveCharacter(ch)} disabled={isSaved}>
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

            {/* Follow-up input (chat-style refinement) */}
            {!isStreaming && conversationId && (
              <div className="space-y-1 pt-1 border-t border-border">
                <p className="text-[10px] font-medium text-muted-foreground">打ち返し（修正指示）</p>
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
                    placeholder="例: もう少し暗い雰囲気にして... (Ctrl+Enter)"
                    rows={2}
                    className="flex-1 text-xs p-2 rounded-md border border-border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Button size="sm" variant="default" className="self-end h-8 px-2"
                    disabled={!followUpInput.trim() || isStreaming}
                    onClick={handleFollowUp}>
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">1cr/回 — 打ち返し回数無制限</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

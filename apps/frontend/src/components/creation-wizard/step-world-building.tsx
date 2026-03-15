'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Sparkles, Globe, BookOpen, ScrollText, Sword, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { consumeSSEStream } from '@/lib/use-ai-stream';
import type { WizardData, WorldBuildingData } from './wizard-shell';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

function generateId() {
  return crypto.randomUUID();
}

function Section({
  icon: Icon,
  title,
  description,
  isOpen,
  onToggle,
  children,
}: {
  icon: typeof Globe;
  title: string;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/30 transition-colors"
      >
        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-[10px] text-muted-foreground ml-2">{description}</span>
        </div>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 border-t border-border/50 pt-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

export function StepWorldBuilding({ data, onChange }: Props) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['basics']));
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const wb = data.worldBuilding;

  function updateWB(partial: Partial<WorldBuildingData>) {
    onChange({ worldBuilding: { ...wb, ...partial } });
  }

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ─── AI generation ───────────────────────────────────────

  async function handleAiGenerate(section: string) {
    setAiLoading(section);
    try {
      const context: string[] = [];
      if (data.genre) context.push(`ジャンル: ${data.genre}`);
      if (data.coreMessage) context.push(`テーマ: ${data.coreMessage}`);
      if (data.inspiration) context.push(`インスピレーション: ${data.inspiration}`);
      if (wb.basics.era) context.push(`時代: ${wb.basics.era}`);
      if (wb.basics.setting) context.push(`舞台: ${wb.basics.setting}`);
      if (data.characters.length > 0) {
        const charNames = data.characters.map((c: any) => c.name).join(', ');
        context.push(`キャラクター: ${charNames}`);
      }

      const res = await api.fetchSSE('/works/none/creation/world-building', {
        section,
        context: context.join('\n'),
        existingData: wb,
      });

      let accumulated = '';
      let serverParsed: any = null;

      await consumeSSEStream(res, (event) => {
        if (event.text) accumulated += event.text;
        if (event.parsed) serverParsed = event.parsed;
      });

      const parsed = serverParsed || parseWorldBuildingJson(accumulated);
      if (parsed) {
        applyAiResult(section, parsed);
      }
    } catch {
      // silently fail
    } finally {
      setAiLoading(null);
    }
  }

  function applyAiResult(section: string, result: any) {
    switch (section) {
      case 'rules':
        if (result.rules) {
          const newRules = result.rules.map((r: any) => ({
            id: generateId(), name: r.name || '', description: r.description || '', constraints: r.constraints || '',
          }));
          updateWB({ rules: [...wb.rules, ...newRules] });
        }
        break;
      case 'terminology':
        if (result.terminology) {
          const newTerms = result.terminology.map((t: any) => ({
            id: generateId(), term: t.term || '', reading: t.reading || '', definition: t.definition || '',
          }));
          updateWB({ terminology: [...wb.terminology, ...newTerms] });
        }
        break;
      case 'items':
        if (result.items) {
          const newItems = result.items.map((item: any) => ({
            id: generateId(), name: item.name || '', appearance: item.appearance || '',
            ability: item.ability || '', constraints: item.constraints || '',
            owner: item.owner || '', narrativeMeaning: item.narrativeMeaning || '',
          }));
          updateWB({ items: [...wb.items, ...newItems] });
        }
        break;
      case 'basics':
        if (result.basics) {
          updateWB({ basics: { ...wb.basics, ...result.basics } });
        }
        break;
      case 'history':
        if (result.history) {
          updateWB({ history: result.history });
        }
        break;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">世界観・アイテム設定</h2>
        <p className="text-sm text-muted-foreground">
          物語の舞台となる世界を設計しましょう。必要なセクションだけ埋めれば大丈夫です。
        </p>
      </div>

      <div className="space-y-3">
        {/* Basics */}
        <Section icon={Globe} title="基本設定" description="時代・舞台・文明レベル" isOpen={openSections.has('basics')} onToggle={() => toggleSection('basics')}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">時代</label>
              <Input value={wb.basics.era} onChange={(e) => updateWB({ basics: { ...wb.basics, era: e.target.value } })} placeholder="中世/近未来/現代" className="h-7 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">舞台</label>
              <Input value={wb.basics.setting} onChange={(e) => updateWB({ basics: { ...wb.basics, setting: e.target.value } })} placeholder="架空の島国/宇宙ステーション" className="h-7 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">文明レベル</label>
              <Input value={wb.basics.civilizationLevel} onChange={(e) => updateWB({ basics: { ...wb.basics, civilizationLevel: e.target.value } })} placeholder="中世ヨーロッパ相当" className="h-7 text-xs" />
            </div>
          </div>
          <AiButton section="basics" loading={aiLoading} onGenerate={handleAiGenerate} />
        </Section>

        {/* Rules */}
        <Section icon={ScrollText} title="ルール・法則" description="魔法体系・物理法則・社会制度" isOpen={openSections.has('rules')} onToggle={() => toggleSection('rules')}>
          {wb.rules.map((rule, i) => (
            <div key={rule.id} className="p-2 border border-border/50 rounded-lg space-y-1.5">
              <div className="flex gap-2">
                <Input value={rule.name} onChange={(e) => {
                  const updated = [...wb.rules]; updated[i] = { ...rule, name: e.target.value }; updateWB({ rules: updated });
                }} placeholder="ルール名" className="h-7 text-xs flex-1" />
                <button onClick={() => updateWB({ rules: wb.rules.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Textarea value={rule.description} onChange={(e) => {
                const updated = [...wb.rules]; updated[i] = { ...rule, description: e.target.value }; updateWB({ rules: updated });
              }} placeholder="ルールの説明" rows={2} className="text-xs" />
              <Input value={rule.constraints} onChange={(e) => {
                const updated = [...wb.rules]; updated[i] = { ...rule, constraints: e.target.value }; updateWB({ rules: updated });
              }} placeholder="制約・コスト" className="h-7 text-xs" />
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => updateWB({ rules: [...wb.rules, { id: generateId(), name: '', description: '', constraints: '' }] })} className="gap-1 text-xs">
              <Plus className="h-3 w-3" /> ルール追加
            </Button>
            <AiButton section="rules" loading={aiLoading} onGenerate={handleAiGenerate} />
          </div>
        </Section>

        {/* Terminology */}
        <Section icon={BookOpen} title="用語集" description="固有名詞・専門用語" isOpen={openSections.has('terminology')} onToggle={() => toggleSection('terminology')}>
          {wb.terminology.map((term, i) => (
            <div key={term.id} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-3 gap-1.5">
                <Input value={term.term} onChange={(e) => {
                  const updated = [...wb.terminology]; updated[i] = { ...term, term: e.target.value }; updateWB({ terminology: updated });
                }} placeholder="用語" className="h-7 text-xs" />
                <Input value={term.reading} onChange={(e) => {
                  const updated = [...wb.terminology]; updated[i] = { ...term, reading: e.target.value }; updateWB({ terminology: updated });
                }} placeholder="読み" className="h-7 text-xs" />
                <Input value={term.definition} onChange={(e) => {
                  const updated = [...wb.terminology]; updated[i] = { ...term, definition: e.target.value }; updateWB({ terminology: updated });
                }} placeholder="定義" className="h-7 text-xs" />
              </div>
              <button onClick={() => updateWB({ terminology: wb.terminology.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive mt-1">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => updateWB({ terminology: [...wb.terminology, { id: generateId(), term: '', reading: '', definition: '' }] })} className="gap-1 text-xs">
              <Plus className="h-3 w-3" /> 用語追加
            </Button>
            <AiButton section="terminology" loading={aiLoading} onGenerate={handleAiGenerate} />
          </div>
        </Section>

        {/* History */}
        <Section icon={ScrollText} title="歴史" description="世界の歴史・背景" isOpen={openSections.has('history')} onToggle={() => toggleSection('history')}>
          <Textarea value={wb.history} onChange={(e) => updateWB({ history: e.target.value })} rows={4} placeholder="この世界の歴史的背景、重要な出来事..." className="text-xs" />
          <AiButton section="history" loading={aiLoading} onGenerate={handleAiGenerate} />
        </Section>

        {/* Info asymmetry */}
        <Section icon={Eye} title="情報非対称" description="読者と登場人物の情報差" isOpen={openSections.has('infoAsymmetry')} onToggle={() => toggleSection('infoAsymmetry')}>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-muted-foreground">登場人物が知っていること</label>
              <Textarea value={wb.infoAsymmetry.commonKnowledge} onChange={(e) => updateWB({ infoAsymmetry: { ...wb.infoAsymmetry, commonKnowledge: e.target.value } })} rows={2} placeholder="世界の常識として認識されていること" className="text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">隠された真実</label>
              <Textarea value={wb.infoAsymmetry.hiddenTruths} onChange={(e) => updateWB({ infoAsymmetry: { ...wb.infoAsymmetry, hiddenTruths: e.target.value } })} rows={2} placeholder="読者だけが知っている（あるいは誰も知らない）真実" className="text-xs" />
            </div>
          </div>
        </Section>

        {/* Items */}
        <Section icon={Sword} title="重要アイテム" description="物語の鍵となるアイテム" isOpen={openSections.has('items')} onToggle={() => toggleSection('items')}>
          {wb.items.map((item, i) => (
            <div key={item.id} className="p-2 border border-border/50 rounded-lg space-y-1.5">
              <div className="flex gap-2">
                <Input value={item.name} onChange={(e) => {
                  const updated = [...wb.items]; updated[i] = { ...item, name: e.target.value }; updateWB({ items: updated });
                }} placeholder="アイテム名" className="h-7 text-xs flex-1" />
                <button onClick={() => updateWB({ items: wb.items.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Input value={item.appearance} onChange={(e) => {
                  const updated = [...wb.items]; updated[i] = { ...item, appearance: e.target.value }; updateWB({ items: updated });
                }} placeholder="外見" className="h-7 text-xs" />
                <Input value={item.ability} onChange={(e) => {
                  const updated = [...wb.items]; updated[i] = { ...item, ability: e.target.value }; updateWB({ items: updated });
                }} placeholder="能力・効果" className="h-7 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Input value={item.constraints} onChange={(e) => {
                  const updated = [...wb.items]; updated[i] = { ...item, constraints: e.target.value }; updateWB({ items: updated });
                }} placeholder="制約・コスト" className="h-7 text-xs" />
                <Input value={item.owner} onChange={(e) => {
                  const updated = [...wb.items]; updated[i] = { ...item, owner: e.target.value }; updateWB({ items: updated });
                }} placeholder="所有者" className="h-7 text-xs" />
              </div>
              <Input value={item.narrativeMeaning} onChange={(e) => {
                const updated = [...wb.items]; updated[i] = { ...item, narrativeMeaning: e.target.value }; updateWB({ items: updated });
              }} placeholder="物語上の意味" className="h-7 text-xs" />
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => updateWB({ items: [...wb.items, { id: generateId(), name: '', appearance: '', ability: '', constraints: '', owner: '', narrativeMeaning: '' }] })} className="gap-1 text-xs">
              <Plus className="h-3 w-3" /> アイテム追加
            </Button>
            <AiButton section="items" loading={aiLoading} onGenerate={handleAiGenerate} />
          </div>
        </Section>
      </div>

      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground leading-relaxed">
          すべてのセクションを埋める必要はありません。物語に必要な設定だけ入力してください。
          作成後にも世界観設定は追加・編集できます。
        </p>
      </div>
    </div>
  );
}

function AiButton({
  section,
  loading,
  onGenerate,
}: {
  section: string;
  loading: string | null;
  onGenerate: (section: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onGenerate(section)}
      disabled={loading !== null}
      className="gap-1 text-xs"
    >
      <Sparkles className="h-3 w-3" />
      {loading === section ? '考え中...' : 'AIに提案'}
    </Button>
  );
}

function parseWorldBuildingJson(raw: string): any {
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
  } catch { /* skip */ }
  return null;
}

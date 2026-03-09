'use client';

import { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import type { WizardData } from './wizard-shell';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

interface AiPlot {
  premise?: string;
  threeActStructure?: {
    act1?: { title: string; summary: string; keyEvents?: string[] };
    act2?: { title: string; summary: string; keyEvents?: string[] };
    act3?: { title: string; summary: string; keyEvents?: string[] };
  };
  centralConflict?: string;
  themes?: string[];
  turningPoints?: string[];
  suggestions?: string;
}

function parseAiPlot(raw: string): AiPlot | null {
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function plotToText(plot: AiPlot): string {
  const parts: string[] = [];
  if (plot.premise) parts.push(`【前提】${plot.premise}`);
  if (plot.centralConflict) parts.push(`【中心的葛藤】${plot.centralConflict}`);
  if (plot.threeActStructure) {
    const s = plot.threeActStructure;
    if (s.act1) parts.push(`【第一幕: ${s.act1.title}】\n${s.act1.summary}${s.act1.keyEvents?.length ? '\n- ' + s.act1.keyEvents.join('\n- ') : ''}`);
    if (s.act2) parts.push(`【第二幕: ${s.act2.title}】\n${s.act2.summary}${s.act2.keyEvents?.length ? '\n- ' + s.act2.keyEvents.join('\n- ') : ''}`);
    if (s.act3) parts.push(`【第三幕: ${s.act3.title}】\n${s.act3.summary}${s.act3.keyEvents?.length ? '\n- ' + s.act3.keyEvents.join('\n- ') : ''}`);
  }
  if (plot.turningPoints?.length) parts.push(`【転換点】\n- ${plot.turningPoints.join('\n- ')}`);
  if (plot.themes?.length) parts.push(`【テーマ】${plot.themes.join('、')}`);
  return parts.join('\n\n');
}

export function StepPlotArchitect({ data, onChange }: Props) {
  // Restore text from saved plotOutline
  const savedText = typeof data.plotOutline === 'string'
    ? data.plotOutline
    : data.plotOutline?.text || '';
  const savedAiData = data.plotOutline?.aiData as AiPlot | undefined;

  const [ownIdeas, setOwnIdeas] = useState(savedText);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRaw, setAiRaw] = useState('');
  const [aiParsed, setAiParsed] = useState<AiPlot | null>(savedAiData || null);
  const [adopted, setAdopted] = useState(!!savedAiData);

  function saveOwnIdeas(text: string) {
    setOwnIdeas(text);
    onChange({ plotOutline: { text, aiAssisted: false, aiData: aiParsed } });
  }

  function adoptPlot() {
    if (!aiParsed) return;
    const text = plotToText(aiParsed);
    setOwnIdeas(text);
    onChange({ plotOutline: { text, aiAssisted: true, aiData: aiParsed } });
    setAdopted(true);
  }

  async function handleAiSuggest() {
    setAiLoading(true);
    setAiRaw('');
    setAiParsed(null);
    setAdopted(false);
    let accumulated = '';
    try {
      const themes = data.coreMessage || ownIdeas || 'ストーリーのプロットを提案してください';

      const res = await api.fetchSSE('/works/none/creation/plot', {
        themes,
        message: data.targetEmotions || undefined,
        emotionGoals: data.readerJourney || undefined,
        characters: data.characters.length > 0 ? data.characters : undefined,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') continue;
          try {
            const parsed = JSON.parse(d);
            if (parsed.text) {
              accumulated += parsed.text;
              setAiRaw(accumulated);
            }
          } catch { /* skip */ }
        }
      }
      // Process remaining buffer
      if (buffer.trim()) {
        const remaining = buffer.trim();
        if (remaining.startsWith('data: ')) {
          const d = remaining.slice(6).trim();
          if (d !== '[DONE]') {
            try {
              const parsed = JSON.parse(d);
              if (parsed.text) {
                accumulated += parsed.text;
                setAiRaw(accumulated);
              }
            } catch { /* skip */ }
          }
        }
      }
      const result = parseAiPlot(accumulated);
      if (result) {
        setAiParsed(result);
        // Auto-save AI data to wizard state so it persists across step navigation
        const text = plotToText(result);
        setOwnIdeas(text);
        onChange({ plotOutline: { text, aiAssisted: true, aiData: result } });
        setAdopted(true);
      }
    } catch (err) {
      setAiRaw(`AIの提案を取得できませんでした。${err instanceof Error ? `\n${err.message}` : ''}`);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">プロット</h2>
        <p className="text-sm text-muted-foreground">
          物語の骨格を組み立てましょう。起承転結、三幕構成、自由形式 — あなたのスタイルで。
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">あなたのプロット構想</label>
        <Textarea
          value={ownIdeas}
          onChange={(e) => saveOwnIdeas(e.target.value)}
          rows={8}
          placeholder={`例：
【起】主人公の日常と、それを壊す出来事
【承】新たな世界での試練と成長
【転】信じていたものが崩れる瞬間
【結】本当の強さを見つけ、元の世界に帰る`}
        />
      </div>

      <div className="border-t border-border pt-6 space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          AIに構成を相談する
        </h3>
        <p className="text-xs text-muted-foreground">
          これまでの設定（テーマ、キャラクター、感情設計）をもとに、AIがプロットのアイデアを提案します。
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAiSuggest}
          disabled={aiLoading}
          className="gap-1"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {aiLoading ? '考え中...' : 'AIに提案してもらう'}
        </Button>

        {aiLoading && aiRaw && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">生成中...</p>
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground max-h-40 overflow-y-auto">{aiRaw.slice(0, 200)}...</div>
          </div>
        )}

        {!aiLoading && aiParsed && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {adopted ? 'AIの提案をプロット構想に反映しました。上のテキストを自由に編集できます。' : 'AIの提案（プロット構想に取り入れましょう）'}
              </p>
              {!adopted && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={adoptPlot}
                  className="gap-1 text-xs"
                >
                  構想に反映
                </Button>
              )}
            </div>

            <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-3">
              {aiParsed.premise && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">前提</p>
                  <p className="text-sm">{aiParsed.premise}</p>
                </div>
              )}
              {aiParsed.centralConflict && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">中心的葛藤</p>
                  <p className="text-sm">{aiParsed.centralConflict}</p>
                </div>
              )}
              {aiParsed.threeActStructure && (
                <div className="space-y-2">
                  {(['act1', 'act2', 'act3'] as const).map((key, i) => {
                    const act = aiParsed.threeActStructure?.[key];
                    if (!act) return null;
                    return (
                      <div key={key} className="pl-3 border-l-2 border-primary/30">
                        <p className="text-xs font-medium">第{i + 1}幕: {act.title}</p>
                        <p className="text-xs text-muted-foreground">{act.summary}</p>
                        {act.keyEvents?.length ? (
                          <ul className="text-xs text-muted-foreground mt-1 list-disc list-inside">
                            {act.keyEvents.map((e, j) => <li key={j}>{e}</li>)}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
              {aiParsed.turningPoints?.length ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">転換点</p>
                  <ul className="text-xs text-muted-foreground list-disc list-inside">
                    {aiParsed.turningPoints.map((tp, i) => <li key={i}>{tp}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>

            {aiParsed.suggestions && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800/50">
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">構成アドバイス</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 whitespace-pre-wrap">{aiParsed.suggestions}</p>
              </div>
            )}
          </div>
        )}

        {!aiLoading && aiRaw && !aiParsed && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">AIの提案:</p>
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{aiRaw}</div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Sparkles, Plus, Trash2, GripVertical, ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import type { WizardData } from './wizard-shell';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

interface Chapter {
  title: string;
  summary: string;
  aiSuggested: boolean;
}

interface AiChapter {
  number?: number;
  title: string;
  summary: string;
  keyScenes?: string[];
  emotionTarget?: string;
  wordCountEstimate?: number;
}

function parseAiChapters(raw: string): { chapters: AiChapter[]; suggestions: string } | null {
  // Strip markdown code fences and any leading/trailing text around JSON
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  // Strategy 1: Find JSON object with "chapters" array
  try {
    const objStart = cleaned.indexOf('{');
    const objEnd = cleaned.lastIndexOf('}');
    if (objStart !== -1 && objEnd > objStart) {
      const json = JSON.parse(cleaned.slice(objStart, objEnd + 1));
      if (json.chapters && Array.isArray(json.chapters) && json.chapters.length > 0) {
        return {
          chapters: json.chapters,
          suggestions: json.suggestions || json.pacing || '',
        };
      }
    }
  } catch { /* try next strategy */ }

  // Strategy 2: Find JSON array directly (AI returns [{...}, {...}])
  try {
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd > arrStart) {
      const arr = JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
      if (Array.isArray(arr) && arr.length > 0 && arr[0].title) {
        return { chapters: arr, suggestions: '' };
      }
    }
  } catch { /* try next strategy */ }

  // Strategy 3: Multiple JSON objects separated by text (AI outputs each chapter as separate JSON)
  try {
    const jsonObjects: AiChapter[] = [];
    const regex = /\{[^{}]*"title"\s*:\s*"[^"]*"[^{}]*\}/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(cleaned)) !== null) {
      try {
        const obj = JSON.parse(match[0]);
        if (obj.title) jsonObjects.push(obj);
      } catch { /* skip individual parse failures */ }
    }
    if (jsonObjects.length > 0) {
      return { chapters: jsonObjects, suggestions: '' };
    }
  } catch { /* skip */ }

  // Strategy 4: Extract structured data from plain text (fallback)
  try {
    const chapters: AiChapter[] = [];
    // Match patterns like "第1話: タイトル" or "第1話「タイトル」" or "Chapter 1: Title"
    const chapterRegex = /(?:第(\d+)話|Chapter\s*(\d+))[：:\s「]*([^」\n]+)[」]?\s*\n([\s\S]*?)(?=(?:第\d+話|Chapter\s*\d+|$))/gi;
    let m: RegExpExecArray | null;
    while ((m = chapterRegex.exec(cleaned)) !== null) {
      const num = parseInt(m[1] || m[2], 10);
      const title = m[3].trim();
      const summary = m[4].trim().split('\n').filter(Boolean).join(' ');
      if (title) chapters.push({ number: num, title, summary });
    }
    if (chapters.length > 0) {
      return { chapters, suggestions: '' };
    }
  } catch { /* skip */ }

  return null;
}

export function StepChapterOutline({ data, onChange }: Props) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRaw, setAiRaw] = useState('');
  const [aiParsed, setAiParsed] = useState<{ chapters: AiChapter[]; suggestions: string } | null>(
    data._aiChapterSuggestions || null
  );
  const chapters = (data.chapterOutline || []) as Chapter[];

  function addChapter() {
    onChange({
      chapterOutline: [...chapters, { title: '', summary: '', aiSuggested: false }],
    });
  }

  function updateChapter(index: number, field: keyof Chapter, value: string) {
    const updated = [...chapters];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ chapterOutline: updated });
  }

  function removeChapter(index: number) {
    onChange({ chapterOutline: chapters.filter((_, i) => i !== index) });
  }

  function adoptChapter(ai: AiChapter) {
    const summary = [
      ai.summary,
      ai.keyScenes?.length ? `\nキーシーン: ${ai.keyScenes.join('、')}` : '',
      ai.emotionTarget ? `\n感情目標: ${ai.emotionTarget}` : '',
    ].join('');
    onChange({
      chapterOutline: [...chapters, { title: ai.title, summary, aiSuggested: true }],
    });
  }

  function adoptAllChapters() {
    if (!aiParsed) return;
    const newChapters = aiParsed.chapters.map((ai) => {
      const summary = [
        ai.summary,
        ai.keyScenes?.length ? `\nキーシーン: ${ai.keyScenes.join('、')}` : '',
        ai.emotionTarget ? `\n感情目標: ${ai.emotionTarget}` : '',
      ].join('');
      return { title: ai.title, summary, aiSuggested: true };
    });
    onChange({ chapterOutline: [...chapters, ...newChapters] });
  }

  function applyParsedResult(result: { chapters: AiChapter[]; suggestions: string }) {
    setAiParsed(result);
    const currentChapters = (data.chapterOutline || []) as Chapter[];
    const newChapters = result.chapters.map((ai) => {
      const summary = [
        ai.summary,
        ai.keyScenes?.length ? `\nキーシーン: ${ai.keyScenes.join('、')}` : '',
        ai.emotionTarget ? `\n感情目標: ${ai.emotionTarget}` : '',
      ].join('');
      return { title: ai.title, summary, aiSuggested: true };
    });
    onChange({
      chapterOutline: [...currentChapters, ...newChapters],
      _aiChapterSuggestions: result,
    });
  }

  async function handleAiSuggest() {
    setAiLoading(true);
    setAiRaw('');
    setAiParsed(null);
    let accumulated = '';
    let serverParsed: { chapters: AiChapter[]; suggestions: string } | null = null;
    try {
      const res = await api.fetchSSE('/works/none/creation/chapters', {
        plotOutline: data.plotOutline || undefined,
        characters: data.characters.length > 0 ? data.characters : undefined,
        emotionBlueprint: data.coreMessage ? {
          coreMessage: data.coreMessage,
          targetEmotions: data.targetEmotions,
          readerJourney: data.readerJourney,
        } : undefined,
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
            const event = JSON.parse(d);
            if (event.text) {
              accumulated += event.text;
              setAiRaw(accumulated);
            }
            // Backend sends parsed chapters as a structured event
            if (event.parsed) {
              serverParsed = event.parsed;
            }
          } catch { /* skip */ }
        }
      }
      // Process remaining buffer
      if (buffer.trim()) {
        for (const line of buffer.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') continue;
          try {
            const event = JSON.parse(d);
            if (event.text) { accumulated += event.text; setAiRaw(accumulated); }
            if (event.parsed) serverParsed = event.parsed;
          } catch { /* skip */ }
        }
      }

      // Priority: use server-parsed data, then try client-side parsing as fallback
      const result = serverParsed || parseAiChapters(accumulated);
      if (result) {
        applyParsedResult(result);
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
        <h2 className="text-lg font-semibold mb-1">章立て</h2>
        <p className="text-sm text-muted-foreground">
          各章（エピソード）の概要を設計しましょう。作成後、この骨格をもとに執筆を始められます。
        </p>
      </div>

      <div className="space-y-3">
        {chapters.map((ch, i) => (
          <div key={i} className="flex gap-2 items-start p-3 border border-border rounded-lg">
            <GripVertical className="h-4 w-4 text-muted-foreground/30 mt-2 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-12">第{i + 1}話</span>
                <Input
                  value={ch.title}
                  onChange={(e) => updateChapter(i, 'title', e.target.value)}
                  placeholder="章タイトル"
                  className="text-sm h-8"
                />
                <button onClick={() => removeChapter(i)} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Textarea
                value={ch.summary}
                onChange={(e) => updateChapter(i, 'summary', e.target.value)}
                placeholder="この章で何が起きるか"
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addChapter} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          章を追加
        </Button>
      </div>

      <div className="border-t border-border pt-6 space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          AIに章立てを提案してもらう
        </h3>
        <p className="text-xs text-muted-foreground">
          プロットとキャラクター設定をもとに、AIが章の構成案を提案します。
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
                {chapters.some((c) => c.aiSuggested)
                  ? 'AIの提案を章立てに反映しました。上の一覧を自由に編集できます。'
                  : 'AIの提案（気に入った章を採用しましょう）'}
              </p>
              {!chapters.some((c) => c.aiSuggested) && (
                <Button variant="outline" size="sm" onClick={adoptAllChapters} className="gap-1 text-xs">
                  <ListPlus className="h-3 w-3" />
                  すべて採用
                </Button>
              )}
            </div>
            {aiParsed.chapters.map((ai, i) => {
              const alreadyAdopted = chapters.some((c) => c.title === ai.title);
              return (
                <div key={i} className="p-3 bg-muted/30 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      第{ai.number ?? i + 1}話: {ai.title}
                    </span>
                    <Button
                      variant={alreadyAdopted ? 'ghost' : 'secondary'}
                      size="sm"
                      onClick={() => adoptChapter(ai)}
                      disabled={alreadyAdopted}
                      className="gap-1 text-xs"
                    >
                      <Plus className="h-3 w-3" /> {alreadyAdopted ? '採用済み' : '採用'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{ai.summary}</p>
                  {ai.keyScenes && ai.keyScenes.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">キーシーン: {ai.keyScenes.join('、')}</p>
                  )}
                  {ai.emotionTarget && (
                    <p className="text-xs text-muted-foreground mt-0.5">感情: {ai.emotionTarget}</p>
                  )}
                  {ai.wordCountEstimate && (
                    <p className="text-xs text-muted-foreground mt-0.5">目安: {ai.wordCountEstimate.toLocaleString()}字</p>
                  )}
                </div>
              );
            })}
            {aiParsed.suggestions && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800/50">
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">構成アドバイス</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 whitespace-pre-wrap">{aiParsed.suggestions}</p>
              </div>
            )}
          </div>
        )}

        {!aiLoading && aiRaw && !aiParsed && (
          <div className="space-y-2">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800/50">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">自動解析できませんでした</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">下の提案を参考に、手動で章を追加してください。</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{aiRaw}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

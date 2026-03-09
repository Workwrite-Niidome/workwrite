'use client';

import { useState } from 'react';
import { Sparkles, Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

export function StepChapterOutline({ data, onChange }: Props) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
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

  async function handleAiSuggest() {
    setAiLoading(true);
    setAiSuggestion('');
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/works/none/creation/chapters`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify({
            plotOutline: data.plotOutline,
            characters: data.characters.length > 0 ? data.characters : undefined,
            emotionBlueprint: data.coreMessage ? {
              coreMessage: data.coreMessage,
              targetEmotions: data.targetEmotions,
              readerJourney: data.readerJourney,
            } : undefined,
          }),
        }
      );
      const text = await res.text();
      setAiSuggestion(text);
    } catch {
      setAiSuggestion('AIの提案を取得できませんでした。');
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
        {aiSuggestion && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">AIの提案（参考にして自分の章立てを作りましょう）:</p>
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{aiSuggestion}</div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { WizardData } from './wizard-shell';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

export function StepPlotArchitect({ data, onChange }: Props) {
  const [ownIdeas, setOwnIdeas] = useState(
    typeof data.plotOutline === 'string' ? data.plotOutline : data.plotOutline?.text || ''
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');

  function saveOwnIdeas(text: string) {
    setOwnIdeas(text);
    onChange({ plotOutline: { text, aiAssisted: false } });
  }

  async function handleAiSuggest() {
    setAiLoading(true);
    setAiSuggestion('');
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/works/none/creation/plot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify({
            themes: data.coreMessage || ownIdeas,
            message: data.targetEmotions,
            emotionGoals: data.readerJourney,
            characters: data.characters.length > 0 ? data.characters : undefined,
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
        {aiSuggestion && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">AIの提案（あなたの構想に取り入れてみてください）:</p>
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{aiSuggestion}</div>
          </div>
        )}
      </div>
    </div>
  );
}

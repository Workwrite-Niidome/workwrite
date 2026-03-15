'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { consumeSSEStream } from '@/lib/use-ai-stream';
import type { WizardData } from './wizard-shell';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

export function StepTitleSynopsis({ data, onChange }: Props) {
  const [aiLoading, setAiLoading] = useState(false);

  const hasContextForAi = data.characters.length > 0 || data.actGroups.length > 0 || data.coreMessage || data.inspiration;

  async function handleAiSynopsis() {
    setAiLoading(true);
    try {
      const context: string[] = [];
      if (data.genre) context.push(`ジャンル: ${data.genre}`);
      if (data.coreMessage) context.push(`テーマ: ${data.coreMessage}`);
      if (data.inspiration) context.push(`インスピレーション: ${data.inspiration}`);
      if (data.characters.length > 0) {
        const charNames = data.characters.map((c: any) => `${c.name}(${c.role || ''})`).join(', ');
        context.push(`キャラクター: ${charNames}`);
      }
      if (data.actGroups.length > 0) {
        const plotSummary = data.actGroups.map(g =>
          `${g.label}: ${g.episodes.map(e => e.title).join(', ')}`
        ).join(' / ');
        context.push(`プロット: ${plotSummary}`);
      }
      if (data.title) context.push(`タイトル: ${data.title}`);

      const res = await api.fetchSSE('/works/none/creation/synopsis', {
        context: context.join('\n'),
      });
      let accumulated = '';
      await consumeSSEStream(res, (event) => {
        if (event.text) {
          accumulated += event.text;
          onChange({ synopsis: accumulated });
        }
      });
    } catch (err) {
      console.error('Failed to generate synopsis:', err);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">タイトル・あらすじ</h2>
        <p className="text-sm text-muted-foreground">
          キャラクターやプロットが固まった今、物語にふさわしいタイトルとあらすじを付けましょう。
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">タイトル *</label>
        <Input
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="作品タイトル"
        />
        <p className="text-xs text-muted-foreground">作品を作成するにはタイトルが必要です。</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">あらすじ</label>
          {hasContextForAi && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAiSynopsis}
              disabled={aiLoading}
              className="gap-1 text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiLoading ? '生成中...' : 'AIに提案してもらう'}
            </Button>
          )}
        </div>
        <Textarea
          value={data.synopsis}
          onChange={(e) => onChange({ synopsis: e.target.value })}
          rows={6}
          maxLength={5000}
          placeholder="読者を引き込むあらすじを書きましょう。プロットやキャラクター設定をもとにAIに提案してもらうこともできます。"
        />
      </div>

      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground leading-relaxed">
          あらすじは読者が最初に目にする紹介文です。
          プロットの全容ではなく、読者の興味を引く「入口」として書くのがコツです。
          作成後にいつでも変更できます。
        </p>
      </div>
    </div>
  );
}

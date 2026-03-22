'use client';

import { Bot } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import type { DesignData } from './types';

interface Props {
  design: DesignData;
  onChange: (d: Partial<DesignData>) => void;
}

function FieldLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium">{label}</label>
      <button
        type="button"
        className="text-[10px] text-muted-foreground hover:text-indigo-500 transition-colors flex items-center gap-0.5"
      >
        <Bot className="h-3 w-3" /> AIに修正させる
      </button>
    </div>
  );
}

export function OverviewTab({ design, onChange }: Props) {
  const hasContent = !!(design.genre || design.theme || design.afterReading || design.tone || design.episodeCount);

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
          <Bot className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          AIとの対話で概要が抽出されるとここに表示されます
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-1.5">
            <FieldLabel label="ジャンル" />
            <Input
              value={design.genre || ''}
              onChange={(e) => onChange({ genre: e.target.value })}
              placeholder="例: ダークファンタジー"
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel label="テーマ" />
            <Textarea
              value={design.theme || ''}
              onChange={(e) => onChange({ theme: e.target.value })}
              placeholder="作品の中心テーマ"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel label="読後感" />
            <Textarea
              value={design.afterReading || ''}
              onChange={(e) => onChange({ afterReading: e.target.value })}
              placeholder="読者に届けたい感情"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel label="トーン" />
            <Textarea
              value={design.tone || ''}
              onChange={(e) => onChange({ tone: e.target.value })}
              placeholder="文体・雰囲気"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">話数</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={design.episodeCount || ''}
                onChange={(e) => onChange({ episodeCount: Number(e.target.value) || undefined })}
                placeholder="例: 10"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">文字数目安</label>
              <Input
                type="number"
                min={500}
                max={20000}
                step={500}
                value={design.charCountPerEpisode || ''}
                onChange={(e) => onChange({ charCountPerEpisode: Number(e.target.value) || undefined })}
                placeholder="例: 3000"
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

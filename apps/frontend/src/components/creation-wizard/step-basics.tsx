'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { WizardData } from './wizard-shell';

const GENRES = [
  'fantasy', 'sf', 'mystery', 'romance', 'horror', 'literary',
  'adventure', 'comedy', 'drama', 'historical', 'other',
];
const GENRE_LABELS: Record<string, string> = {
  fantasy: 'ファンタジー', sf: 'SF', mystery: 'ミステリー', romance: '恋愛',
  horror: 'ホラー', literary: '文芸', adventure: '冒険', comedy: 'コメディ',
  drama: 'ドラマ', historical: '歴史', other: 'その他',
};

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

export function StepBasics({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">基本情報</h2>
        <p className="text-sm text-muted-foreground">あなたの作品の土台を作りましょう。</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">タイトル *</label>
        <Input
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="作品タイトル"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">あらすじ</label>
        <Textarea
          value={data.synopsis}
          onChange={(e) => onChange({ synopsis: e.target.value })}
          rows={4}
          maxLength={5000}
          placeholder="読者を引き込むあらすじを書きましょう"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">ジャンル</label>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onChange({ genre: data.genre === g ? '' : g })}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-colors',
                data.genre === g
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:border-primary/50 text-foreground',
              )}
            >
              {GENRE_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">タグ（カンマ区切り）</label>
        <Input
          value={data.tags}
          onChange={(e) => onChange({ tags: e.target.value })}
          placeholder="冒険, 成長, 友情"
        />
      </div>
    </div>
  );
}

'use client';

import { Input } from '@/components/ui/input';
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

export function StepGenreTags({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">ジャンル・タグ</h2>
        <p className="text-sm text-muted-foreground">あなたの作品のジャンルとタグを選びましょう。後のステップでジャンルに合った設定テンプレートが提案されます。</p>
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

      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground leading-relaxed">
          ジャンルを選ぶと、キャラクター設定や世界観ステップでジャンルに合ったテンプレートが自動で提案されます。
          後からいつでも変更できます。
        </p>
      </div>
    </div>
  );
}

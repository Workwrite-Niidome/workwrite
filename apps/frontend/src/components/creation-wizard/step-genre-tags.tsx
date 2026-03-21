'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { WizardData } from './wizard-shell';

const MAIN_GENRES = [
  { key: 'fantasy', label: 'ファンタジー' },
  { key: 'sf', label: 'SF・近未来' },
  { key: 'modern', label: '現代・日常' },
  { key: 'historical', label: '歴史・時代' },
];

const SUB_GENRES = [
  { key: 'romance', label: '恋愛' },
  { key: 'mystery', label: 'ミステリー' },
  { key: 'horror', label: 'ホラー' },
  { key: 'action', label: 'アクション' },
  { key: 'drama', label: 'ヒューマンドラマ' },
  { key: 'comedy', label: 'コメディ' },
  { key: 'adventure', label: '冒険' },
  { key: 'literary', label: '文芸' },
  { key: 'thriller', label: 'サスペンス' },
];

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

export function StepGenreTags({ data, onChange }: Props) {
  const subGenres: string[] = (data as any).subGenres || [];

  function toggleSubGenre(key: string) {
    const current = [...subGenres];
    const idx = current.indexOf(key);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(key);
    }
    onChange({ subGenres: current } as any);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">ジャンル</h2>
        <p className="text-sm text-muted-foreground">作品の舞台となる大ジャンルと、テーマとなるサブジャンルを選んでください。</p>
      </div>

      {/* Main Genre (single select) */}
      <div className="space-y-2">
        <label className="text-sm font-medium">大ジャンル（舞台）</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MAIN_GENRES.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => onChange({ genre: data.genre === g.key ? '' : g.key })}
              className={cn(
                'px-4 py-3 rounded-lg text-sm font-medium border transition-all',
                data.genre === g.key
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'border-border hover:border-primary/50 text-foreground hover:bg-muted/50',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub Genres (multiple select) */}
      <div className="space-y-2">
        <label className="text-sm font-medium">サブジャンル（テーマ・複数選択可）</label>
        <div className="flex flex-wrap gap-2">
          {SUB_GENRES.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => toggleSubGenre(g.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-colors',
                subGenres.includes(g.key)
                  ? 'bg-primary/10 text-primary border-primary/30 font-medium'
                  : 'border-border hover:border-primary/50 text-foreground',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <label className="text-sm font-medium">タグ（自由入力・カンマ区切り）</label>
        <Input
          value={data.tags}
          onChange={(e) => onChange({ tags: e.target.value })}
          placeholder="異世界転生, 成長, 友情, ダークファンタジー"
        />
        <p className="text-[10px] text-muted-foreground">作品の特徴を表すキーワードを入力してください。読者が作品を見つけやすくなります。</p>
      </div>

      {/* Selected summary */}
      {(data.genre || subGenres.length > 0) && (
        <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
          {data.genre && (
            <span className="font-medium text-foreground">
              {MAIN_GENRES.find((g) => g.key === data.genre)?.label}
            </span>
          )}
          {subGenres.length > 0 && (
            <span>
              {data.genre ? ' × ' : ''}
              {subGenres.map((k) => SUB_GENRES.find((g) => g.key === k)?.label).filter(Boolean).join('・')}
            </span>
          )}
          <p className="mt-1">ジャンルに合ったキャラクター設定や世界観テンプレートが次のステップで提案されます。</p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

const GENRES = [
  'fantasy', 'sf', 'mystery', 'romance', 'horror', 'literary',
  'adventure', 'comedy', 'drama', 'historical', 'other',
];
const GENRE_LABELS: Record<string, string> = {
  fantasy: 'ファンタジー', sf: 'SF', mystery: 'ミステリー', romance: '恋愛',
  horror: 'ホラー', literary: '文芸', adventure: '冒険', comedy: 'コメディ',
  drama: 'ドラマ', historical: '歴史', other: 'その他',
};

export default function NewWorkPage() {
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [genre, setGenre] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const tags = tagInput.split(/[,、\s]+/).filter(Boolean);
      const res = await api.createWork({ title, synopsis, genre, tags });
      router.push(`/works/${res.data.id}/edit`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>新規作品</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>}
            <div className="space-y-2">
              <label className="text-sm font-medium">タイトル *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="作品タイトル" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">あらすじ</label>
              <Textarea
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                rows={5}
                maxLength={5000}
                placeholder="作品のあらすじを書きましょう"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">ジャンル</label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenre(genre === g ? '' : g)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm border transition-colors min-h-[44px]',
                      genre === g
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
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="冒険, 成長, 友情" />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? '作成中...' : '作品を作成'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wand2, Zap, Sparkles, Users, GitBranch, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { WizardShell } from '@/components/creation-wizard/wizard-shell';

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
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-4 py-12 text-center text-muted-foreground">読み込み中...</div>}>
      <NewWorkPageInner />
    </Suspense>
  );
}

function NewWorkPageInner() {
  const searchParams = useSearchParams();
  const urlMode = searchParams.get('mode');
  const urlDraft = searchParams.get('draft');
  const [mode, setMode] = useState<'choose' | 'quick' | 'wizard'>(
    urlMode === 'wizard' || urlDraft ? 'wizard' : urlMode === 'quick' ? 'quick' : 'choose'
  );

  if (mode === 'wizard') {
    return <WizardShell />;
  }

  if (mode === 'quick') {
    return <QuickCreate onBack={() => setMode('choose')} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-center mb-2">新規作品を作成</h1>
      <p className="text-sm text-muted-foreground text-center mb-8">
        あなたの物語を始めましょう
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <button
          onClick={() => setMode('wizard')}
          className="group relative p-6 rounded-xl border-2 border-primary/30 hover:border-primary transition-colors text-left space-y-4 bg-primary/[0.02]"
        >
          <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-medium rounded-full flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            おすすめ
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Wand2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold mb-1.5">じっくり設計する</h2>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              AIと対話しながら作品の骨格を設計。キャラクター・プロット・感情設計を6ステップで形にします。
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] text-foreground/70">
                <Users className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                <span>キャラの口調・性格をAIが一貫して守る</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-foreground/70">
                <GitBranch className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                <span>プロット構成に沿った執筆サポート</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-foreground/70">
                <Brain className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                <span>設定を活かした高品質なAI提案</span>
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setMode('quick')}
          className="group p-6 rounded-xl border border-border hover:border-primary/50 transition-colors text-left space-y-4"
        >
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-muted/80 transition-colors">
            <Zap className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-semibold mb-1.5">すぐに書き始める</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              タイトルだけ決めて、すぐに執筆を開始。
              設定は後からいつでも追加できます。
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-2">
              ※ AI支援の精度は設計モードより限定的です
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

function QuickCreate({ onBack }: { onBack: () => void }) {
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
          <div className="flex items-center justify-between">
            <CardTitle>クイック作成</CardTitle>
            <Button variant="ghost" size="sm" onClick={onBack}>
              戻る
            </Button>
          </div>
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

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Wand2, Zap, Sparkles, Users, GitBranch, Brain, Bot, Crown, AlertTriangle, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { WizardShell } from '@/components/creation-wizard/wizard-shell';
import { sharedWorldApi } from '@/lib/shared-world-api';

import { GENRE_LABELS } from '@/lib/constants';

const GENRES = Object.keys(GENRE_LABELS);

export default function NewWorkPage() {
  return (
    <Suspense fallback={<div className="px-4 py-12 text-center text-muted-foreground">読み込み中...</div>}>
      <NewWorkPageInner />
    </Suspense>
  );
}

function NewWorkPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const urlMode = searchParams.get('mode');
  const urlDraft = searchParams.get('draft');
  const [mode, setMode] = useState<'choose' | 'quick' | 'wizard'>(
    urlMode === 'wizard' || urlDraft ? 'wizard' : urlMode === 'quick' ? 'quick' : 'choose'
  );
  const [myWorlds, setMyWorlds] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      sharedWorldApi.listMy().then((data) => setMyWorlds(data)).catch(() => {});
    }
  }, [user?.role]);

  if (mode === 'wizard') {
    return <WizardShell />;
  }

  if (mode === 'quick') {
    return <QuickCreate onBack={() => setMode('choose')} />;
  }

  return (
    <div className="px-4 py-12">
      <h1 className="text-2xl font-bold text-center mb-2">新規作品を作成</h1>
      <p className="text-sm text-muted-foreground text-center mb-8">
        あなたの物語を始めましょう
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

        <button
          onClick={() => router.push('/works/new/editor-mode')}
          className="group p-6 rounded-xl border border-border hover:border-primary/50 transition-colors text-left space-y-4"
        >
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-muted/80 transition-colors">
            <Bot className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-semibold mb-1.5">編集者モード</h2>
            <p className="text-xs text-muted-foreground leading-relaxed mb-2">
              AIが全話を執筆、あなたは編集者としてAIと協創する
            </p>
            <p className="text-[10px] text-muted-foreground/60 mb-2">
              高精度モード推奨
            </p>
            <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
              ※ AI Generated バッジが付きます。話の間に齟齬が生じる可能性があります。
            </p>
          </div>
        </button>

        {user?.role === 'ADMIN' && myWorlds.length > 0 && (
          <button
            onClick={() => {
              const world = myWorlds[0];
              router.push(`/shared-world/${world.id}`);
            }}
            className="group p-6 rounded-xl border border-dashed border-primary/30 hover:border-primary/50 transition-colors text-left space-y-4"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Globe className="h-5 w-5 text-primary/60" />
            </div>
            <div>
              <h2 className="font-semibold mb-1.5">共有世界から作成</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                既存の世界を舞台に、新しい物語を書く。
                キャラクターや世界設定が共有されます。
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-2">
                {myWorlds.length}つの共有世界が利用可能
              </p>
            </div>
          </button>
        )}
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
    <div className="px-4 py-8">
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

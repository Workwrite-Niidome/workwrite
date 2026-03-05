'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { api } from '@/lib/api';

export default function NewEpisodePage() {
  const params = useParams();
  const workId = params.id as string;
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const wordCount = content.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createEpisode(workId, { title, content });
      router.push(`/works/${workId}/edit`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '投稿に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>エピソード投稿</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>}
            <div className="space-y-2">
              <label className="text-sm font-medium">タイトル *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="第一章 旅立ち" required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">本文 *</label>
                <span className="text-xs text-muted-foreground">{wordCount.toLocaleString()} 文字</span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                required
                className="flex w-full rounded-md border border-border bg-background px-4 py-3 text-base leading-relaxed font-serif placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                placeholder="本文を書き始めましょう..."
                style={{ fontFamily: 'var(--font-serif)' }}
              />
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={submitting || !title.trim() || !content.trim()}>
              {submitting ? '投稿中...' : '投稿する'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              キャンセル
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

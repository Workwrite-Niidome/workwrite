'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loading } from '@/components/layout/loading';
import { api, type Work } from '@/lib/api';

export default function EditWorkPage() {
  const params = useParams();
  const workId = params.id as string;
  const router = useRouter();
  const [work, setWork] = useState<Work | null>(null);
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getWork(workId)
      .then((res) => {
        setWork(res.data);
        setTitle(res.data.title);
        setSynopsis(res.data.synopsis || '');
      })
      .catch(() => router.push('/dashboard'));
  }, [workId, router]);

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      const res = await api.updateWork(workId, { title, synopsis } as Partial<Work>);
      setWork(res.data);
      setMessage('保存しました');
    } catch {
      setMessage('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    try {
      const res = await api.updateWork(workId, { status: 'PUBLISHED' } as Partial<Work>);
      setWork(res.data);
      setMessage('公開しました');
    } catch {
      setMessage('公開に失敗しました');
    }
  }

  async function handleDelete() {
    if (!confirm('本当にこの作品を削除しますか？')) return;
    try {
      await api.deleteWork(workId);
      router.push('/dashboard');
    } catch {
      setMessage('削除に失敗しました');
    }
  }

  if (!work) return <Loading />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">作品編集</h1>
        <div className="flex gap-2">
          {work.status === 'DRAFT' && (
            <Button onClick={handlePublish} variant="default">公開する</Button>
          )}
          <Button onClick={handleDelete} variant="destructive" size="icon" className="min-h-[44px] min-w-[44px]">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {message && <div className="p-3 mb-4 text-sm rounded-md bg-muted">{message}</div>}

      <div className="grid gap-6 md:grid-cols-[1fr,300px]">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">タイトル</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">あらすじ</label>
            <Textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              rows={5}
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">エピソード</CardTitle>
              <Link href={`/works/${workId}/episodes/new`}>
                <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> 追加</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {work.episodes && work.episodes.length > 0 ? (
                <ul className="space-y-2">
                  {work.episodes.map((ep) => (
                    <li key={ep.id} className="flex items-center justify-between text-sm">
                      <span>{ep.orderIndex + 1}. {ep.title}</span>
                      <Badge variant="outline">{ep.wordCount}字</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">エピソードがありません</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">情報</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1 text-muted-foreground">
              <p>ステータス: <Badge variant="secondary">{work.status}</Badge></p>
              {work.genre && <p>ジャンル: {work.genre}</p>}
              {work.qualityScore && <p>品質スコア: {Math.round(work.qualityScore.overall)}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

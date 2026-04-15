'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loading } from '@/components/layout/loading';
import { useAuth } from '@/lib/auth-context';
import { sharedWorldApi, type SharedWorld, type SharedWorldWork } from '@/lib/shared-world-api';
import { GENRE_LABELS } from '@/lib/constants';

export default function SharedWorldPage() {
  const params = useParams();
  const worldId = params.id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [world, setWorld] = useState<SharedWorld | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addSynopsis, setAddSynopsis] = useState('');
  const [addGenre, setAddGenre] = useState('');
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    sharedWorldApi.get(worldId)
      .then((data) => setWorld(data))
      .catch(() => router.push('/dashboard'))
      .finally(() => setLoading(false));
  }, [worldId, router]);

  if (user?.role !== 'ADMIN') return null;

  if (loading) return <Loading />;
  if (!world) return null;

  const originWork = world.works.find((w) => w.role === 'ORIGIN');
  const derivativeWorks = world.works.filter((w) => w.role === 'DERIVATIVE');

  async function handleAddWork() {
    if (!addTitle.trim()) return;
    setAdding(true);
    setMessage('');
    try {
      await sharedWorldApi.addWork(worldId, {
        title: addTitle.trim(),
        synopsis: addSynopsis.trim() || undefined,
        genre: addGenre.trim() || undefined,
      });
      // Reload world data
      const updated = await sharedWorldApi.get(worldId);
      setWorld(updated);
      setAddTitle('');
      setAddSynopsis('');
      setAddGenre('');
      setShowAddForm(false);
      setMessage('派生作品を追加しました');
    } catch (err) {
      setMessage('追加に失敗しました');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="px-4 py-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{world.name}</h1>
        {world.description && (
          <p className="text-sm text-muted-foreground mt-1">{world.description}</p>
        )}
      </div>

      {message && <div className="p-3 text-sm rounded-md bg-muted">{message}</div>}

      {/* Origin Work */}
      {originWork && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              原典
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WorkCard sw={originWork} isOrigin />
            <div className="mt-3">
              <Link href={`/world-fragments/${originWork.workId}/canon`}>
                <Button variant="outline" size="sm">Canon を確認</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Derivative Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>派生作品 ({derivativeWorks.length})</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus className="h-4 w-4 mr-1" />
              派生作品を追加
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {showAddForm && (
            <div className="border border-border rounded-lg p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">タイトル</label>
                <Input
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder="派生作品のタイトル"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">あらすじ</label>
                <Textarea
                  value={addSynopsis}
                  onChange={(e) => setAddSynopsis(e.target.value)}
                  placeholder="あらすじ（任意）"
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">ジャンル</label>
                <Input
                  value={addGenre}
                  onChange={(e) => setAddGenre(e.target.value)}
                  placeholder="ジャンル（任意）"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddWork} disabled={adding || !addTitle.trim()}>
                  {adding ? '追加中...' : '追加'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                  キャンセル
                </Button>
              </div>
            </div>
          )}

          {derivativeWorks.length === 0 && !showAddForm && (
            <p className="text-sm text-muted-foreground">まだ派生作品はありません</p>
          )}

          {derivativeWorks.map((sw) => (
            <WorkCard key={sw.id} sw={sw} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function WorkCard({ sw, isOrigin }: { sw: SharedWorldWork; isOrigin?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      {sw.work?.coverUrl && (
        <img
          src={sw.work.coverUrl}
          alt={sw.work?.title || ''}
          className="w-12 h-16 object-cover rounded border border-border"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/works/${sw.workId}`}
            className="text-sm font-medium hover:text-primary transition-colors truncate"
          >
            {sw.work?.title || sw.workId}
          </Link>
          {isOrigin && <Badge variant="default">原典</Badge>}
          {sw.work?.genre && (
            <Badge variant="secondary" className="text-xs">
              {GENRE_LABELS[sw.work.genre] || sw.work.genre}
            </Badge>
          )}
        </div>
        {sw.work?.synopsis && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sw.work.synopsis}</p>
        )}
      </div>
    </div>
  );
}

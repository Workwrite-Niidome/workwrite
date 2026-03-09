'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, BookmarkPlus, Clock, User, Sparkles, UserPlus, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { estimateReadingTime } from '@/lib/utils';
import { api, type Work } from '@/lib/api';

export default function WorkDetailPage() {
  const params = useParams();
  const workId = params.id as string;
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [work, setWork] = useState<Work | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookshelfAdding, setBookshelfAdding] = useState(false);
  const [bookshelfStatus, setBookshelfStatus] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    api.getWork(workId)
      .then((res) => {
        setWork(res.data);
        if (isAuthenticated && res.data.author?.id) {
          api.isFollowing(res.data.author.id)
            .then((fRes) => setIsFollowing(fRes.data.following))
            .catch(() => {});
        }
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [workId, router, isAuthenticated]);

  async function handleAddToBookshelf() {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    setBookshelfAdding(true);
    try {
      await api.addToBookshelf(workId);
      setBookshelfStatus('WANT_TO_READ');
    } catch {
      // already in bookshelf
    } finally {
      setBookshelfAdding(false);
    }
  }

  function handleStartReading() {
    if (!work?.episodes || work.episodes.length === 0) return;
    const firstEpisode = work.episodes.sort((a, b) => a.orderIndex - b.orderIndex)[0];
    router.push(`/read/${firstEpisode.id}`);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!work) return null;

  const totalWords = work.episodes?.reduce((sum, ep) => sum + ep.wordCount, 0) ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="space-y-6">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">{work.title}</h1>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {work.author.displayName || work.author.name}
                </span>
                {isAuthenticated && (
                  <Button
                    variant={isFollowing ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={followLoading}
                    onClick={async () => {
                      setFollowLoading(true);
                      try {
                        if (isFollowing) {
                          await api.unfollowUser(work.author.id);
                          setIsFollowing(false);
                        } else {
                          await api.followUser(work.author.id);
                          setIsFollowing(true);
                        }
                      } catch {}
                      setFollowLoading(false);
                    }}
                  >
                    {isFollowing ? <UserCheck className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                    {isFollowing ? 'フォロー中' : 'フォロー'}
                  </Button>
                )}
                {work.genre && <Badge variant="secondary">{work.genre}</Badge>}
                {work.qualityScore && (
                  <Badge variant="default">
                    スコア {Math.round(work.qualityScore.overall)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>全{work.episodes?.length ?? 0}話</span>
            <span className="mx-1">/</span>
            <span>{totalWords.toLocaleString()}字</span>
            <span className="mx-1">/</span>
            <span>{estimateReadingTime(totalWords)}</span>
          </div>

          {work.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {work.tags.map((tag) => (
                <Badge key={tag.id} variant="outline" className="text-xs">
                  {tag.tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {work.synopsis && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-sm font-medium mb-2">あらすじ</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {work.synopsis}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button onClick={handleStartReading} size="lg" disabled={!work.episodes?.length}>
            <BookOpen className="h-4 w-4 mr-2" />
            読み始める
          </Button>
          {!bookshelfStatus && (
            <Button
              onClick={handleAddToBookshelf}
              variant="outline"
              size="lg"
              disabled={bookshelfAdding}
            >
              <BookmarkPlus className="h-4 w-4 mr-2" />
              本棚に追加
            </Button>
          )}
          {bookshelfStatus && (
            <Badge variant="secondary" className="self-center px-4 py-2">
              本棚に追加済み
            </Badge>
          )}
          <Link href={`/works/${workId}/companion`}>
            <Button variant="outline" size="lg">
              <Sparkles className="h-4 w-4 mr-2" />
              AIと語る
            </Button>
          </Link>
        </div>

        {work.episodes && work.episodes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">目次</h2>
            <ul className="divide-y divide-border rounded-lg border">
              {work.episodes
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((ep) => (
                  <li key={ep.id}>
                    <Link
                      href={`/read/${ep.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors min-h-[44px]"
                    >
                      <span className="text-sm">
                        <span className="text-muted-foreground mr-2">
                          第{ep.orderIndex + 1}話
                        </span>
                        {ep.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {ep.wordCount.toLocaleString()}字 / {estimateReadingTime(ep.wordCount)}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

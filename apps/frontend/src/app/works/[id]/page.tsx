'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, BookmarkPlus, Clock, User, Users, Sparkles, UserPlus, UserCheck, X, ChevronDown, ChevronRight, BarChart3, Eye, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { estimateReadingTime, cn } from '@/lib/utils';
import { api, type Work, type StoryCharacter, type WorkReaderStats } from '@/lib/api';

export default function WorkDetailPage() {
  const params = useParams();
  const workId = params.id as string;
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [work, setWork] = useState<Work | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookshelfAdding, setBookshelfAdding] = useState(false);
  const [bookshelfStatus, setBookshelfStatus] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [publicCharacters, setPublicCharacters] = useState<StoryCharacter[]>([]);
  const [expandedCharId, setExpandedCharId] = useState<string | null>(null);
  const [showPrologue, setShowPrologue] = useState(false);
  const [readerStats, setReaderStats] = useState<WorkReaderStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    api.getWork(workId)
      .then((res) => {
        setWork(res.data);
        if (isAuthenticated && res.data.author?.id) {
          api.isFollowing(res.data.author.id)
            .then((fRes) => setIsFollowing(fRes.data.following))
            .catch(() => {});
          // Fetch author-only analytics
          if (user?.id && res.data.author.id === user.id) {
            api.getWorkReaderStats(workId)
              .then((statsRes) => setReaderStats((statsRes as any)?.data ?? statsRes))
              .catch(() => {});
          }
        }
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));

    api.getPublicCharacters(workId)
      .then((res) => {
        const chars = Array.isArray(res) ? res : (res as any).data || [];
        setPublicCharacters(chars);
      })
      .catch(() => {});
  }, [workId, router, isAuthenticated, user?.id]);

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
      <div className="px-4 py-8 space-y-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!work) return null;

  const totalWords = work.episodes?.reduce((sum, ep) => sum + ep.wordCount, 0) ?? 0;

  return (
    <div className="px-4 py-8">
      <div className="space-y-6">
        <div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold break-words">{work.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <Link href={`/users/${work.author.id}`} className="flex items-center gap-1 shrink-0 hover:text-foreground transition-colors">
                <User className="h-4 w-4" />
                {work.author.displayName || work.author.name}
              </Link>
              {isAuthenticated && (
                <Button
                  variant={isFollowing ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'h-7 text-xs gap-1 group shrink-0',
                    isFollowing && 'hover:bg-destructive hover:text-destructive-foreground hover:border-destructive',
                  )}
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
                  {isFollowing ? (
                    <>
                      <UserCheck className="h-3 w-3 group-hover:hidden" />
                      <X className="h-3 w-3 hidden group-hover:block" />
                      <span className="group-hover:hidden">フォロー中</span>
                      <span className="hidden group-hover:inline">フォロー解除</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3 w-3" />
                      フォローする
                    </>
                  )}
                </Button>
              )}
              {work.genre && <Badge variant="secondary" className="shrink-0">{work.genre}</Badge>}
              {work.qualityScore && (
                <Badge variant="default" className="shrink-0">
                  スコア {Math.round(work.qualityScore.overall)}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-4 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>全{work.episodes?.length ?? 0}話</span>
            <span>/</span>
            <span>{totalWords.toLocaleString()}字</span>
            <span>/</span>
            <span>{estimateReadingTime(totalWords)}</span>
          </div>

          {/* Social proof: reader counts */}
          {work.readerCounts && Object.keys(work.readerCounts).length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4 shrink-0" />
              {(work.readerCounts.READING ?? 0) > 0 && (
                <span>{work.readerCounts.READING}人が読書中</span>
              )}
              {(work.readerCounts.COMPLETED ?? 0) > 0 && (
                <span>{work.readerCounts.COMPLETED}人が読了</span>
              )}
              {(work.readerCounts.WANT_TO_READ ?? 0) > 0 && (
                <span>{work.readerCounts.WANT_TO_READ}人が気になる</span>
              )}
            </div>
          )}

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

        {publicCharacters.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                <Users className="h-4 w-4" /> 登場人物
              </h2>
              <div className="space-y-1">
                {publicCharacters.map((char) => {
                  const isExpanded = expandedCharId === char.id;
                  return (
                    <div key={char.id} className="border border-border rounded-lg">
                      <button
                        onClick={() => setExpandedCharId(isExpanded ? null : char.id)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="text-sm font-medium">{char.name}</span>
                        <span className="text-xs text-muted-foreground">({char.role})</span>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-3 text-xs text-muted-foreground space-y-1 border-t border-border/50 pt-2">
                          {(char.gender || char.age) && (
                            <p>{[char.gender, char.age].filter(Boolean).join(' / ')}</p>
                          )}
                          {char.personality && <p>性格: {char.personality}</p>}
                          {char.appearance && <p>外見: {char.appearance}</p>}
                          {char.background && <p>背景: {char.background}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
          <Button onClick={handleStartReading} disabled={!work.episodes?.length} className="w-full sm:w-auto">
            <BookOpen className="h-4 w-4 mr-2" />
            読み始める
          </Button>
          {!bookshelfStatus ? (
            <Button
              onClick={handleAddToBookshelf}
              variant="outline"
              disabled={bookshelfAdding}
              className="w-full sm:w-auto"
            >
              <BookmarkPlus className="h-4 w-4 mr-2" />
              本棚に追加
            </Button>
          ) : (
            <Button variant="secondary" disabled className="w-full sm:w-auto">
              本棚に追加済み
            </Button>
          )}
          <Link href={`/works/${workId}/companion`} className="col-span-2 sm:col-span-1">
            <Button variant="outline" className="w-full sm:w-auto">
              <Sparkles className="h-4 w-4 mr-2" />
              AIと語る
            </Button>
          </Link>
        </div>

        {/* Author-only analytics */}
        {user?.id === work.author.id && readerStats && (
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  読者統計（あなただけに表示）
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setShowStats(!showStats)}
                >
                  {showStats ? '閉じる' : '詳細を見る'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">ユニーク読者</p>
                  <p className="text-lg font-bold">{readerStats.totalUniqueReaders}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">直近7日の新規</p>
                  <p className="text-lg font-bold">{readerStats.recentReaders7d}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">読了率</p>
                  <p className="text-lg font-bold">{readerStats.completionRate}%</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">平均読書時間</p>
                  <p className="text-lg font-bold">
                    {readerStats.avgReadTimePerReader > 60000
                      ? `${Math.round(readerStats.avgReadTimePerReader / 60000)}分`
                      : `${Math.round(readerStats.avgReadTimePerReader / 1000)}秒`}
                  </p>
                </div>
              </div>

              {showStats && (
                <div className="mt-4 space-y-4">
                  {/* Status breakdown */}
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-2">ステータス内訳</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(readerStats.statusBreakdown).map(([status, count]) => (
                        <Badge key={status} variant="outline" className="text-xs">
                          {status === 'WANT_TO_READ' ? '読みたい' : status === 'READING' ? '読書中' : status === 'COMPLETED' ? '読了' : status}
                          : {count}人
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Episode analytics with drop-off */}
                  {readerStats.episodeAnalytics.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        エピソード別分析（離脱率）
                      </h3>
                      <div className="border border-border rounded-lg overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              <th className="text-left px-3 py-2 font-medium">エピソード</th>
                              <th className="text-right px-3 py-2 font-medium">読者数</th>
                              <th className="text-right px-3 py-2 font-medium">平均進捗</th>
                              <th className="text-right px-3 py-2 font-medium">離脱率</th>
                            </tr>
                          </thead>
                          <tbody>
                            {readerStats.episodeAnalytics.map((ep) => (
                              <tr key={ep.episodeId} className="border-b border-border last:border-b-0">
                                <td className="px-3 py-2 truncate max-w-[200px]">
                                  第{ep.orderIndex + 1}話 {ep.title}
                                </td>
                                <td className="text-right px-3 py-2">{ep.readers}</td>
                                <td className="text-right px-3 py-2">{ep.avgProgress}%</td>
                                <td className="text-right px-3 py-2">
                                  <span className={ep.dropOffPct > 50 ? 'text-destructive' : ep.dropOffPct > 30 ? 'text-yellow-500' : 'text-muted-foreground'}>
                                    {ep.dropOffPct}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Daily new readers (30-day) */}
                  {readerStats.dailyNewReaders.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-muted-foreground mb-2">直近30日の新規読者</h3>
                      <div className="flex items-end gap-px h-16">
                        {readerStats.dailyNewReaders.map((d) => {
                          const maxCount = Math.max(...readerStats.dailyNewReaders.map(x => x.count), 1);
                          const height = (d.count / maxCount) * 100;
                          return (
                            <div
                              key={d.date}
                              className="flex-1 bg-primary/60 rounded-t-sm min-h-[2px] transition-all hover:bg-primary"
                              style={{ height: `${Math.max(height, 3)}%` }}
                              title={`${d.date}: ${d.count}人`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground">30日前</span>
                        <span className="text-[10px] text-muted-foreground">今日</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(work.prologue || (work.episodes && work.episodes.length > 0)) && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">目次</h2>
            <ul className="divide-y divide-border rounded-lg border">
              {work.prologue && (
                <li>
                  <button
                    onClick={() => setShowPrologue(!showPrologue)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors min-h-[44px] text-left"
                  >
                    <span className="text-sm">
                      <span className="text-muted-foreground mr-2">序章</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {showPrologue ? '閉じる' : '読む'}
                    </span>
                  </button>
                  {showPrologue && (
                    <div className="px-4 pb-4 text-sm whitespace-pre-wrap leading-relaxed border-t border-border/50 pt-3 text-muted-foreground">
                      {work.prologue}
                    </div>
                  )}
                </li>
              )}
              {work.episodes
                ?.sort((a, b) => a.orderIndex - b.orderIndex)
                .map((ep) => (
                  <li key={ep.id}>
                    <Link
                      href={`/read/${ep.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 transition-colors min-h-[44px]"
                    >
                      <span className="text-sm min-w-0 truncate">
                        <span className="text-muted-foreground mr-2">
                          第{ep.orderIndex + 1}話
                        </span>
                        {ep.title}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
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

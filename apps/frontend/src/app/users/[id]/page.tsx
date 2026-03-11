'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, UserCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { api, SnsPost } from '@/lib/api';
import { PostCard, PostCardSkeleton } from '@/components/posts/post-card';
import { TimelineFeed } from '@/components/posts/timeline-feed';
import { cn } from '@/lib/utils';

type Tab = 'posts' | 'works' | 'applause';

interface PublicProfile {
  id: string;
  name: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  _count: {
    readingProgress: number;
    reviews: number;
    followers: number;
    following: number;
  };
}

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const { isAuthenticated, user } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('posts');
  const [works, setWorks] = useState<any[]>([]);
  const [worksLoading, setWorksLoading] = useState(false);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    setLoading(true);
    api.getPublicProfile(userId)
      .then((res) => {
        setProfile(res.data);
        if (isAuthenticated && !isOwnProfile) {
          api.isFollowing(userId)
            .then((fRes) => setIsFollowing(fRes.data.following))
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, isAuthenticated, isOwnProfile]);

  useEffect(() => {
    if (tab === 'works') {
      setWorksLoading(true);
      api.getAuthorWorks(userId)
        .then((res) => setWorks(res.data || []))
        .catch(() => {})
        .finally(() => setWorksLoading(false));
    }
  }, [tab, userId]);

  const handleFollow = async () => {
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await api.unfollowUser(userId);
        setIsFollowing(false);
        setProfile((p) => p ? { ...p, _count: { ...p._count, followers: p._count.followers - 1 } } : p);
      } else {
        await api.followUser(userId);
        setIsFollowing(true);
        setProfile((p) => p ? { ...p, _count: { ...p._count, followers: p._count.followers + 1 } } : p);
      }
    } catch {}
    setFollowLoading(false);
  };

  const fetchUserPosts = useCallback(
    (cursor?: string) => api.getUserPosts(userId, cursor),
    [userId],
  );

  const fetchApplaudedPosts = useCallback(
    (cursor?: string) => api.getUserApplaudedPosts(userId, cursor),
    [userId],
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl min-h-screen">
        <div className="px-4 py-8 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-32 bg-muted rounded animate-pulse" />
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-2xl min-h-screen">
        <div className="text-center py-12 text-muted-foreground text-sm">
          ユーザーが見つかりません
        </div>
      </main>
    );
  }

  const displayName = profile.displayName || profile.name;

  return (
    <main className="mx-auto max-w-2xl min-h-screen">
      {/* Profile header */}
      <div className="px-4 pt-6 pb-4 border-b border-border">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-medium text-muted-foreground overflow-hidden shrink-0">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              displayName[0]
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-lg font-bold truncate">{displayName}</h1>
                <p className="text-sm text-muted-foreground">@{profile.name}</p>
              </div>
              {isAuthenticated && !isOwnProfile && (
                <Button
                  variant={isFollowing ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'h-8 text-xs gap-1 shrink-0 group',
                    isFollowing && 'hover:bg-destructive hover:text-destructive-foreground',
                  )}
                  disabled={followLoading}
                  onClick={handleFollow}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="h-3 w-3 group-hover:hidden" />
                      <X className="h-3 w-3 hidden group-hover:block" />
                      <span className="group-hover:hidden">フォロー中</span>
                      <span className="hidden group-hover:inline">解除</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3 w-3" />
                      フォロー
                    </>
                  )}
                </Button>
              )}
            </div>

            {profile.bio && (
              <p className="text-sm mt-2 whitespace-pre-wrap">{profile.bio}</p>
            )}

            <div className="flex items-center gap-4 mt-3 text-sm">
              <Link href={`/users/${userId}/following`} className="hover:underline">
                <strong>{profile._count.following}</strong>{' '}
                <span className="text-muted-foreground">フォロー中</span>
              </Link>
              <Link href={`/users/${userId}/followers`} className="hover:underline">
                <strong>{profile._count.followers}</strong>{' '}
                <span className="text-muted-foreground">フォロワー</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex">
          {(['posts', 'works', 'applause'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-3 text-sm font-medium text-center relative transition-colors',
                tab === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'posts' ? 'ひとこと' : t === 'works' ? '作品' : '拍手'}
              {tab === t && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'posts' && (
        <TimelineFeed
          fetchFn={fetchUserPosts}
          emptyMessage="まだ投稿がありません"
        />
      )}

      {tab === 'works' && (
        <div className="px-4 py-4">
          {worksLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : works.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              公開作品はありません
            </div>
          ) : (
            <div className="space-y-3">
              {works.map((work: any) => (
                <Link key={work.id} href={`/works/${work.id}`}>
                  <div className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <p className="text-sm font-medium">{work.title}</p>
                    {work.synopsis && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{work.synopsis}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {work.genre && <span>{work.genre} · </span>}
                      {work._count?.episodes || work.episodes?.length || 0}話
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'applause' && (
        <TimelineFeed
          fetchFn={fetchApplaudedPosts}
          emptyMessage="まだ拍手した投稿がありません"
        />
      )}
    </main>
  );
}

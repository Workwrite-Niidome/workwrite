'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PostComposer } from '@/components/posts/post-composer';
import { TimelineFeed, useTimelineRefresh } from '@/components/posts/timeline-feed';
import { cn } from '@/lib/utils';

type Tab = 'following' | 'global';

export default function TimelinePage() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<Tab>(isAuthenticated ? 'following' : 'global');
  const { key, refresh } = useTimelineRefresh();

  const fetchFollowing = useCallback(
    (cursor?: string) => api.getFollowingTimeline(cursor),
    [],
  );

  const fetchGlobal = useCallback(
    (cursor?: string) => api.getGlobalTimeline(cursor),
    [],
  );

  return (
    <main className="mx-auto max-w-xl min-h-screen">
      {/* Tabs */}
      <div className="sticky top-12 z-40 bg-background border-b border-border">
        <div className="flex">
          <button
            onClick={() => setTab('global')}
            className={cn(
              'flex-1 py-3 text-sm font-medium text-center relative transition-colors',
              tab === 'global' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            おすすめ
            {tab === 'global' && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full bg-primary" />
            )}
          </button>
          {isAuthenticated && (
            <button
              onClick={() => setTab('following')}
              className={cn(
                'flex-1 py-3 text-sm font-medium text-center relative transition-colors',
                tab === 'following' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              フォロー中
              {tab === 'following' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Inline composer — visible on PC only */}
      {isAuthenticated && (
        <div className="hidden md:block">
          <PostComposer onPost={refresh} compact />
        </div>
      )}

      {/* Feed */}
      {tab === 'following' ? (
        <TimelineFeed
          key={`following-${key}`}
          fetchFn={fetchFollowing}
          emptyMessage="フォロー中のユーザーの投稿がここに表示されます"
        />
      ) : (
        <TimelineFeed
          key={`global-${key}`}
          fetchFn={fetchGlobal}
          emptyMessage="まだ投稿がありません。最初のひとことを投稿してみましょう！"
        />
      )}
    </main>
  );
}

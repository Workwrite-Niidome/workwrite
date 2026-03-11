'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, SnsPost, TimelineResult } from '@/lib/api';
import { PostCard, PostCardSkeleton } from './post-card';

interface TimelineFeedProps {
  fetchFn: (cursor?: string) => Promise<{ data: TimelineResult }>;
  onDeletePost?: (postId: string) => void;
  emptyMessage?: string;
}

export function TimelineFeed({ fetchFn, onDeletePost, emptyMessage }: TimelineFeedProps) {
  const [posts, setPosts] = useState<SnsPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);

  const loadPosts = useCallback(async (cursor?: string) => {
    try {
      const res = await fetchFn(cursor);
      const result = res.data;
      if (cursor) {
        setPosts((prev) => [...prev, ...result.posts]);
      } else {
        setPosts(result.posts);
      }
      setNextCursor(result.nextCursor);
    } catch (e) {
      console.error('Failed to load posts:', e);
    }
  }, [fetchFn]);

  useEffect(() => {
    setLoading(true);
    loadPosts().finally(() => setLoading(false));
  }, [loadPosts]);

  // Infinite scroll
  useEffect(() => {
    if (!nextCursor || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loadingMore) {
          setLoadingMore(true);
          loadPosts(nextCursor).finally(() => setLoadingMore(false));
        }
      },
      { threshold: 0.1 },
    );

    const el = observerRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [nextCursor, loadingMore, loadPosts]);

  const handleDelete = async (postId: string) => {
    try {
      await api.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      onDeletePost?.(postId);
    } catch {
      alert('削除に失敗しました');
    }
  };

  const refresh = useCallback(() => {
    setLoading(true);
    loadPosts().finally(() => setLoading(false));
  }, [loadPosts]);

  if (loading) {
    return (
      <div>
        {Array.from({ length: 5 }).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        {emptyMessage || 'まだ投稿がありません'}
      </div>
    );
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} onDelete={handleDelete} />
      ))}
      {nextCursor && (
        <div ref={observerRef} className="py-4">
          {loadingMore && <PostCardSkeleton />}
        </div>
      )}
    </div>
  );
}

// Re-export refresh function through a hook pattern
export function useTimelineRefresh() {
  const [key, setKey] = useState(0);
  const refresh = useCallback(() => setKey((k) => k + 1), []);
  return { key, refresh };
}

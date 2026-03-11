'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { TimelineFeed } from '@/components/posts/timeline-feed';

export default function BookmarksPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const fetchBookmarks = useCallback(
    (cursor?: string) => api.getPostBookmarks(cursor),
    [],
  );

  if (isLoading || !isAuthenticated) return null;

  return (
    <main className="mx-auto max-w-2xl min-h-screen">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border sticky top-12 z-40 bg-background">
        <Bookmark className="h-4 w-4" />
        <h1 className="text-sm font-medium">しおり</h1>
      </div>

      <TimelineFeed
        fetchFn={fetchBookmarks}
        emptyMessage="しおりに保存した投稿がここに表示されます"
      />
    </main>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';

interface UserItem {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
}

export default function FollowersPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFollowers(userId)
      .then((res) => setUsers(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <main className="w-full md:mx-auto md:max-w-2xl min-h-screen">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border sticky top-12 z-40 bg-background">
        <button onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-medium">フォロワー</h1>
      </div>

      {loading ? (
        <div className="space-y-0">
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-3 border-b border-border animate-pulse flex gap-3">
              <div className="w-10 h-10 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          フォロワーはまだいません
        </div>
      ) : (
        <div>
          {users.map((u) => (
            <Link
              key={u.id}
              href={`/users/${u.id}`}
              className="flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-muted/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground overflow-hidden shrink-0">
                {u.avatarUrl ? (
                  <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  (u.displayName || u.name)[0]
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{u.displayName || u.name}</p>
                <p className="text-xs text-muted-foreground">@{u.name}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

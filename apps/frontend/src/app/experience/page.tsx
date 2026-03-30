'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import type { Work } from '@/lib/api';

export default function ExperienceListPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'ADMIN')) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    async function load() {
      try {
        const res = await api.getMyWorks();
        const all = ((res as any)?.data ?? res ?? []) as Work[];
        setWorks(all);
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [isAuthenticated]);

  if (isLoading || !isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#d8d5d0] px-6 py-12">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-light tracking-widest text-center mb-2" style={{ fontFamily: "'Noto Serif JP', serif" }}>
          Interactive Novel
        </h1>
        <p className="text-xs text-[#55555f] text-center tracking-wider mb-12">
          EXPERIENCE PROTOTYPE
        </p>

        {loading ? (
          <p className="text-center text-sm text-[#55555f]">読み込み中...</p>
        ) : works.length === 0 ? (
          <p className="text-center text-sm text-[#55555f]">作品がありません</p>
        ) : (
          <div className="space-y-3">
            {works.map(work => (
              <Link
                key={work.id}
                href={`/experience/${work.id}`}
                className="block px-5 py-4 border border-[#2a2a35] rounded-lg hover:border-[#4a4a55] transition-all"
              >
                <p className="text-base mb-1" style={{ fontFamily: "'Noto Serif JP', serif" }}>
                  {work.title}
                </p>
                <p className="text-xs text-[#55555f]">
                  {work.genre || ''} {work.episodes?.length ? `/ ${work.episodes.length}話` : ''}
                </p>
                {work.synopsis && (
                  <p className="text-xs text-[#6a6a70] mt-1.5 line-clamp-2 leading-relaxed">
                    {work.synopsis}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

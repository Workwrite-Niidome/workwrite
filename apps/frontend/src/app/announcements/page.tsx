'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, type Announcement } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pin, ArrowLeft } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  update: 'アップデート',
  maintenance: 'メンテナンス',
  feature: '新機能',
  event: 'イベント',
};

const CATEGORY_COLORS: Record<string, string> = {
  update: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  maintenance: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  feature: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  event: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getAnnouncements(50);
        setAnnouncements(res.data);
      } catch {}
      setLoading(false);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-wide">お知らせ</h1>
        <p className="text-xs text-muted-foreground mt-1">Workwriteからの最新情報</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-border rounded-lg p-4">
              <Skeleton className="h-5 w-48 mb-2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3 mt-1" />
            </div>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          現在お知らせはありません
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <button
              key={a.id}
              onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
              className="w-full text-left border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {a.isPinned && <Pin className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[a.category] || ''}`}>
                      {CATEGORY_LABELS[a.category] || a.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium">{a.title}</h3>
                  {expandedId === a.id && (
                    <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {a.content}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { api, type NotificationItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GENRE_LABELS } from '@/lib/constants';
import { Bell, Check, MessageSquare, Star, BarChart3, Hand, BookOpen, Mail, Megaphone, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  comment: MessageSquare,
  review: Star,
  score_ready: BarChart3,
  reaction: Hand,
  new_episode: BookOpen,
  letter: Mail,
  digest: Sparkles,
  announcement: Megaphone,
  editor_mode: BookOpen,
};

function NotificationIcon({ type }: { type: string }) {
  const Icon = ICON_MAP[type] || Bell;
  return <Icon className="h-4 w-4 flex-shrink-0" />;
}

function getNotificationLink(n: NotificationItem): string | null {
  const data = n.data || {};
  switch (n.type) {
    case 'comment':
      return data.episodeId ? `/read/${data.episodeId}` : data.workId ? `/works/${data.workId}` : null;
    case 'review':
      return data.workId ? `/works/${data.workId}` : null;
    case 'score_ready':
      return data.workId ? `/dashboard/works/${data.workId}` : null;
    case 'reaction':
      return data.workId ? `/dashboard/works/${data.workId}` : null;
    case 'new_episode':
      return data.episodeId ? `/read/${data.episodeId}` : data.workId ? `/works/${data.workId}` : null;
    case 'letter':
      return '/dashboard/letters/received';
    case 'digest':
      return null; // Handled inline with expanded cards
    case 'announcement':
      return '/announcements';
    case 'editor_mode':
      return data.workId ? `/works/${data.workId}/editor-mode` : null;
    default:
      if (data.workId) return `/works/${data.workId}`;
      if (data.episodeId) return `/read/${data.episodeId}`;
      return null;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString('ja-JP');
}

interface DigestWork {
  id: string;
  title: string;
  synopsis?: string;
  coverUrl?: string;
  genre?: string;
  author: { name: string; displayName?: string | null };
  qualityScore?: { overall: number };
}

interface DigestFollowUpdate {
  id: string;
  title: string;
  workId: string;
  author: { name: string; displayName?: string | null };
  work: { title: string };
}

interface DigestReadingReminder {
  workId: string;
  work: { title: string };
}

function getRecommendReason(work: DigestWork): string {
  const reasons: string[] = [];
  if (work.qualityScore?.overall) {
    reasons.push(`スコア ${work.qualityScore.overall}点`);
  }
  if (work.genre) {
    reasons.push(GENRE_LABELS[work.genre] || work.genre);
  }
  return reasons.length > 0 ? reasons.join(' · ') : '高評価の新作';
}

function DigestContent({ data }: { data: Record<string, unknown> }) {
  const newWorks = (data.newWorks as DigestWork[] | undefined) || [];
  const followUpdates = (data.followUpdates as DigestFollowUpdate[] | undefined) || [];
  const readingReminders = (data.readingReminders as DigestReadingReminder[] | undefined) || [];

  return (
    <div className="mt-3 space-y-4">
      {/* New highly-rated works */}
      {newWorks.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">おすすめの新作</p>
          <div className="space-y-2">
            {newWorks.map((work) => (
              <Link
                key={work.id}
                href={`/works/${work.id}`}
                className="flex gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                {work.coverUrl ? (
                  <Image
                    src={work.coverUrl}
                    alt={work.title}
                    width={48}
                    height={68}
                    className="rounded object-cover flex-shrink-0"
                    style={{ width: 48, height: 68 }}
                  />
                ) : (
                  <div className="w-12 h-[68px] rounded bg-muted flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug line-clamp-1">{work.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {work.author.displayName ?? work.author.name}
                  </p>
                  {work.synopsis && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{work.synopsis}</p>
                  )}
                  <p className="text-[11px] text-primary/80 mt-1">{getRecommendReason(work)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Follow updates */}
      {followUpdates.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">フォロー中の新着</p>
          <div className="space-y-1">
            {followUpdates.map((ep) => (
              <Link
                key={ep.id}
                href={`/read/${ep.id}`}
                className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors text-sm"
              >
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="line-clamp-1">
                  {ep.work.title} — {ep.title}
                </span>
                <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                  {ep.author.displayName ?? ep.author.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Reading reminders */}
      {readingReminders.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">読みかけの作品</p>
          <div className="space-y-1">
            {readingReminders.map((r) => (
              <Link
                key={r.workId}
                href={`/works/${r.workId}`}
                className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors text-sm"
              >
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="line-clamp-1">{r.work.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!isAuthenticated) return;

    setLoading(true);
    api.getNotifications(filter === 'unread')
      .then((res) => setNotifications(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated, authLoading, filter, router]);

  async function handleMarkAsRead(id: string) {
    try {
      await api.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    } catch {}
  }

  async function handleMarkAllAsRead() {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  }

  function handleClick(n: NotificationItem) {
    if (!n.read) handleMarkAsRead(n.id);
    const link = getNotificationLink(n);
    if (link) router.push(link);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="px-4 md:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold tracking-wide">通知</h1>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={handleMarkAllAsRead}>
            <Check className="h-3.5 w-3.5 mr-1" />
            すべて既読にする
          </Button>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant={filter === 'all' ? 'default' : 'ghost'}
          size="sm"
          className="text-xs h-8"
          onClick={() => setFilter('all')}
        >
          すべて
        </Button>
        <Button
          variant={filter === 'unread' ? 'default' : 'ghost'}
          size="sm"
          className="text-xs h-8"
          onClick={() => setFilter('unread')}
        >
          未読
        </Button>
      </div>

      <div className="space-y-1">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-4">
              <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {filter === 'unread' ? '未読の通知はありません' : 'まだ通知はありません'}
            </p>
          </div>
        ) : (
          notifications.map((n) => {
            const link = getNotificationLink(n);
            const isDigest = n.type === 'digest';
            return (
              <div
                key={n.id}
                className={cn(
                  'rounded-lg transition-colors',
                  n.read
                    ? 'text-muted-foreground'
                    : 'bg-secondary/40',
                )}
              >
                <button
                  onClick={() => handleClick(n)}
                  className={cn(
                    'w-full text-left flex gap-3 p-4',
                    link && 'cursor-pointer hover:bg-muted/30',
                    isDigest && 'cursor-default',
                  )}
                >
                  <div className={cn('mt-0.5', !n.read && 'text-foreground')}>
                    <NotificationIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-snug', !n.read && 'font-medium text-foreground')}>
                      {n.title}
                    </p>
                    {n.body && !isDigest && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                </button>
                {/* Expand digest notifications inline with work cards */}
                {isDigest && n.data && (
                  <div className="px-4 pb-4 pl-11">
                    <DigestContent data={n.data as Record<string, unknown>} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

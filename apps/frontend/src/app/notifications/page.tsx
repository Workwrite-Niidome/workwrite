'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, type NotificationItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Check, MessageSquare, Star, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  comment: MessageSquare,
  review: Star,
  score_ready: BarChart3,
};

function NotificationIcon({ type }: { type: string }) {
  const Icon = ICON_MAP[type] || Bell;
  return <Icon className="h-4 w-4 flex-shrink-0" />;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('ja-JP');
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="px-4 md:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold tracking-wide">Notifications</h1>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={handleMarkAllAsRead}>
            <Check className="h-3.5 w-3.5 mr-1" />
            Mark all as read
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
          All
        </Button>
        <Button
          variant={filter === 'unread' ? 'default' : 'ghost'}
          size="sm"
          className="text-xs h-8"
          onClick={() => setFilter('unread')}
        >
          Unread
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
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.read && handleMarkAsRead(n.id)}
              className={cn(
                'w-full text-left flex gap-3 p-4 rounded-lg transition-colors',
                n.read
                  ? 'text-muted-foreground'
                  : 'bg-secondary/40 hover:bg-secondary/60',
              )}
            >
              <div className={cn('mt-0.5', !n.read && 'text-foreground')}>
                <NotificationIcon type={n.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm leading-snug', !n.read && 'font-medium text-foreground')}>
                  {n.title}
                </p>
                {n.body && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.read && (
                <div className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

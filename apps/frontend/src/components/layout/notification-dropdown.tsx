'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, type NotificationItem } from '@/lib/api';

export function NotificationDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.getUnreadNotificationCount();
      setUnreadCount(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  async function handleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const res = await api.getNotifications();
      setNotifications(res.data.slice(0, 5));
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.markAllNotificationsAsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  }

  async function handleMarkRead(id: string) {
    try {
      await api.markNotificationAsRead(id);
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    } catch {}
  }

  return (
    <div ref={dropdownRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 relative"
        aria-label="通知"
        onClick={handleOpen}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 rounded-lg border border-border bg-card text-card-foreground shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-medium">通知</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                すべて既読
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                読み込み中...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                通知はありません
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) handleMarkRead(n.id);
                    if (n.type.startsWith('digest')) {
                      setOpen(false);
                      router.push('/notifications');
                    }
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors ${
                    !n.read ? 'bg-muted/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                    <div className={!n.read ? '' : 'ml-4'}>
                      <p className="text-sm font-medium leading-snug">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(n.createdAt).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="px-4 py-2 border-t border-border">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              すべて見る
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

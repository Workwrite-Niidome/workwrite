'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  House,
  Compass,
  Search,
  MessageCircle,
  BookOpen,
  Bookmark,
  Bell,
  BarChart3,
  PenSquare,
  User,
  Settings,
  Feather,
  Crown,
  Megaphone,
  MessagesSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  authRequired?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'ホーム', icon: House },
  { href: '/timeline', label: 'タイムライン', icon: MessageCircle },
  { href: '/discover', label: '探す', icon: Compass },
  { href: '/character-talks', label: 'キャラクタートーク', icon: MessagesSquare, authRequired: true },
  { href: '/bookshelf', label: '本棚', icon: BookOpen, authRequired: true },
  { href: '/bookmarks', label: 'しおり', icon: Bookmark, authRequired: true },
  { href: '/notifications', label: '通知', icon: Bell, authRequired: true },
  { href: '/announcements', label: 'お知らせ', icon: Megaphone },
  { href: '/stats', label: '統計・収益', icon: BarChart3, authRequired: true },
  { href: '/dashboard', label: '執筆', icon: Feather, authRequired: true },
  { href: '/profile', label: 'マイページ', icon: User, authRequired: true },
  { href: '/settings', label: '設定', icon: Settings, authRequired: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [newEpisodeCount, setNewEpisodeCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.getNotifications(true)
      .then((res) => {
        const count = res.data.filter((n) => n.type === 'new_episode').length;
        setNewEpisodeCount(count);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.authRequired || isAuthenticated,
  );

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 sticky top-12 h-[calc(100vh-3rem)] py-4 pr-4">
      <nav className="flex flex-col gap-0.5">
        {visibleItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const showBadge = item.href === '/bookshelf' && newEpisodeCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {newEpisodeCount > 99 ? '99+' : newEpisodeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {isAuthenticated && (
        <>
          <Button
            onClick={() => router.push('/timeline')}
            className="mt-4 w-full gap-2"
            size="sm"
          >
            <PenSquare className="h-4 w-4" />
            投稿する
          </Button>

          <Link
            href="/pricing"
            className="mt-3 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-primary/20 bg-primary/5 text-xs text-primary hover:bg-primary/10 transition-colors"
          >
            <Crown className="h-3.5 w-3.5" />
            <span>プランをアップグレード</span>
          </Link>
        </>
      )}
    </aside>
  );
}

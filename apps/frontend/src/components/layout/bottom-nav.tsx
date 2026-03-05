'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, Search, BookOpen, TrendingUp, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'ホーム', icon: House },
  { href: '/search', label: '検索', icon: Search },
  { href: '/bookshelf', label: '本棚', icon: BookOpen },
  { href: '/timeline', label: 'タイムライン', icon: TrendingUp },
  { href: '/profile', label: 'マイページ', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  // Hide on reader page
  if (pathname.startsWith('/read/')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2 px-3 min-h-[56px] min-w-[56px] justify-center transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

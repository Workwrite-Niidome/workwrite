'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { House, Search, PenSquare, MessageCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

const NAV_ITEMS = [
  { href: '/', label: 'ホーム', icon: House },
  { href: '/search', label: '検索', icon: Search },
  { href: '/compose', label: '投稿', icon: PenSquare, isCompose: true },
  { href: '/timeline', label: 'TL', icon: MessageCircle },
  { href: '/profile', label: 'マイ', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // Hide on reader page
  if (pathname.startsWith('/read/')) return null;

  const handleCompose = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isAuthenticated) {
      router.push('/timeline');
      // Focus composer on timeline page — handled by the page itself
    } else {
      router.push('/login');
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden" style={{ transform: 'translateZ(0)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          if (item.isCompose) {
            return (
              <button
                key={item.href}
                onClick={handleCompose}
                className="flex flex-col items-center gap-0.5 py-2 px-3 min-h-[56px] min-w-[56px] justify-center"
              >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <item.icon className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
                </div>
              </button>
            );
          }

          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center gap-0.5 py-2 px-3 min-h-[56px] min-w-[56px] justify-center transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary" />
              )}
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { House, Search, PenSquare, MessageCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

const NAV_ITEMS = [
  { href: '/', icon: House },
  { href: '/search', icon: Search },
  { href: '/compose', icon: PenSquare, isCompose: true },
  { href: '/timeline', icon: MessageCircle },
  { href: '/profile', icon: User },
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
      router.push('/compose');
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
                className="flex items-center justify-center py-3 px-4"
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
                'relative flex items-center justify-center py-3 px-4 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary" />
              )}
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

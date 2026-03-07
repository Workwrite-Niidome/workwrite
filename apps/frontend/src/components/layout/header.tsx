'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NotificationDropdown } from '@/components/layout/notification-dropdown';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push('/');
    setMobileOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-5xl items-center px-6">
        <Link href="/" className="mr-8">
          <span className="text-sm font-semibold tracking-wide">Workwrite</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/search" className="text-muted-foreground hover:text-foreground transition-colors">
            検索
          </Link>
          {isAuthenticated && (
            <>
              <Link href="/bookshelf" className="text-muted-foreground hover:text-foreground transition-colors">
                本棚
              </Link>
              <Link href="/timeline" className="text-muted-foreground hover:text-foreground transition-colors">
                タイムライン
              </Link>
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                執筆
              </Link>
            </>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />

          {isAuthenticated ? (
            <>
              <div className="hidden md:block">
                <NotificationDropdown />
              </div>
              <Link href="/profile" className="hidden md:inline-flex">
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-8">
                  <User className="h-3.5 w-3.5" />
                  {user?.displayName || user?.name || 'マイページ'}
                </Button>
              </Link>
            </>
          ) : (
            <Link href="/login" className="hidden md:inline-flex">
              <Button variant="ghost" size="sm" className="text-xs h-8">ログイン</Button>
            </Link>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="メニュー"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          'md:hidden border-t border-border overflow-hidden transition-all',
          mobileOpen ? 'max-h-80' : 'max-h-0',
        )}
      >
        <nav className="flex flex-col p-4 gap-1">
          {isAuthenticated ? (
            <>
              <Link href="/notifications" className="text-sm text-muted-foreground hover:text-foreground py-2" onClick={() => setMobileOpen(false)}>
                Notifications
              </Link>
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground py-2" onClick={() => setMobileOpen(false)}>
                Writing Dashboard
              </Link>
              <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground py-2" onClick={() => setMobileOpen(false)}>
                Settings
              </Link>
              <button onClick={handleLogout} className="text-sm text-muted-foreground hover:text-foreground py-2 text-left">
                Log out
              </button>
            </>
          ) : (
            <Link href="/login" className="text-sm font-medium py-2" onClick={() => setMobileOpen(false)}>
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

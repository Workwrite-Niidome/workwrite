'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, Search, Bell, BookOpen, PenTool, TrendingUp, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  const navLinks = [
    { href: '/search', label: '検索', icon: Search },
    { href: '/bookshelf', label: '本棚', icon: BookOpen, auth: true },
    { href: '/timeline', label: 'タイムライン', icon: TrendingUp, auth: true },
    { href: '/dashboard', label: '執筆', icon: PenTool, auth: true },
  ];

  const visibleLinks = navLinks.filter((link) => !link.auth || isAuthenticated);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <span className="text-lg font-bold text-primary">Workwrite</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-4 text-sm font-medium">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <link.icon className="h-3.5 w-3.5" />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center space-x-2">
          <Link href="/search">
            <Button variant="ghost" size="icon" aria-label="検索">
              <Search className="h-5 w-5" />
            </Button>
          </Link>

          {isAuthenticated ? (
            <>
              <Link href="/notifications">
                <Button variant="ghost" size="icon" aria-label="通知">
                  <Bell className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/profile" className="hidden md:inline-flex">
                <Button variant="ghost" size="sm" className="gap-1">
                  <User className="h-4 w-4" />
                  {user?.displayName || user?.name || 'マイページ'}
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                aria-label="ログアウト"
                className="hidden md:inline-flex"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link href="/login" className="hidden md:inline-flex">
              <Button variant="default" size="sm">ログイン</Button>
            </Link>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="メニュー"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav */}
      <div
        className={cn(
          'md:hidden border-t border-border overflow-hidden transition-all',
          mobileOpen ? 'max-h-80' : 'max-h-0',
        )}
      >
        <nav className="flex flex-col space-y-2 p-4">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
              onClick={() => setMobileOpen(false)}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
          {isAuthenticated ? (
            <>
              <Link href="/profile" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                <User className="h-4 w-4" /> プロフィール
              </Link>
              <button onClick={handleLogout} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 text-left">
                <LogOut className="h-4 w-4" /> ログアウト
              </button>
            </>
          ) : (
            <Link href="/login" className="text-sm text-primary font-medium" onClick={() => setMobileOpen(false)}>
              ログイン
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

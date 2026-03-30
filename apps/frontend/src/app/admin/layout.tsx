'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarChart3, Users, BookOpen, MessageSquare, Sparkles, FileText, Megaphone, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin', label: 'ダッシュボード', icon: BarChart3 },
  { href: '/admin/users', label: 'ユーザー', icon: Users },
  { href: '/admin/works', label: '作品', icon: BookOpen },
  { href: '/admin/reviews', label: 'レビュー', icon: MessageSquare },
  { href: '/admin/announcements', label: 'お知らせ', icon: Megaphone },
  { href: '/admin/ai', label: 'AI設定', icon: Sparkles },
  { href: '/admin/ai/templates', label: 'テンプレート', icon: FileText },
];

const ADMIN_VERIFIED_KEY = 'admin_panel_verified';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [serverVerified, setServerVerified] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Check sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(ADMIN_VERIFIED_KEY) === 'true') {
      setPasswordVerified(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'ADMIN')) {
      router.push('/');
      return;
    }

    if (!isLoading && isAuthenticated && user?.role === 'ADMIN') {
      setServerVerified(true);
    }
  }, [isLoading, isAuthenticated, user, router]);

  const handlePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setVerifying(true);
    setPasswordError('');
    try {
      await api.verifyAdminPassword(password);
      sessionStorage.setItem(ADMIN_VERIFIED_KEY, 'true');
      setPasswordVerified(true);
    } catch {
      setPasswordError('パスワードが正しくありません');
    }
    setVerifying(false);
  }, [password]);

  if (isLoading || !isAuthenticated || user?.role !== 'ADMIN' || !serverVerified) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!passwordVerified) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <form onSubmit={handlePasswordSubmit} className="w-full max-w-sm space-y-4">
          <div className="text-center mb-6">
            <Lock className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <h2 className="text-lg font-semibold">管理画面</h2>
            <p className="text-sm text-muted-foreground mt-1">管理パスワードを入力してください</p>
          </div>
          <Input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
            placeholder="管理パスワード"
            autoFocus
          />
          {passwordError && (
            <p className="text-sm text-destructive">{passwordError}</p>
          )}
          <Button type="submit" className="w-full" disabled={verifying || !password.trim()}>
            {verifying ? '確認中...' : 'ログイン'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-lg font-semibold tracking-wide">Admin</h1>
        <p className="text-xs text-muted-foreground mt-1">System management</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <nav className="md:w-48 flex-shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-secondary text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Main Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

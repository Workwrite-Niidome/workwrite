'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { Loading } from '@/components/layout/loading';
import { Settings, BookOpen, Bookmark, Bell, BarChart3, Feather, ChevronRight } from 'lucide-react';

export default function ProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setDisplayName(user.displayName || '');
    }
    api.getMyProfile()
      .then((res) => {
        const p = res.data;
        setName(p.name || '');
        setDisplayName(p.displayName || '');
        setBio(p.bio || '');
      })
      .catch(() => {});
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api.updateMyProfile({ name, displayName, bio });
      setMessage('保存しました');
    } catch {
      setMessage('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return <Loading />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">ログインしてください</p>
      </div>
    );
  }

  const mobileMenuItems = [
    { href: '/bookshelf', label: '本棚', icon: BookOpen },
    { href: '/bookmarks', label: 'しおり', icon: Bookmark },
    { href: '/notifications', label: '通知', icon: Bell },
    { href: '/stats', label: '統計', icon: BarChart3 },
    { href: '/dashboard', label: '執筆ダッシュボード', icon: Feather },
    { href: '/settings', label: '設定', icon: Settings },
  ];

  return (
    <div className="py-4 md:px-4 md:py-8 space-y-0 md:space-y-6">
      {/* Mobile-only menu links (sidebar handles this on PC) */}
      <div className="md:hidden border-b border-border">
        {mobileMenuItems.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted transition-colors ${i < mobileMenuItems.length - 1 ? 'border-b border-border' : ''}`}
          >
            <item.icon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">{item.label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>

      {/* Profile form — flat on mobile, Card on PC */}
      <div className="md:hidden">
        <div className="px-4 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">プロフィール</h2>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="text-xs h-8 gap-1">
                <Settings className="h-3.5 w-3.5" />
                設定
              </Button>
            </Link>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            {message && (
              <div className="p-3 text-sm rounded-md bg-muted">{message}</div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">ニックネーム</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">表示名</label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">自己紹介</label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="自己紹介を書いてみましょう"
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? '保存中...' : '保存'}
            </Button>
          </form>
        </div>
      </div>

      <div className="hidden md:block">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Profile</CardTitle>
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="text-xs h-8 gap-1">
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              {message && (
                <div className="p-3 text-sm rounded-md bg-muted">{message}</div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">ニックネーム</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">表示名</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">自己紹介</label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="自己紹介を書いてみましょう"
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

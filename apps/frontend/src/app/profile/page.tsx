'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api, type BillingStatus } from '@/lib/api';
import { Loading } from '@/components/layout/loading';
import { Settings, BookOpen, Bookmark, Bell, BarChart3, Feather, ChevronRight, Crown, RefreshCw, Sparkles, CreditCard, Camera, Loader2 } from 'lucide-react';

type AiProfile = {
  personalityType?: string;
  personality?: string;
  description?: string;
  recommendedGenres?: string[];
  readingStyle?: string;
  strengths?: string[];
};

export default function ProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Reading profile
  const [aiProfile, setAiProfile] = useState<AiProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Billing
  const [billing, setBilling] = useState<BillingStatus | null>(null);

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
        setAvatarUrl(p.avatarUrl || null);
      })
      .catch(() => {});

    api.getAiProfile()
      .then((res) => {
        const unwrapped = (res as any)?.data ?? res;
        const profile = unwrapped?.aiProfile ?? unwrapped;
        if (profile && typeof profile === 'object' && Object.keys(profile).length > 0) {
          setAiProfile(profile);
        }
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));

    api.getBillingStatus()
      .then((res) => {
        const data = (res as any)?.data ?? res;
        setBilling(data);
      })
      .catch(() => {});
  }, [user]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage('画像サイズは2MB以下にしてください');
      return;
    }
    setAvatarUploading(true);
    setMessage('');
    try {
      const res = await api.uploadAvatar(file);
      const newUrl = res?.data?.avatarUrl || res?.avatarUrl;
      if (newUrl) setAvatarUrl(newUrl);
      setMessage('アイコンを更新しました');
    } catch (err: any) {
      setMessage(err.message || 'アイコンの更新に失敗しました');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

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

  const currentPlan = billing?.plan || 'free';
  const credits = billing?.credits || { total: 0, monthly: 0, purchased: 0 };
  const planLabel = currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1);

  const mobileMenuItems = [
    { href: '/bookshelf', label: '本棚', icon: BookOpen },
    { href: '/bookmarks', label: 'しおり', icon: Bookmark },
    { href: '/notifications', label: '通知', icon: Bell },
    { href: '/stats', label: '統計', icon: BarChart3 },
    { href: '/dashboard', label: '執筆ダッシュボード', icon: Feather },
    { href: '/pricing', label: '料金プラン', icon: Crown },
    { href: '/settings', label: '設定', icon: Settings },
  ];

  const avatarSection = (
    <div className="flex items-center gap-4 mb-4">
      <div className="relative group">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
          {avatarUrl ? (
            <img src={avatarUrl} alt="アイコン" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-medium text-muted-foreground">
              {(user?.displayName || user?.name || '?')[0]}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={avatarUploading}
          className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          {avatarUploading ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : (
            <Camera className="h-5 w-5 text-white" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleAvatarUpload}
        />
      </div>
      <div>
        <p className="text-sm font-medium">{user?.displayName || user?.name}</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={avatarUploading}
          className="text-xs text-primary hover:underline"
        >
          {avatarUploading ? 'アップロード中...' : 'アイコンを変更'}
        </button>
        <p className="text-[10px] text-muted-foreground mt-0.5">JPEG, PNG, GIF, WebP / 2MB以下</p>
      </div>
    </div>
  );

  const profileForm = (
    <form onSubmit={handleSave} className="space-y-4">
      {message && (
        <div className="p-3 text-sm rounded-md bg-muted">{message}</div>
      )}
      {avatarSection}
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
  );

  const readingProfileCard = (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          読書プロフィール
        </CardTitle>
      </CardHeader>
      <CardContent>
        {profileLoading ? (
          <div className="space-y-2">
            <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
            <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
          </div>
        ) : aiProfile ? (
          <div className="space-y-4">
            {(aiProfile.personalityType || aiProfile.description || aiProfile.personality) && (
              <div>
                {aiProfile.personalityType && (
                  <p className="text-sm font-medium mb-1">{aiProfile.personalityType}</p>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {aiProfile.description || aiProfile.personality || ''}
                </p>
              </div>
            )}
            {aiProfile.strengths && aiProfile.strengths.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5">あなたの強み</p>
                <div className="flex flex-wrap gap-1">
                  {aiProfile.strengths.map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            {aiProfile.recommendedGenres && aiProfile.recommendedGenres.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5">おすすめジャンル</p>
                <div className="flex flex-wrap gap-1">
                  {aiProfile.recommendedGenres.map((genre) => (
                    <Badge key={genre} variant="secondary" className="text-[10px]">{genre}</Badge>
                  ))}
                </div>
              </div>
            )}
            {aiProfile.readingStyle && (
              <div>
                <p className="text-xs font-medium mb-1">読書スタイル</p>
                <p className="text-xs text-muted-foreground">{aiProfile.readingStyle}</p>
              </div>
            )}
            <div className="pt-2 border-t border-border">
              <Link href="/settings/reading-profile">
                <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-8 px-2">
                  <RefreshCw className="h-3 w-3" />
                  再診断する（1cr）
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground mb-3">まだ読書タイプ診断が完了していません。</p>
            <Link href="/settings/reading-profile">
              <Button variant="outline" size="sm" className="text-xs gap-1.5">
                <Sparkles className="h-3 w-3" />
                診断する
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const creditCard = (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{planLabel}プラン</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                残高: {credits.total}cr
                <span className="text-muted-foreground/60 ml-1">
                  （月間{credits.monthly} / 購入{credits.purchased}）
                </span>
              </p>
            </div>
          </div>
          <Link href="/settings/billing">
            <Button variant="ghost" size="sm" className="text-xs h-8">
              <Crown className="h-3 w-3 mr-1" />
              詳細
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );

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

      {/* Mobile layout */}
      <div className="md:hidden px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">マイページ</h2>
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="text-xs h-8 gap-1">
              <Settings className="h-3.5 w-3.5" />
              設定
            </Button>
          </Link>
        </div>

        {/* Credit balance */}
        {creditCard}

        {/* Reading profile */}
        {readingProfileCard}

        {/* Profile edit */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">プロフィール編集</CardTitle>
          </CardHeader>
          <CardContent>
            {profileForm}
          </CardContent>
        </Card>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:block space-y-6">
        <div className="grid gap-6 md:grid-cols-[1fr,320px]">
          {/* Left column: profile + credit */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>プロフィール</CardTitle>
                  <Link href="/settings">
                    <Button variant="ghost" size="sm" className="text-xs h-8 gap-1">
                      <Settings className="h-3.5 w-3.5" />
                      設定
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {profileForm}
              </CardContent>
            </Card>

            {/* Credit balance */}
            {creditCard}
          </div>

          {/* Right column: reading profile */}
          <div>
            {readingProfileCard}
          </div>
        </div>
      </div>
    </div>
  );
}

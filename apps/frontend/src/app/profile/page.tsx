'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Cropper, { type Area } from 'react-easy-crop';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api, type BillingStatus } from '@/lib/api';
import { Loading } from '@/components/layout/loading';
import { Settings, BookOpen, Bookmark, Bell, BarChart3, Feather, ChevronRight, Crown, RefreshCw, Sparkles, CreditCard, Camera, Loader2, Trash2, X } from 'lucide-react';

async function getCroppedBlob(src: string, crop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/jpeg', 0.92);
  });
}

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage('画像サイズは2MB以下にしてください');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedArea(croppedPixels);
  }, []);

  async function handleCropConfirm() {
    if (!cropSrc || !croppedArea) return;
    setAvatarUploading(true);
    setMessage('');
    try {
      const blob = await getCroppedBlob(cropSrc, croppedArea);
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      const res = await api.uploadAvatar(file);
      const newUrl = res?.data?.avatarUrl || res?.avatarUrl;
      if (newUrl) setAvatarUrl(newUrl);
      setMessage('アイコンを更新しました');
    } catch (err: any) {
      setMessage(err.message || 'アイコンの更新に失敗しました');
    } finally {
      setAvatarUploading(false);
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function handleDeleteAvatar() {
    setShowDeleteConfirm(false);
    setAvatarUploading(true);
    setMessage('');
    try {
      await api.deleteAvatar();
      setAvatarUrl(null);
      setMessage('アイコンを削除しました');
    } catch (err: any) {
      setMessage(err.message || 'アイコンの削除に失敗しました');
    } finally {
      setAvatarUploading(false);
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
          onChange={handleFileSelect}
        />
      </div>
      <div>
        <p className="text-sm font-medium">{user?.displayName || user?.name}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="text-xs text-primary hover:underline"
          >
            {avatarUploading ? 'アップロード中...' : 'アイコンを変更'}
          </button>
          {avatarUrl && (
            <>
              <span className="text-muted-foreground text-xs">|</span>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={avatarUploading}
                className="text-xs text-destructive hover:underline"
              >
                削除
              </button>
            </>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">JPEG, PNG, GIF, WebP / 2MB以下</p>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-background border border-border rounded-lg p-6 max-w-sm mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium">アイコンを削除しますか？</p>
            <p className="text-xs text-muted-foreground">デフォルトのアイコンに戻ります。</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                キャンセル
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDeleteAvatar}>
                <Trash2 className="h-3 w-3 mr-1" />
                削除する
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Crop modal */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
          <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border">
            <p className="text-sm font-medium">トリミング</p>
            <button type="button" onClick={handleCropCancel} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative flex-1">
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="px-4 py-3 bg-background border-t border-border space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-8">拡大</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleCropCancel}>
                キャンセル
              </Button>
              <Button size="sm" onClick={handleCropConfirm} disabled={avatarUploading}>
                {avatarUploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                設定する
              </Button>
            </div>
          </div>
        </div>
      )}
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

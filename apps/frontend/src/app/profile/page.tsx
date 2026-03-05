'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { Loading } from '@/components/layout/loading';

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>プロフィール設定</CardTitle>
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
  );
}

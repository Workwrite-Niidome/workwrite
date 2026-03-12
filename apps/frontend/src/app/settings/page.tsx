'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loading } from '@/components/layout/loading';
import { Copy, Check } from 'lucide-react';

export default function SettingsPage() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState('');
  const [pwError, setPwError] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Invite codes
  const [inviteCodes, setInviteCodes] = useState<{ code: string; maxUses: number; usedCount: number; isActive: boolean; usages: { userId: string; usedAt: string }[] }[]>([]);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api.getMyInviteCodes()
      .then((res) => setInviteCodes(Array.isArray(res) ? res : []))
      .catch(() => {})
      .finally(() => setInviteLoading(false));
  }, [user]);

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  if (authLoading) return <Loading />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">ログインしてください</p>
      </div>
    );
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage('');
    setPwError(false);

    if (newPassword.length < 8) {
      setPwMessage('新しいパスワードは8文字以上にしてください');
      setPwError(true);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage('パスワードが一致しません');
      setPwError(true);
      return;
    }

    setPwSaving(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setPwMessage('パスワードを変更しました');
      setPwError(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwMessage(err.message || 'パスワードの変更に失敗しました');
      setPwError(true);
    } finally {
      setPwSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      await api.deleteAccount();
      logout();
      router.push('/');
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="px-4 md:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-lg font-semibold tracking-wide">設定</h1>
        <p className="text-xs text-muted-foreground mt-1">
          <Link href="/profile" className="hover:text-foreground transition-colors underline">
            プロフィールに戻る
          </Link>
        </p>
      </div>

      {/* Invite Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">招待コード</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            友人や仲間を招待できます。各コードは1回のみ使用可能です。
          </p>
          {inviteLoading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : inviteCodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">招待コードがありません</p>
          ) : (
            <div className="space-y-2">
              {inviteCodes.map((ic) => (
                <div key={ic.code} className="flex items-center justify-between border border-border rounded-md px-3 py-2">
                  <div className="flex items-center gap-2">
                    <code className={`text-sm font-mono ${ic.usedCount >= ic.maxUses ? 'text-muted-foreground line-through' : ''}`}>
                      {ic.code}
                    </code>
                    {ic.usedCount >= ic.maxUses && (
                      <span className="text-xs text-muted-foreground">使用済み</span>
                    )}
                  </div>
                  {ic.usedCount < ic.maxUses && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyCode(ic.code)}>
                      {copiedCode === ic.code ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">セキュリティ</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {pwMessage && (
              <div className={`p-3 text-sm rounded-md ${pwError ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'}`}>
                {pwMessage}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="current-password">現在のパスワード</label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-password">新しいパスワード</label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8文字以上"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="confirm-password">新しいパスワード（確認）</label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={pwSaving || !currentPassword || !newPassword}>
              {pwSaving ? '保存中...' : 'パスワードを変更'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Deletion */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">危険な操作</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            アカウントを削除すると、すべての作品・レビュー・読書データ・プロフィール情報が完全に削除され、復元できません。
          </p>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="delete-confirm">
                確認のため <span className="font-mono text-destructive">DELETE</span> と入力してください
              </label>
              <Input
                id="delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="max-w-xs"
              />
            </div>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== 'DELETE' || deleting}
              onClick={handleDeleteAccount}
            >
              {deleting ? '削除中...' : 'アカウントを削除する'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

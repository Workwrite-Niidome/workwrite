'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'ok' | 'down'>('checking');
  const { register } = useAuth();
  const router = useRouter();

  useEffect(() => {
    api.checkHealth().then(({ ok, db }) => {
      setServerStatus(ok && db ? 'ok' : 'down');
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError('利用規約に同意してください');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(email, password, name, inviteCode);
      router.push('/onboarding');
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('接続できません') || err.message.includes('サーバー')) {
          setError('サーバーに接続できません。しばらく待ってから再度お試しください。');
        } else if (err.message === 'Email already registered') {
          setError('このメールアドレスは既に登録されています');
        } else if (err.message.includes('招待コード')) {
          setError(err.message);
        } else {
          setError(err.message);
        }
      } else {
        setError('登録に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>新規登録</CardTitle>
          <CardDescription>招待コードをお持ちの方はベータ版にご参加いただけます</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {serverStatus === 'down' && (
              <div className="flex items-start gap-2 p-3 text-sm text-orange-800 bg-orange-50 dark:text-orange-200 dark:bg-orange-950/50 rounded-md border border-orange-200 dark:border-orange-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">サーバーに接続できません</p>
                  <p className="text-xs mt-1 opacity-80">
                    Docker Desktop を起動し、<code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">docker compose up -d</code> を実行してください。
                  </p>
                </div>
              </div>
            )}
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="inviteCode" className="text-sm font-medium">招待コード</label>
              <Input
                id="inviteCode"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="WW-XXXXXXXX"
                required
                className="font-mono tracking-wider"
              />
              <p className="text-xs text-muted-foreground">ベータテスターの方に配布している招待コードを入力してください</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">ニックネーム</label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="読書太郎"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">メールアドレス</label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mail@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">パスワード</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8文字以上"
                minLength={8}
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="agree"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="agree" className="text-sm text-muted-foreground">
                <Link href="/terms" className="text-primary hover:underline">利用規約</Link>
                に同意します
              </label>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Button type="submit" className="w-full" disabled={loading || serverStatus === 'down'}>
              {loading ? '登録中...' : '登録する'}
            </Button>
            <p className="text-sm text-muted-foreground">
              すでにアカウントをお持ちの方は{' '}
              <Link href="/login" className="text-primary hover:underline">ログイン</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

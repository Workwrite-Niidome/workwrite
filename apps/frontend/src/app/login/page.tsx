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

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'ok' | 'server_down' | 'db_down'>('checking');
  const { login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    api.checkHealth().then(({ ok, db }) => {
      if (!ok) setServerStatus('server_down');
      else if (!db) setServerStatus('db_down');
      else setServerStatus('ok');
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('接続できません') || err.message.includes('サーバー')) {
          setError('サーバーに接続できません。Docker Desktopとバックエンドが起動しているか確認してください。');
        } else if (err.message === 'Invalid credentials') {
          setError('メールアドレスまたはパスワードが正しくありません');
        } else {
          setError(err.message);
        }
      } else {
        setError('ログインに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>ログイン</CardTitle>
          <CardDescription>メールアドレスでログイン</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {serverStatus === 'server_down' && (
              <div className="flex items-start gap-2 p-3 text-sm text-orange-800 bg-orange-50 dark:text-orange-200 dark:bg-orange-950/50 rounded-md border border-orange-200 dark:border-orange-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">バックエンドに接続できません</p>
                  <p className="text-xs mt-1 opacity-80">
                    Docker Desktop を起動し、<code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">docker compose up -d</code> を実行してから
                    <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">npm run dev</code> でバックエンドを起動してください。
                  </p>
                </div>
              </div>
            )}
            {serverStatus === 'db_down' && (
              <div className="flex items-start gap-2 p-3 text-sm text-orange-800 bg-orange-50 dark:text-orange-200 dark:bg-orange-950/50 rounded-md border border-orange-200 dark:border-orange-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">データベースに接続できません</p>
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
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Button type="submit" className="w-full" disabled={loading || serverStatus === 'server_down'}>
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">または</span></div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => { window.location.href = api.getTwitterAuthUrl(); }}
              disabled={serverStatus === 'server_down'}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              X (Twitter) でログイン
            </Button>
            <p className="text-sm text-muted-foreground">
              アカウントをお持ちでない方は{' '}
              <Link href="/register" className="text-primary hover:underline">新規登録</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

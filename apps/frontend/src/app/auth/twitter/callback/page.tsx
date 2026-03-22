'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

function TwitterCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      setError('Twitter認証がキャンセルされました');
      setTimeout(() => router.push('/login'), 2000);
      return;
    }

    api.twitterCallback(code, state)
      .then((res) => {
        const data = (res as any).data || res;
        api.setToken(data.accessToken);
        if (typeof window !== 'undefined') {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        const raw = sessionStorage.getItem('auth_redirect') || '/';
        sessionStorage.removeItem('auth_redirect');
        // Only allow relative paths on this origin to prevent open redirect
        const redirect = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
        window.location.href = redirect;
      })
      .catch((err: any) => {
        setError(err.message || 'Twitter認証に失敗しました');
        setTimeout(() => router.push('/login'), 3000);
      });
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center space-y-3">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Twitter認証中...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function TwitterCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <TwitterCallbackContent />
    </Suspense>
  );
}

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const params = useSearchParams();
  const isCredits = params.get('type') === 'credits';

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <Check className="h-6 w-6 text-green-600" />
        </div>
        <h1 className="text-xl font-bold mb-2">
          {isCredits ? '\u30AF\u30EC\u30B8\u30C3\u30C8\u8CFC\u5165\u5B8C\u4E86' : '\u30D7\u30E9\u30F3\u767B\u9332\u5B8C\u4E86'}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {isCredits
            ? '\u30AF\u30EC\u30B8\u30C3\u30C8\u304C\u30A2\u30AB\u30A6\u30F3\u30C8\u306B\u8FFD\u52A0\u3055\u308C\u307E\u3057\u305F\u3002'
            : '\u30D7\u30E9\u30F3\u304C\u6709\u52B9\u5316\u3055\u308C\u307E\u3057\u305F\u3002\u30AF\u30EC\u30B8\u30C3\u30C8\u304C\u4ED8\u4E0E\u3055\u308C\u3066\u3044\u307E\u3059\u3002'}
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/settings/billing">
            <Button variant="outline" size="sm">{'\u8AB2\u91D1\u8A2D\u5B9A\u3078'}</Button>
          </Link>
          <Link href="/">
            <Button size="sm">{'\u30DB\u30FC\u30E0\u3078'}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><p>Loading...</p></div>}>
      <SuccessContent />
    </Suspense>
  );
}

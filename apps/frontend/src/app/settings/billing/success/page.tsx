'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

function SuccessContent() {
  const params = useSearchParams();
  const isCredits = params.get('type') === 'credits';
  const [creditBalance, setCreditBalance] = useState<{ total: number; purchased: number } | null>(null);
  const [verifying, setVerifying] = useState(isCredits);
  const pollCount = useRef(0);

  useEffect(() => {
    if (!isCredits) return;

    // Poll for credit balance update (webhook may be delayed)
    let cancelled = false;
    const initialBalance = { total: 0, purchased: 0 };

    async function checkBalance() {
      try {
        const res = await api.getBillingStatus();
        const credits = res.credits;

        // On first call, record initial balance
        if (pollCount.current === 0) {
          initialBalance.total = credits.total;
          initialBalance.purchased = credits.purchased;
        }

        setCreditBalance({ total: credits.total, purchased: credits.purchased });

        // If purchased balance increased or we've polled enough times, stop
        if (credits.purchased > initialBalance.purchased || pollCount.current >= 10) {
          setVerifying(false);
          return;
        }

        pollCount.current++;
        if (!cancelled) {
          setTimeout(checkBalance, 2000);
        }
      } catch {
        setVerifying(false);
      }
    }

    checkBalance();
    return () => { cancelled = true; };
  }, [isCredits]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          {verifying ? (
            <Loader2 className="h-6 w-6 text-green-600 animate-spin" />
          ) : (
            <Check className="h-6 w-6 text-green-600" />
          )}
        </div>
        <h1 className="text-xl font-bold mb-2">
          {isCredits ? 'クレジット購入完了' : 'プラン登録完了'}
        </h1>
        <p className="text-sm text-muted-foreground mb-2">
          {isCredits
            ? verifying
              ? 'クレジットを反映中です...'
              : 'クレジットがアカウントに追加されました。'
            : 'プランが有効化されました。クレジットが付与されています。'}
        </p>
        {isCredits && creditBalance && (
          <p className="text-lg font-bold mb-4">
            残高: {creditBalance.total}
            <span className="text-sm font-normal text-muted-foreground ml-1">cr</span>
            <span className="text-xs text-muted-foreground ml-2">
              (購入分: {creditBalance.purchased}cr)
            </span>
          </p>
        )}
        <div className="flex gap-3 justify-center mt-4">
          <Link href="/settings/billing">
            <Button variant="outline" size="sm">課金設定へ</Button>
          </Link>
          <Link href="/">
            <Button size="sm">ホームへ</Button>
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

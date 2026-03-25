'use client';

import Link from 'next/link';
import { XCircle } from 'lucide-react';

export default function LetterCancelledPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <XCircle className="h-16 w-16 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-bold">ギフトレターの送信をキャンセルしました</h1>
        <p className="text-muted-foreground">
          お支払いはされていません。もう一度お試しいただけます。
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          トップに戻る
        </Link>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { CheckCircle } from 'lucide-react';

export default function LetterSentPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        <h1 className="text-2xl font-bold">ギフトレターを送信しました</h1>
        <p className="text-muted-foreground">
          お支払いが完了し、著者にギフトレターが届きました。応援ありがとうございます！
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

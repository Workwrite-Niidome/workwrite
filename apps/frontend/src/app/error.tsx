'use client';

import { Button } from '@/components/ui/button';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center px-4">
      <h1 className="text-6xl font-bold text-destructive">500</h1>
      <h2 className="text-xl font-semibold">サーバーエラー</h2>
      <p className="text-muted-foreground max-w-md">
        申し訳ありません。問題が発生しました。しばらくしてからもう一度お試しください。
      </p>
      <Button onClick={reset}>再試行</Button>
    </div>
  );
}

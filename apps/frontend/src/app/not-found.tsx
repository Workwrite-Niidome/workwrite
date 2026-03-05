import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center px-4">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <h2 className="text-xl font-semibold">ページが見つかりません</h2>
      <p className="text-muted-foreground max-w-md">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <Link href="/">
        <Button>トップページに戻る</Button>
      </Link>
    </div>
  );
}

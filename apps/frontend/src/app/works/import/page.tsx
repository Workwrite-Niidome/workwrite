'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ImportPage() {
  return (
    <div className="px-4 py-16 max-w-lg mx-auto text-center">
      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h1 className="text-xl font-bold mb-2">テキストファイルのインポート機能を準備しております</h1>
      <p className="text-sm text-muted-foreground mb-6">
        テキストファイル（.txt）からの一括取り込み機能を開発中です。
        公開時期はお知らせにてご案内いたします。
      </p>
      <p className="text-xs text-muted-foreground mb-8">
        作品の投稿は「新規作成」または「編集者モード」からお願いいたします。
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/works/new">
          <Button>新規作品を作成</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline">ダッシュボードへ</Button>
        </Link>
      </div>
    </div>
  );
}

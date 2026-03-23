'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export function Footer() {
  const { isAuthenticated } = useAuth();

  return (
    <footer className="border-t border-border pb-24 md:pb-0">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <h3 className="text-xs tracking-[0.15em] text-muted-foreground mb-3">読む</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="/discover" className="hover:text-foreground transition-colors">作品を探す</Link></li>
              <li><Link href="/search" className="hover:text-foreground transition-colors">検索</Link></li>
              {isAuthenticated && (
                <li><Link href="/bookshelf" className="hover:text-foreground transition-colors">本棚</Link></li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-xs tracking-[0.15em] text-muted-foreground mb-3">書く</h3>
            <ul className="space-y-2 text-muted-foreground">
              {isAuthenticated ? (
                <>
                  <li><Link href="/dashboard" className="hover:text-foreground transition-colors">ダッシュボード</Link></li>
                  <li><Link href="/works/new" className="hover:text-foreground transition-colors">作品を投稿</Link></li>
                </>
              ) : (
                <li><Link href="/register" className="hover:text-foreground transition-colors">書き始める</Link></li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-xs tracking-[0.15em] text-muted-foreground mb-3">サポート</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="/guide/writers" className="hover:text-foreground transition-colors">執筆ガイド</Link></li>
              <li><Link href="/help" className="hover:text-foreground transition-colors">ヘルプ</Link></li>
              <li><Link href="/guidelines" className="hover:text-foreground transition-colors">投稿ガイドライン</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs tracking-[0.15em] text-muted-foreground mb-3">法的情報</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="/terms" className="hover:text-foreground transition-colors">利用規約</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground transition-colors">プライバシーポリシー</Link></li>
              <li><Link href="/legal/tokushoho" className="hover:text-foreground transition-colors">特定商取引法に基づく表記</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          Workwrite
        </div>
      </div>
    </footer>
  );
}

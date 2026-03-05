import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-sm font-semibold mb-3">読者向け</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/discover" className="hover:text-foreground">作品を探す</Link></li>
              <li><Link href="/search" className="hover:text-foreground">検索</Link></li>
              <li><Link href="/bookshelf" className="hover:text-foreground">本棚</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">作家向け</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/dashboard" className="hover:text-foreground">ダッシュボード</Link></li>
              <li><Link href="/works/new" className="hover:text-foreground">作品を投稿</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">サポート</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/help" className="hover:text-foreground">ヘルプ</Link></li>
              <li><Link href="/guidelines" className="hover:text-foreground">投稿ガイドライン</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">法的情報</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/terms" className="hover:text-foreground">利用規約</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground">プライバシーポリシー</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-border pt-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} 超読者ファースト
        </div>
      </div>
    </footer>
  );
}

'use client';

import { usePathname } from 'next/navigation';
import { Header } from './header';
import { Footer } from './footer';
import { BottomNav } from './bottom-nav';

/** Paths where the full-screen editor is used — hide Header/Footer/BottomNav */
function isWritingPage(pathname: string): boolean {
  // /works/[id]/episodes/[episodeId]/edit, /works/[id]/episodes/new
  // NOTE: /works/[id]/edit is the work management page — keep chrome there
  return /^\/works\/[^/]+\/episodes\/[^/]+\/edit/.test(pathname) ||
    /^\/works\/[^/]+\/episodes\/new/.test(pathname);
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = isWritingPage(pathname);

  if (hideChrome) {
    return <main className="h-screen">{children}</main>;
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <BottomNav />
    </>
  );
}

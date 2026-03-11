'use client';

import { usePathname } from 'next/navigation';
import { Header } from './header';
import { Footer } from './footer';
import { BottomNav } from './bottom-nav';
import { Sidebar } from './sidebar';

/** Paths where the full-screen editor is used — hide Header/Footer/BottomNav */
function isWritingPage(pathname: string): boolean {
  return /^\/works\/[^/]+\/episodes\/[^/]+\/edit/.test(pathname) ||
    /^\/works\/[^/]+\/episodes\/new/.test(pathname);
}

/** Paths where sidebar is hidden (reader, compose-only views) */
function isReaderPage(pathname: string): boolean {
  return pathname.startsWith('/read/');
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = isWritingPage(pathname);

  if (hideChrome) {
    return <main className="h-screen">{children}</main>;
  }

  const showSidebar = !isReaderPage(pathname);

  return (
    <>
      <Header />
      <div className={showSidebar ? 'mx-auto max-w-6xl px-4 md:flex md:gap-6' : ''}>
        {showSidebar && <Sidebar />}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      <Footer />
      <BottomNav />
    </>
  );
}

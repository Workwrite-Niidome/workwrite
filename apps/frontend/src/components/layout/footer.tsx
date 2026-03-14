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
            <h3 className="text-xs tracking-[0.15em] uppercase text-muted-foreground mb-3">Reader</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="/discover" className="hover:text-foreground transition-colors">Discover</Link></li>
              <li><Link href="/search" className="hover:text-foreground transition-colors">Search</Link></li>
              {isAuthenticated && (
                <li><Link href="/bookshelf" className="hover:text-foreground transition-colors">Bookshelf</Link></li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-xs tracking-[0.15em] uppercase text-muted-foreground mb-3">Writing</h3>
            <ul className="space-y-2 text-muted-foreground">
              {isAuthenticated ? (
                <>
                  <li><Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link></li>
                  <li><Link href="/works/new" className="hover:text-foreground transition-colors">Post a Work</Link></li>
                </>
              ) : (
                <li><Link href="/register" className="hover:text-foreground transition-colors">Start Writing</Link></li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-xs tracking-[0.15em] uppercase text-muted-foreground mb-3">Support</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="/guide/writers" className="hover:text-foreground transition-colors">Writers Guide</Link></li>
              <li><Link href="/help" className="hover:text-foreground transition-colors">Help</Link></li>
              <li><Link href="/guidelines" className="hover:text-foreground transition-colors">Guidelines</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs tracking-[0.15em] uppercase text-muted-foreground mb-3">Legal</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link></li>
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

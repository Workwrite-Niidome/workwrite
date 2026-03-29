import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
import { LayoutShell } from '@/components/layout/layout-shell';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Workwrite - 読後の自己変容を設計する小説プラットフォーム',
  description:
    'AIスコアリングと感情タグで、あなたの「次の一冊」を見つける。埋もれた名作を発見し、読書体験を通じて自己変容を記録する新しい小説プラットフォーム。',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <LayoutShell>{children}</LayoutShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

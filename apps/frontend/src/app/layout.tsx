import type { Metadata } from 'next';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Workwrite - 読後の自己変容を設計する小説プラットフォーム',
  description:
    'AIスコアリングと感情タグで、あなたの「次の一冊」を見つける。埋もれた名作を発見し、読書体験を通じて自己変容を記録する新しい小説プラットフォーム。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="flex min-h-screen flex-col">
        <AuthProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}

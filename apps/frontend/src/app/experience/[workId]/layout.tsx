import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Experience - Workwrite',
  robots: 'noindex',
};

export default function ExperienceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', overflow: 'hidden' }}>
      {children}
    </div>
  );
}

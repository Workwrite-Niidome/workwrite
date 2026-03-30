import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Experience - Workwrite',
  robots: 'noindex',
};

export default function ExperienceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes awarenessGlow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      {children}
    </>
  );
}

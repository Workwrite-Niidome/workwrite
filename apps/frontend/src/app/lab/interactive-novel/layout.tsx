import type { Metadata } from 'next';
import { LabAuthGuard } from './components/lab-auth-guard';

export const metadata: Metadata = {
  title: 'Interactive Novel Lab - Workwrite',
  robots: 'noindex',
};

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease;
        }
      `}</style>
      <LabAuthGuard>{children}</LabAuthGuard>
    </>
  );
}

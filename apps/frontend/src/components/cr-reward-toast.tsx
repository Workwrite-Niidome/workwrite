'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Coins } from 'lucide-react';

interface CrRewardToastProps {
  amount: number;
  reason: string;
  show: boolean;
  onDone?: () => void;
}

export function CrRewardToast({ amount, reason, show, onDone }: CrRewardToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onDone?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onDone]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 bg-card border border-primary/20 shadow-lg rounded-full px-5 py-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Coins className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">+{amount}Cr 獲得</p>
          <p className="text-[11px] text-muted-foreground">{reason}</p>
        </div>
      </div>
    </div>
  );
}

/** Simple hook to trigger Cr reward toast */
export function useCrRewardToast() {
  const [reward, setReward] = useState<{ amount: number; reason: string } | null>(null);

  function showReward(amount: number, reason: string) {
    setReward({ amount, reason });
  }

  function clearReward() {
    setReward(null);
  }

  return { reward, showReward, clearReward };
}

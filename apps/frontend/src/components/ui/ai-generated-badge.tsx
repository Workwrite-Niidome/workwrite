'use client';

import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiGeneratedBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function AiGeneratedBadge({ className, size = 'sm' }: AiGeneratedBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        'bg-violet-500/10 border-violet-500/30 text-violet-600 dark:text-violet-400',
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        className,
      )}
    >
      <Bot className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      AI Generated
    </span>
  );
}

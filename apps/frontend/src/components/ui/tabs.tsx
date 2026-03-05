'use client';

import { cn } from '@/lib/utils';

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeKey: string;
  onTabChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeKey, onTabChange, className }: TabsProps) {
  return (
    <div className={cn('flex gap-1 border-b border-border', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors min-h-[44px]',
            activeKey === tab.key
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

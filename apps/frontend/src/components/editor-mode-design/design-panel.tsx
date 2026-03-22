'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { TAB_DEFINITIONS, isTabFilled, getFilledCount } from './types';
import type { DesignData, DesignTab } from './types';
import { OverviewTab } from './overview-tab';
import { CharactersTab } from './characters-tab';
import { WorldTab } from './world-tab';
import { PlotTab } from './plot-tab';
import { PreviewTab } from './preview-tab';

interface Props {
  design: DesignData;
  onChange: (d: Partial<DesignData>) => void;
  onFinalize: () => void;
  finalizing: boolean;
  creditsRemaining: number | null;
  creditsConsumed: number;
  highlightedTab: DesignTab | null;
}

export function DesignPanel({
  design,
  onChange,
  onFinalize,
  finalizing,
  creditsRemaining,
  creditsConsumed,
  highlightedTab,
}: Props) {
  const [activeTab, setActiveTab] = useState<DesignTab>('overview');
  const filledCount = getFilledCount(design);
  const maxCount = 17; // total trackable fields

  return (
    <div className="flex flex-col h-full">
      {/* Progress */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-xs text-muted-foreground">{filledCount} 項目設定済み</p>
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden mt-1">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${Math.min((filledCount / maxCount) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 px-2 pt-2 pb-0 overflow-x-auto scrollbar-none border-b border-border">
        {TAB_DEFINITIONS.map((tab) => {
          const filled = isTabFilled(design, tab.key);
          const highlighted = highlightedTab === tab.key;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {/* Status dot */}
              {(filled || highlighted) && (
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full flex-shrink-0',
                    highlighted
                      ? 'bg-indigo-500 animate-pulse'
                      : 'bg-green-500',
                  )}
                />
              )}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && <OverviewTab design={design} onChange={onChange} />}
        {activeTab === 'characters' && <CharactersTab design={design} onChange={onChange} />}
        {activeTab === 'world' && <WorldTab design={design} onChange={onChange} />}
        {activeTab === 'plot' && <PlotTab design={design} onChange={onChange} />}
        {activeTab === 'preview' && (
          <PreviewTab
            design={design}
            onFinalize={onFinalize}
            finalizing={finalizing}
            creditsRemaining={creditsRemaining}
            creditsConsumed={creditsConsumed}
          />
        )}
      </div>
    </div>
  );
}

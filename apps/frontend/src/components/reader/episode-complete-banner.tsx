'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Droplets, Heart, Zap, Flame, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

const REACTIONS = [
  { icon: Droplets, label: '泣いた', value: 'moved' },
  { icon: Heart, label: '温かい', value: 'warm' },
  { icon: Zap, label: '驚いた', value: 'surprised' },
  { icon: Flame, label: '燃えた', value: 'fired_up' },
  { icon: Brain, label: '考えた', value: 'thoughtful' },
];

interface EpisodeCompleteBannerProps {
  nextEpisodeId?: string;
  workId: string;
  onReaction?: (value: string) => void;
}

export function EpisodeCompleteBanner({ nextEpisodeId, workId, onReaction }: EpisodeCompleteBannerProps) {
  const [selectedReactions, setSelectedReactions] = useState<Set<string>>(new Set());

  function handleReaction(value: string) {
    setSelectedReactions((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
    onReaction?.(value);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="border-t border-border pt-8">
        <p className="text-sm text-muted-foreground mb-4">この話はどうでしたか？</p>
        <div className="flex justify-center gap-4">
          {REACTIONS.map((r) => {
            const selected = selectedReactions.has(r.value);
            return (
              <button
                key={r.value}
                onClick={() => handleReaction(r.value)}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div
                  className={cn(
                    'h-10 w-10 rounded-full border flex items-center justify-center transition-all group-active:scale-95',
                    selected
                      ? 'border-primary bg-primary/20 scale-110'
                      : 'border-border group-hover:border-primary group-hover:bg-primary/10',
                  )}
                >
                  <r.icon
                    className={cn(
                      'h-5 w-5 transition-colors',
                      selected
                        ? 'text-primary'
                        : 'text-muted-foreground group-hover:text-primary',
                    )}
                  />
                </div>
                <span
                  className={cn(
                    'text-[10px] transition-colors',
                    selected ? 'text-primary font-medium' : 'text-muted-foreground group-hover:text-foreground',
                  )}
                >
                  {r.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center gap-3">
        {nextEpisodeId ? (
          <>
            <Link href={`/works/${workId}`}>
              <Button variant="outline" className="min-h-[44px]">ここまでにする</Button>
            </Link>
            <Link href={`/read/${nextEpisodeId}`}>
              <Button className="min-h-[44px]">次話を読む</Button>
            </Link>
          </>
        ) : (
          <Link href={`/works/${workId}/afterword`}>
            <Button className="min-h-[44px]">読了</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

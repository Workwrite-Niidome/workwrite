'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Droplets, Heart, Zap, Flame, Brain } from 'lucide-react';

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
  return (
    <div className="mx-auto max-w-2xl px-6 py-8 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="border-t border-border pt-8">
        <p className="text-sm text-muted-foreground mb-4">この話はどうでしたか？</p>
        <div className="flex justify-center gap-4">
          {REACTIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => onReaction?.(r.value)}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div className="h-10 w-10 rounded-full border border-border flex items-center justify-center transition-all group-hover:border-primary group-hover:bg-primary/10 group-active:scale-95">
                <r.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">{r.label}</span>
            </button>
          ))}
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

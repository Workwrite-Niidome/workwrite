'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

const REACTIONS = [
  { emoji: '😢', label: '泣いた' },
  { emoji: '😊', label: '温かい' },
  { emoji: '😲', label: '驚いた' },
  { emoji: '🔥', label: '燃えた' },
  { emoji: '🤔', label: '考えた' },
];

interface EpisodeCompleteBannerProps {
  nextEpisodeId?: string;
  workId: string;
  onReaction?: (emoji: string) => void;
}

export function EpisodeCompleteBanner({ nextEpisodeId, workId, onReaction }: EpisodeCompleteBannerProps) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="border-t border-border pt-8">
        <p className="text-sm text-muted-foreground mb-4">この話はどうでしたか？</p>
        <div className="flex justify-center gap-3">
          {REACTIONS.map((r) => (
            <button
              key={r.emoji}
              onClick={() => onReaction?.(r.emoji)}
              className="flex flex-col items-center gap-1 group"
            >
              <span className="text-2xl transition-transform group-hover:scale-125 group-active:scale-95">
                {r.emoji}
              </span>
              <span className="text-[10px] text-muted-foreground">{r.label}</span>
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

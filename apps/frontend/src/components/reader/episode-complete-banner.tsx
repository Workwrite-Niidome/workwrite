'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Droplets, Heart, Zap, Flame, Brain, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const EMOTIONS = [
  { icon: Droplets, label: '泣いた', value: 'moved' },
  { icon: Heart, label: '温かい', value: 'warm' },
  { icon: Zap, label: '驚いた', value: 'surprised' },
  { icon: Flame, label: '燃えた', value: 'fired_up' },
  { icon: Brain, label: '深い', value: 'thoughtful' },
];

interface EpisodeCompleteBannerProps {
  episodeId: string;
  nextEpisodeId?: string;
  workId: string;
}

export function EpisodeCompleteBanner({ episodeId, nextEpisodeId, workId }: EpisodeCompleteBannerProps) {
  const { isAuthenticated } = useAuth();
  const [claps, setClaps] = useState(0);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [showEmotions, setShowEmotions] = useState(false);
  const [sent, setSent] = useState(false);
  const [totalClaps, setTotalClaps] = useState(0);
  const [reactionCount, setReactionCount] = useState(0);

  // Load existing reaction
  useEffect(() => {
    if (!isAuthenticated) return;
    api.getEpisodeReactions(episodeId).then((res) => {
      const data = res.data;
      setTotalClaps(data.totalClaps);
      setReactionCount(data.reactionCount);
      if (data.myReaction) {
        setClaps(data.myReaction.claps);
        setSelectedEmotion(data.myReaction.emotion);
        setSent(true);
        setShowEmotions(true);
      }
    }).catch(() => {});
  }, [episodeId, isAuthenticated]);

  // Debounced save
  const saveReaction = useCallback(async (newClaps: number, emotion: string | null) => {
    if (!isAuthenticated || newClaps === 0) return;
    try {
      await api.sendReaction(episodeId, { claps: newClaps, emotion: emotion || undefined });
      setSent(true);
    } catch { /* ignore */ }
  }, [episodeId, isAuthenticated]);

  function handleClap() {
    if (!isAuthenticated) return;
    const newClaps = Math.min(claps + 1, 5);
    setClaps(newClaps);
    if (newClaps === 1) {
      // First clap: show emotions after a delay
      setTimeout(() => setShowEmotions(true), 600);
    }
    // Save immediately on each clap
    saveReaction(newClaps, selectedEmotion);
  }

  function handleEmotion(value: string) {
    const newEmotion = selectedEmotion === value ? null : value;
    setSelectedEmotion(newEmotion);
    if (claps > 0) {
      saveReaction(claps, newEmotion);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="border-t border-border pt-8 space-y-5">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">この話はどうでしたか？</p>
          <p className="text-[11px] text-muted-foreground/70">タップで拍手（最大5回）</p>
        </div>

        {/* Clap button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleClap}
            disabled={claps >= 5 || !isAuthenticated}
            className={cn(
              'h-14 w-14 rounded-full border-2 flex items-center justify-center transition-all',
              claps > 0
                ? 'border-primary bg-primary/10 scale-105'
                : 'border-border hover:border-primary hover:bg-primary/5',
              claps >= 5 && 'opacity-60',
            )}
          >
            <Hand className={cn(
              'h-6 w-6 transition-colors',
              claps > 0 ? 'text-primary' : 'text-muted-foreground',
            )} />
          </button>
          <span className={cn(
            'text-xs transition-colors',
            claps > 0 ? 'text-primary font-medium' : 'text-muted-foreground',
          )}>
            {claps === 0 && '拍手する'}
            {claps === 1 && '1/5 ありがとう！'}
            {claps === 2 && '2/5 面白かった！'}
            {claps === 3 && '3/5 すごく良い！'}
            {claps === 4 && '4/5 最高！'}
            {claps === 5 && '5/5 感動した！'}
          </span>
          {sent && claps > 0 && (
            <p className="text-[10px] text-muted-foreground animate-in fade-in duration-300">
              作者に届きました
            </p>
          )}
          {!isAuthenticated && (
            <p className="text-[10px] text-muted-foreground">
              <Link href="/login" className="text-primary hover:underline">ログイン</Link>すると拍手できます
            </p>
          )}
        </div>

        {/* Emotion labels (appear after first clap) */}
        {showEmotions && claps > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-xs text-muted-foreground mb-3">どんな気持ちでしたか？（任意）</p>
            <div className="flex justify-center gap-3 flex-wrap">
              {EMOTIONS.map((e) => {
                const selected = selectedEmotion === e.value;
                return (
                  <button
                    key={e.value}
                    onClick={() => handleEmotion(e.value)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-all',
                      selected
                        ? 'border-primary bg-primary/15 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                    )}
                  >
                    <e.icon className="h-3.5 w-3.5" />
                    {e.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Reaction summary (if others have reacted) */}
        {reactionCount > 1 && (
          <p className="text-[10px] text-muted-foreground">
            {reactionCount}人がこの話に拍手しています
          </p>
        )}
      </div>

      {/* Navigation */}
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

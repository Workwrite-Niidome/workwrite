'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

interface EmotionArcData {
  authorArc: { phase: string; emotion: string; intensity: number }[];
  readerTags: { tag: string; tagJa: string; count: number; avgIntensity: number }[];
}

const EMOTION_COLORS: Record<string, string> = {
  courage: 'bg-orange-500',
  tears: 'bg-blue-400',
  excitement: 'bg-red-500',
  hope: 'bg-yellow-400',
  healing: 'bg-green-400',
  growth: 'bg-emerald-500',
  suspense: 'bg-purple-500',
  mystery: 'bg-indigo-500',
  laughter: 'bg-pink-400',
  empathy: 'bg-sky-400',
  awe: 'bg-violet-500',
  nostalgia: 'bg-amber-400',
  beauty: 'bg-rose-400',
  thinking: 'bg-teal-500',
  worldview: 'bg-cyan-500',
};

export function EmotionArc({ workId }: { workId: string }) {
  const [data, setData] = useState<EmotionArcData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getEmotionArc(workId)
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workId]);

  if (loading) return null;
  if (!data || (!data.authorArc?.length && !data.readerTags?.length)) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">感情の旅路</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Author's intended emotion arc */}
        {data.authorArc?.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">作者の感情設計</p>
            <div className="flex items-end gap-1 h-16">
              {data.authorArc.map((phase, i) => {
                const maxIntensity = Math.max(1, ...data.authorArc.map((p) => p.intensity));
                const height = (phase.intensity / maxIntensity) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-primary/60 rounded-t-sm transition-all"
                      style={{ height: `${Math.max(height, 10)}%` }}
                      title={`${phase.phase}: ${phase.emotion} (${phase.intensity})`}
                    />
                    <div className="text-center">
                      <p className="text-[10px] font-medium">{phase.phase}</p>
                      <p className="text-[9px] text-muted-foreground truncate max-w-[80px]">{phase.emotion}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reader emotion tags */}
        {data.readerTags?.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">読者の感想</p>
            <div className="flex flex-wrap gap-1.5">
              {data.readerTags.map((rt) => (
                <Badge
                  key={rt.tag}
                  variant="secondary"
                  className="text-xs gap-1"
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${EMOTION_COLORS[rt.tag] || 'bg-gray-400'}`} />
                  {rt.tagJa}
                  <span className="text-muted-foreground">({rt.count})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

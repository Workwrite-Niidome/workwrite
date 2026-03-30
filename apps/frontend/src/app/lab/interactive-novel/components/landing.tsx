'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WorkData, Layer } from '../page';

const entries: { layer: Layer; title: string; desc: string }[] = [
  { layer: 'read', title: '読む', desc: '構造データと原文のハイブリッドで第一話を体験する' },
  { layer: 'experience', title: '読まずに体験する', desc: 'キャラクターに出会う。感情から入る。シーンを進める' },
];

export function InteractiveLanding({ data, onSelectLayer }: { data: WorkData; onSelectLayer: (l: Layer) => void }) {
  const { work, episodes, characters } = data;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <h1 className="text-4xl font-serif font-light tracking-widest mb-3">
        {work.title}
      </h1>
      <p className="text-xs text-muted-foreground tracking-wider mb-1">
        {work.author?.displayName || work.author?.name}
      </p>
      <div className="flex items-center gap-2 mb-10">
        <Badge variant="outline" className="text-[11px] font-normal">{work.genre || '純文学'}</Badge>
        <Badge variant="secondary" className="text-[11px] font-normal">全{episodes.length}話</Badge>
        <Badge variant="secondary" className="text-[11px] font-normal">{characters.length}人</Badge>
      </div>

      {work.synopsis && (
        <p className="max-w-lg text-center text-sm text-muted-foreground leading-7 font-serif mb-12">
          {work.synopsis}
        </p>
      )}

      <p className="text-[11px] text-muted-foreground/50 tracking-widest uppercase mb-5">
        この物語への入口を選んでください
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
        {entries.map(e => (
          <Card
            key={e.layer}
            className="px-5 py-6 text-center cursor-pointer hover:shadow-md hover:border-primary/20 transition-all"
            onClick={() => onSelectLayer(e.layer)}
          >
            <p className="text-base font-medium mb-1.5">{e.title}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{e.desc}</p>
          </Card>
        ))}
      </div>

      <p className="mt-14 text-[10px] text-muted-foreground/40 tracking-widest">
        INTERACTIVE NOVEL PROTOTYPE
      </p>
    </div>
  );
}

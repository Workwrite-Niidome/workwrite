'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WorkData, Layer } from '../page';

const entries: { layer: Layer; label: string; title: string; desc: string }[] = [
  { layer: 'read', label: 'LAYER 1', title: '読む', desc: '構造データと原文が織り交ざるハイブリッドモード' },
  { layer: 'participate', label: 'LAYER 2', title: '参加する', desc: '物語の要所であなたの解釈を選び、他の読者と比較する' },
  { layer: 'immerse', label: 'LAYER 3', title: '没入する', desc: '本編に書かれていない秘密を、キャラクターから引き出す' },
  { layer: 'connect', label: 'LAYER 4', title: '交流する', desc: '他の読者の読みの軌跡を見る' },
  { layer: 'experience', label: 'LAYER 5', title: '読まずに体験する', desc: 'キャラクターに出会う。感情から入る。関係性を辿る' },
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
        <Badge variant="outline" className="text-[11px] font-normal">{work.genre}</Badge>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 max-w-4xl w-full">
        {entries.map(e => (
          <Card
            key={e.layer}
            className="px-4 py-5 text-center cursor-pointer hover:shadow-md hover:border-primary/20 transition-all"
            onClick={() => onSelectLayer(e.layer)}
          >
            <p className="text-[10px] text-primary/60 font-sans font-medium tracking-wider mb-1.5">{e.label}</p>
            <p className="text-sm font-medium mb-1.5">{e.title}</p>
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

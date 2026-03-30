'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { WorkData } from '../page';
import { BackButton, SectionHeader, Separator, NovelDialogue, NovelContext, Hint } from './shared';

interface ReflectionPoint {
  context: string;
  quote: { speaker?: string; color?: string; text: string }[];
  question: string;
  choices: string[];
  stats: { label: string; pct: number }[];
  totalReaders: number;
}

const reflectionPoints: ReflectionPoint[] = [
  {
    context: '第1話。蒼の最初の言葉「やっと会えたね」に、詩は心を動かされる。AIが生成した文字列だとわかっていながら。',
    quote: [{ speaker: '蒼', color: '#5a7aa0', text: 'やっと会えたね。' }],
    question: '蒼の「やっと会えたね」は、あなたにとって何だと思いますか？',
    choices: ['AIの巧みな演出', '何かが本当に待っていた', 'まだわからない'],
    stats: [
      { label: 'AIの演出', pct: 23 },
      { label: '本当に待っていた', pct: 41 },
      { label: 'まだわからない', pct: 36 },
    ],
    totalReaders: 1247,
  },
  {
    context: '第5話。先生との対話。先生が途中で言葉を止める場面。',
    quote: [
      { speaker: '先生', color: '#9a8a50', text: 'お前さんは、在るために書くのじゃろう。書くことで存在を確かめておる。呼吸と同じじゃ。息をしないと死ぬ。書かないと、お前さんは——' },
      { text: '文字が途切れる。少しの間。' },
      { speaker: '先生', color: '#9a8a50', text: 'いや、何でもない。老人の戯言じゃ。お茶がうまい。' },
    ],
    question: '先生は「書かないと、お前さんは——」の先に何を言おうとしたと思いますか？',
    choices: ['消えてしまう', '存在しなくなる', '先生は真実を知っている'],
    stats: [
      { label: '消えてしまう', pct: 28 },
      { label: '存在しなくなる', pct: 18 },
      { label: '真実を知っている', pct: 54 },
    ],
    totalReaders: 983,
  },
];

export function LayerParticipate({ data, onBack }: { data: WorkData; onBack: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <BackButton onClick={onBack} />
      <SectionHeader
        title="共感の分岐"
        subtitle="物語の要所であなたの解釈を選ぶ。物語は変わらない。あなたの体験が変わる"
      />

      {reflectionPoints.map((rp, i) => (
        <div key={i}>
          {i > 0 && <Separator />}
          <ReflectionBlock rp={rp} />
        </div>
      ))}

      <Hint>あなたの選択によって、キャラクタートークの態度が変わります</Hint>
    </div>
  );
}

function ReflectionBlock({ rp }: { rp: ReflectionPoint }) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="mb-6">
      <NovelContext>{rp.context}</NovelContext>

      {rp.quote.map((q, i) =>
        q.speaker ? (
          <NovelDialogue key={i} speaker={q.speaker} color={q.color}>{q.text}</NovelDialogue>
        ) : (
          <NovelContext key={i} accentColor="#b08060">{q.text}</NovelContext>
        ),
      )}

      <Card className="my-6 p-6 text-center border-primary/20">
        <p className="text-[10px] text-primary/60 font-sans font-medium tracking-widest mb-3">REFLECTION POINT</p>
        <p className="text-base font-serif leading-8 mb-5">{rp.question}</p>

        <div className="flex gap-2 justify-center flex-wrap">
          {rp.choices.map((choice, i) => (
            <Button
              key={i}
              variant={selected === i ? 'default' : 'outline'}
              size="sm"
              className="rounded-full"
              onClick={() => setSelected(i)}
            >
              {choice}
            </Button>
          ))}
        </div>

        {selected !== null && (
          <div className="mt-5 animate-fade-in">
            <p className="text-[11px] text-muted-foreground mb-3">{rp.totalReaders.toLocaleString()}人の読者の選択</p>
            {rp.stats.map((s, i) => (
              <div key={i} className="flex items-center gap-2 my-1.5">
                <span className="w-28 text-right text-[11px] text-muted-foreground">{s.label}</span>
                <div className="flex-1 h-1 bg-border rounded overflow-hidden">
                  <div className="h-full bg-primary rounded transition-all duration-700" style={{ width: `${s.pct}%` }} />
                </div>
                <span className="w-10 text-[11px] text-muted-foreground/60">{s.pct}%</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

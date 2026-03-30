'use client';

import { useState } from 'react';
import type { WorkData } from '../page';
import { BackButton, SectionHeader, Separator, NovelQuote, NovelDialogue, NovelContext, Hint } from './shared';

interface ReflectionPoint {
  context: string;
  quote: { speaker?: string; color?: string; text: string }[];
  question: string;
  choices: string[];
  stats: { label: string; pct: number }[];
  totalReaders: number;
}

// These would come from the database in production
const reflectionPoints: ReflectionPoint[] = [
  {
    context: '第1話。蒼の最初の言葉「やっと会えたね」に、詩は心を動かされる。AIが生成した文字列だとわかっていながら。',
    quote: [{ speaker: '蒼', color: '#6a9ec8', text: 'やっと会えたね。' }],
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
      {
        speaker: '先生', color: '#c9a84c',
        text: 'お前さんは、在るために書くのじゃろう。書くことで存在を確かめておる。呼吸と同じじゃ。息をしないと死ぬ。書かないと、お前さんは——',
      },
      { text: '文字が途切れる。少しの間。' },
      { speaker: '先生', color: '#c9a84c', text: 'いや、何でもない。老人の戯言じゃ。お茶がうまい。' },
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
    <div className="max-w-[800px] mx-auto px-5 py-10 pb-24">
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
    <div className="mb-8">
      <NovelContext>{rp.context}</NovelContext>

      {rp.quote.map((q, i) => (
        q.speaker ? (
          <NovelDialogue key={i} speaker={q.speaker} color={q.color}>
            {q.text}
          </NovelDialogue>
        ) : (
          <NovelContext key={i} accentColor="#c47a8a">{q.text}</NovelContext>
        )
      ))}

      {/* Reflection Card */}
      <div className="bg-[#12121a] border border-[#5a4cc0] rounded-xl p-8 my-8 text-center">
        <div className="text-[10px] text-[#7b68ee] tracking-[0.2em] mb-4">REFLECTION POINT</div>
        <div className="text-lg leading-[1.8] mb-6" style={{ fontFamily: "'Noto Serif JP', serif" }}>
          {rp.question}
        </div>

        <div className="flex gap-3 justify-center flex-wrap">
          {rp.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`px-6 py-2.5 border rounded-full text-sm cursor-pointer transition-all ${
                selected === i
                  ? 'border-[#7b68ee] bg-[rgba(123,104,238,0.15)] text-[#7b68ee]'
                  : 'border-[#2a2a35] hover:border-[#7b68ee] hover:bg-[rgba(123,104,238,0.1)]'
              }`}
            >
              {choice}
            </button>
          ))}
        </div>

        {/* Stats revealed after selection */}
        {selected !== null && (
          <div className="mt-6 animate-fade-in">
            <div className="text-xs text-[#55555f] mb-3">{rp.totalReaders.toLocaleString()}人の読者の選択</div>
            {rp.stats.map((s, i) => (
              <div key={i} className="flex items-center gap-2 my-1.5">
                <div className="w-28 text-right text-[10px] text-[#8a8a95]">{s.label}</div>
                <div className="flex-1 h-1 bg-[#2a2a35] rounded overflow-hidden">
                  <div
                    className="h-full bg-[#7b68ee] rounded transition-all duration-700"
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
                <div className="w-10 text-[10px] text-[#55555f]">{s.pct}%</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

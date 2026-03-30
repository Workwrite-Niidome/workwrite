'use client';

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
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10 relative">
      {/* Radial gradient background */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 30%, rgba(123,104,238,0.06) 0%, transparent 60%)',
      }} />

      <h1 className="text-6xl font-light tracking-[0.3em] mb-3 relative z-10" style={{ fontFamily: "'Noto Serif JP', serif" }}>
        {work.title}
      </h1>
      <div className="text-xs text-[#8a8a95] tracking-widest mb-1.5 relative z-10">
        {work.author?.displayName || work.author?.name}
      </div>
      <div className="text-[10px] text-[#55555f] tracking-wider mb-12 relative z-10">
        {work.genre} / 全{episodes.length}話 / {characters.length}人のキャラクター
      </div>

      {work.synopsis && (
        <p className="max-w-[640px] text-center text-sm text-[#8a8a95] leading-8 font-light mb-16 relative z-10">
          {work.synopsis}
        </p>
      )}

      <div className="text-[10px] text-[#55555f] tracking-[0.2em] uppercase mb-6 relative z-10">
        この物語への入口を選んでください
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-[960px] w-full relative z-10">
        {entries.map(e => (
          <button
            key={e.layer}
            onClick={() => onSelectLayer(e.layer)}
            className="bg-[#12121a] border border-[#2a2a35] rounded-lg px-5 py-6 text-center cursor-pointer transition-all hover:border-[#5a4cc0] hover:bg-[#1a1a25] hover:-translate-y-0.5"
          >
            <div className="text-[10px] text-[#7b68ee] tracking-wider mb-2">{e.label}</div>
            <div className="text-base font-normal mb-2">{e.title}</div>
            <div className="text-[11px] text-[#8a8a95] leading-relaxed">{e.desc}</div>
          </button>
        ))}
      </div>

      <div className="mt-16 text-[10px] text-[#55555f] tracking-wider relative z-10">
        INTERACTIVE NOVEL PROTOTYPE
      </div>
    </div>
  );
}

'use client';

import { ReactNode } from 'react';

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs text-[#8a8a95] tracking-wider hover:text-[#e8e6e3] transition-colors mb-8 cursor-pointer"
    >
      &#8592; 入口に戻る
    </button>
  );
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center mb-12 pb-8 border-b border-[#2a2a35]">
      <h2 className="text-2xl font-light mb-2" style={{ fontFamily: "'Noto Serif JP', serif" }}>{title}</h2>
      {subtitle && <p className="text-xs text-[#8a8a95] tracking-wide">{subtitle}</p>}
    </div>
  );
}

export function Separator() {
  return <div className="text-center text-[#55555f] my-10 text-sm tracking-[1em]">* * *</div>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-center text-[10px] text-[#55555f] my-4 tracking-wide">{children}</p>;
}

export function NovelQuote({ children, highlight }: { children: ReactNode; highlight?: boolean }) {
  return (
    <div className="py-5 leading-[2.2] font-light text-base" style={{ textIndent: '1em' }}>
      {children}
    </div>
  );
}

export function NovelDialogue({ speaker, children, color }: { speaker: string; children: ReactNode; color?: string }) {
  const colorClass = color || '#7b68ee';
  return (
    <div className="my-5 px-6 py-4 bg-[#12121a] rounded-lg border border-[#2a2a35]">
      <div className="text-[10px] tracking-wider mb-1.5" style={{ color: colorClass }}>{speaker}</div>
      <div className="text-base leading-[1.9]">{children}</div>
    </div>
  );
}

export function NovelContext({ children, accentColor }: { children: ReactNode; accentColor?: string }) {
  return (
    <div
      className="text-sm text-[#8a8a95] bg-[#12121a] px-5 py-4 mb-6 leading-[1.8]"
      style={{ borderLeft: `2px solid ${accentColor || '#2a2a35'}` }}
    >
      {children}
    </div>
  );
}

export function FullTextLink({ label }: { label?: string }) {
  return (
    <div className="text-center text-sm text-[#7b68ee] cursor-pointer p-4 border border-dashed border-[#2a2a35] rounded-lg mt-5 hover:border-[#5a4cc0] hover:bg-[rgba(123,104,238,0.05)] transition-all">
      {label || '本文を全文で読む'}
    </div>
  );
}

export function EmotionTag({ children }: { children: ReactNode }) {
  return (
    <div className="text-center text-[10px] text-[#55555f] tracking-widest my-8">
      {children}
    </div>
  );
}

'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="mb-6 text-muted-foreground">
      &#8592; 入口に戻る
    </Button>
  );
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center mb-10 pb-6 border-b border-border">
      <h2 className="text-xl font-semibold tracking-tight font-serif">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
    </div>
  );
}

export function Separator() {
  return <div className="text-center text-muted-foreground/40 my-8 text-sm tracking-[0.5em]">* * *</div>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-center text-[11px] text-muted-foreground/60 my-4">{children}</p>;
}

export function NovelQuote({ children }: { children: ReactNode }) {
  return (
    <div className="py-4 leading-8 font-serif text-[15px] text-foreground" style={{ textIndent: '1em' }}>
      {children}
    </div>
  );
}

export function NovelDialogue({ speaker, children, color }: { speaker: string; children: ReactNode; color?: string }) {
  return (
    <Card className="my-4 px-5 py-4">
      <div className="text-[11px] font-sans font-medium tracking-wide mb-1" style={{ color: color || 'var(--color-accent)' }}>
        {speaker}
      </div>
      <div className="text-[15px] leading-8 font-serif">{children}</div>
    </Card>
  );
}

export function NovelContext({ children, accentColor }: { children: ReactNode; accentColor?: string }) {
  return (
    <div
      className="text-sm text-muted-foreground bg-secondary/50 px-5 py-3.5 mb-5 leading-7 rounded-lg font-sans"
      style={{ borderLeft: `3px solid ${accentColor || 'var(--color-border)'}` }}
    >
      {children}
    </div>
  );
}

export function FullTextLink({ label }: { label?: string }) {
  return (
    <button className="w-full text-center text-sm text-accent-foreground/70 cursor-pointer p-4 border border-dashed border-border rounded-xl mt-4 hover:border-primary/30 hover:bg-secondary/30 transition-all font-sans">
      {label || '本文を全文で読む'}
    </button>
  );
}

export function EmotionTag({ children }: { children: ReactNode }) {
  return (
    <div className="text-center my-6">
      <Badge variant="outline" className="text-[11px] font-normal tracking-wide">
        {children}
      </Badge>
    </div>
  );
}

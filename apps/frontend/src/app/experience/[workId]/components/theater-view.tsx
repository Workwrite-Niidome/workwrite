'use client';

import { useRef, useEffect } from 'react';
import type { SceneBlock } from '../types';

interface TheaterViewProps {
  blocks: SceneBlock[];
  isStreaming: boolean;
}

/**
 * TheaterView — 一本のテキストの流れ
 *
 * 全てがここに流れる。環境描写、セリフ、読者の行動、場面転換。
 * チャットUIではない。ゲームUIでもない。
 * 物語が書かれていくのを中に入って見ている画面。
 */
export function TheaterView({ blocks, isStreaming }: TheaterViewProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new blocks arrive
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [blocks.length, blocks[blocks.length - 1]?.text]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-6 py-8 md:px-10"
    >
      <div className="mx-auto max-w-xl space-y-1">
        {blocks.map((block) => (
          <BlockRenderer key={block.id} block={block} />
        ))}

        {isStreaming && (
          <div className="py-2">
            <span className="text-muted-foreground/40 animate-pulse">...</span>
          </div>
        )}

        <div ref={endRef} className="h-8" />
      </div>
    </div>
  );
}

function BlockRenderer({ block }: { block: SceneBlock }) {
  switch (block.type) {
    case 'break':
      return (
        <div className="py-6 text-center text-muted-foreground/30 text-sm tracking-[0.5em]">
          * * *
        </div>
      );

    case 'perspective_label':
      return (
        <div className="py-4 text-center text-xs text-muted-foreground/50 tracking-widest">
          {block.text}
        </div>
      );

    case 'action':
      return (
        <div className="py-2 text-sm text-muted-foreground/50 font-sans">
          {block.text}
        </div>
      );

    case 'environment':
      return (
        <div
          className={`py-2 leading-8 font-serif ${
            block.source === 'original'
              ? 'text-foreground'
              : 'text-foreground/80 font-light'
          }`}
          style={{ textIndent: '1em' }}
        >
          {block.text}
        </div>
      );

    case 'event':
      if (block.spoilerProtected) {
        return (
          <div className="py-2 leading-8 font-serif text-foreground/60 font-light italic" style={{ textIndent: '1em' }}>
            {block.text}
          </div>
        );
      }
      return (
        <div
          className={`py-2 leading-8 font-serif ${
            block.source === 'original'
              ? 'text-foreground'
              : 'text-foreground/80 font-light'
          }`}
          style={{ textIndent: '1em' }}
        >
          {block.text}
        </div>
      );

    case 'dialogue':
      return (
        <div className="py-2 leading-8 font-serif">
          {block.speaker && (
            <div
              className="text-xs font-sans font-medium tracking-wide mb-0.5 ml-4"
              style={{ color: block.speakerColor || 'var(--color-accent)' }}
            >
              {block.speaker}
            </div>
          )}
          <div
            className="pl-4"
            style={{
              borderLeft: block.speaker
                ? `2px solid ${block.speakerColor || 'var(--color-border)'}`
                : undefined,
            }}
          >
            {block.text}
          </div>
        </div>
      );

    default:
      return (
        <div className="py-2 leading-8 font-serif" style={{ textIndent: '1em' }}>
          {block.text}
        </div>
      );
  }
}

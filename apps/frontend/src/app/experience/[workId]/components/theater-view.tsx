'use client';

import { useRef, useEffect, useState } from 'react';
import type { SceneBlock } from '../types';

interface TheaterViewProps {
  blocks: SceneBlock[];
  isStreaming: boolean;
}

export function TheaterView({ blocks, isStreaming }: TheaterViewProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const [prevCount, setPrevCount] = useState(0);

  // Track how many blocks are "new" (for staggered animation)
  const newStartIndex = prevCount;
  useEffect(() => {
    setPrevCount(blocks.length);
  }, [blocks.length]);

  // Scroll to new content (not to bottom, just to where new content starts)
  useEffect(() => {
    if (blocks.length > prevCount) {
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 300);
    }
  }, [blocks.length]);

  return (
    <div className="flex-1 overflow-y-auto px-6 md:px-10 pt-16 pb-32">
      <div className="mx-auto max-w-lg">
        {blocks.map((block, idx) =>
          block ? (
            <BlockRenderer
              key={block.id}
              block={block}
              isNew={idx >= newStartIndex}
              animDelay={idx >= newStartIndex ? (idx - newStartIndex) * 0.15 : 0}
            />
          ) : null
        )}

        {isStreaming && (
          <div className="py-2">
            <span className="text-[#55555f] animate-pulse">...</span>
          </div>
        )}

        <div ref={endRef} className="h-8" />
      </div>
    </div>
  );
}

function BlockRenderer({ block, isNew, animDelay }: { block: SceneBlock; isNew: boolean; animDelay: number }) {
  const animStyle = isNew ? {
    opacity: 0,
    animation: `fadeUp 0.8s ease ${animDelay}s forwards`,
  } : {};

  switch (block.type) {
    case 'break':
      return (
        <div className="py-8 text-center text-[#3a3a40] text-sm tracking-[0.5em]" style={animStyle}>
          * * *
        </div>
      );

    case 'perspective_label':
      return (
        <div className="py-6 text-center text-[10px] text-[#55555f] tracking-[0.3em]" style={animStyle}>
          {block.text}
        </div>
      );

    case 'action':
      return (
        <div className="py-3 text-sm text-[#55555f] font-sans" style={animStyle}>
          {block.text}
        </div>
      );

    case 'environment':
      return (
        <div
          className={`py-3 leading-[2.2] text-[15px] ${
            block.source === 'original' ? 'text-[#d8d5d0]' : 'text-[#a8a5a0]'
          }`}
          style={{ textIndent: '1em', ...animStyle }}
        >
          {block.text}
        </div>
      );

    case 'event':
      return (
        <div
          className={`py-3 leading-[2.2] text-[15px] ${
            block.spoilerProtected ? 'text-[#6a6a70] italic' :
            block.source === 'original' ? 'text-[#d8d5d0]' : 'text-[#a8a5a0]'
          }`}
          style={{ textIndent: '1em', ...animStyle }}
        >
          {block.text}
        </div>
      );

    case 'dialogue':
      return (
        <div className="py-3 leading-[2.2] text-[15px]" style={animStyle}>
          {block.speaker && (
            <div
              className="text-[11px] font-sans tracking-wider mb-1 ml-5"
              style={{ color: block.speakerColor || '#8a8a95' }}
            >
              {block.speaker}
            </div>
          )}
          <div
            className="pl-5 text-[#d8d5d0]"
            style={{
              borderLeft: block.speaker
                ? `2px solid ${block.speakerColor || '#3a3a45'}33`
                : undefined,
            }}
          >
            {block.text}
          </div>
        </div>
      );

    default:
      return (
        <div className="py-3 leading-[2.2] text-[15px] text-[#d8d5d0]" style={{ textIndent: '1em', ...animStyle }}>
          {block.text}
        </div>
      );
  }
}

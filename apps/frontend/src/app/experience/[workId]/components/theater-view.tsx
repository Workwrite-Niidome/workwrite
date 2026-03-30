'use client';

import { useRef, useEffect, useState } from 'react';
import type { SceneBlock, ActionSuggestion } from '../types';

interface TheaterViewProps {
  blocks: SceneBlock[];
  isStreaming: boolean;
  onContentEnd?: (reached: boolean) => void;
  onAwarenessClick?: (action: ActionSuggestion) => void;
}

export function TheaterView({ blocks, isStreaming, onContentEnd, onAwarenessClick }: TheaterViewProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Use a Set to track which block IDs have already been rendered (no re-render on update)
  const renderedIds = useRef(new Set<string>());

  // Mark blocks as "new" if not yet rendered, then remember them
  const newBlockIds = new Set<string>();
  for (const block of blocks) {
    if (block && !renderedIds.current.has(block.id)) {
      newBlockIds.add(block.id);
    }
  }
  // Schedule marking as rendered after paint (won't cause re-render since it's a ref)
  useEffect(() => {
    const timer = setTimeout(() => {
      for (const block of blocks) {
        if (block) renderedIds.current.add(block.id);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [blocks]);

  // Scroll: only for small additions (1-2 blocks). Large batches stay at top.
  const prevCountRef = useRef(0);
  useEffect(() => {
    const added = blocks.length - prevCountRef.current;
    if (added > 0 && added <= 2) {
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 300);
    }
    prevCountRef.current = blocks.length;
  }, [blocks.length]);

  // IntersectionObserver on the sentinel element
  useEffect(() => {
    if (!sentinelRef.current || !onContentEnd) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        onContentEnd(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [onContentEnd, blocks.length]);

  // Determine where to place the sentinel: roughly 2 blocks before the end
  const sentinelIndex = Math.max(0, blocks.length - 2);

  return (
    <div className="flex-1 overflow-y-auto px-6 md:px-10 pt-16 pb-32">
      <div className="mx-auto max-w-lg">
        {blocks.map((block, idx) =>
          block ? (
            <div key={block.id}>
              {idx === sentinelIndex && (
                <div ref={sentinelRef} className="h-0" aria-hidden="true" />
              )}
              <BlockRenderer
                block={block}
                isNew={newBlockIds.has(block.id)}
                animDelay={newBlockIds.has(block.id) ? [...newBlockIds].indexOf(block.id) * 1.8 : 0}
                onAwarenessClick={onAwarenessClick}
              />
            </div>
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

function BlockRenderer({ block, isNew, animDelay, onAwarenessClick }: { block: SceneBlock; isNew: boolean; animDelay: number; onAwarenessClick?: (action: ActionSuggestion) => void }) {
  const [awarenessClicked, setAwarenessClicked] = useState(false);

  const animStyle = isNew ? {
    opacity: 0,
    animation: `fadeUp 1.5s ease-out ${animDelay}s forwards`,
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

    case 'awareness':
      return (
        <div
          style={{
            padding: '20px 0 8px',
            fontSize: '14px',
            display: 'inline-block',
            color: awarenessClicked ? '#55555f' : '#4a4a55',
            cursor: awarenessClicked ? 'default' : 'pointer',
            pointerEvents: awarenessClicked ? 'none' : 'auto',
            animation: isNew
              ? `fadeUp 1.5s ease-out ${animDelay}s forwards, awarenessGlow 3s ease-in-out ${animDelay + 1.5}s 1`
              : undefined,
            opacity: isNew ? 0 : 1,
          }}
          onMouseEnter={(e) => {
            if (!awarenessClicked) {
              e.currentTarget.style.color = '#8a8a95';
              e.currentTarget.style.borderBottom = '1px solid #3a3a45';
            }
          }}
          onMouseLeave={(e) => {
            if (!awarenessClicked) {
              e.currentTarget.style.color = '#4a4a55';
              e.currentTarget.style.borderBottom = 'none';
            }
          }}
          onClick={() => {
            if (!awarenessClicked && block.awarenessAction && onAwarenessClick) {
              setAwarenessClicked(true);
              onAwarenessClick(block.awarenessAction);
            }
          }}
        >
          <span style={{ color: '#3a3a45', marginRight: '4px' }}>......</span>
          {block.text}
        </div>
      );

    case 'memory':
      return (
        <div
          style={{
            color: '#3a3a40',
            fontStyle: 'italic',
            filter: 'blur(0.3px)',
            transform: 'translateY(-1px)',
            textIndent: '1em',
            fontSize: '15px',
            padding: '8px 0',
            ...animStyle,
          }}
        >
          {block.text}
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

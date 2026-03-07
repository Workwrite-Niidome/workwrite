'use client';
import { useMemo } from 'react';
import type { Highlight } from '@/lib/api';

const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-200/60 dark:bg-yellow-800/40',
  green: 'bg-green-200/60 dark:bg-green-800/40',
  blue: 'bg-blue-200/60 dark:bg-blue-800/40',
  pink: 'bg-pink-200/60 dark:bg-pink-800/40',
};

interface HighlightedTextProps {
  text: string;
  highlights: Highlight[];
  onHighlightClick?: (highlight: Highlight) => void;
}

export function HighlightedText({ text, highlights, onHighlightClick }: HighlightedTextProps) {
  const segments = useMemo(() => {
    if (highlights.length === 0) return [{ text, highlight: null as Highlight | null }];

    const sorted = [...highlights].sort((a, b) => a.startPos - b.startPos);
    const result: { text: string; highlight: Highlight | null }[] = [];
    let pos = 0;

    for (const h of sorted) {
      if (h.startPos > pos) {
        result.push({ text: text.slice(pos, h.startPos), highlight: null });
      }
      result.push({ text: text.slice(h.startPos, h.endPos), highlight: h });
      pos = h.endPos;
    }
    if (pos < text.length) {
      result.push({ text: text.slice(pos), highlight: null });
    }
    return result;
  }, [text, highlights]);

  return (
    <>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            className={`${HIGHLIGHT_COLORS[seg.highlight.color] || HIGHLIGHT_COLORS.yellow} cursor-pointer rounded-sm`}
            onClick={() => onHighlightClick?.(seg.highlight!)}
            title={seg.highlight.memo || undefined}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

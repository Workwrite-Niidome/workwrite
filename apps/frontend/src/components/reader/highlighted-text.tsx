'use client';
import { useMemo, Fragment } from 'react';
import type { Highlight } from '@/lib/api';

/**
 * Convert ruby notation ｜漢字《ルビ》 to <ruby> elements.
 * Also supports the shorter form without ｜ for single kanji words: 漢字《ルビ》
 * Returns an array of React nodes (strings and <ruby> elements).
 */
function renderWithRuby(text: string): React.ReactNode[] {
  // Pattern: ｜漢字《ルビ》 or just 漢字《ルビ》(where 漢字 is 1+ kanji/kana before 《)
  const rubyPattern = /[｜|]([^｜|《》\n]+)《([^》\n]+)》|([一-龥々〇ヶ]+)《([^》\n]+)》/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = rubyPattern.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    const base = match[1] || match[3];
    const ruby = match[2] || match[4];
    result.push(
      <ruby key={match.index}>
        {base}<rp>(</rp><rt>{ruby}</rt><rp>)</rp>
      </ruby>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length > 0 ? result : [text];
}

const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-200/60 dark:bg-yellow-800/40',
  green: 'bg-green-200/60 dark:bg-green-800/40',
  blue: 'bg-blue-200/60 dark:bg-blue-800/40',
  pink: 'bg-pink-200/60 dark:bg-pink-800/40',
};

interface HighlightedTextProps {
  text: string;
  highlights: Highlight[];
  onHighlightClick?: (highlight: Highlight, event?: React.MouseEvent) => void;
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
            onClick={(e) => onHighlightClick?.(seg.highlight!, e)}
            title={seg.highlight.memo || undefined}
          >
            {renderWithRuby(seg.text)}
          </mark>
        ) : (
          <Fragment key={i}>{renderWithRuby(seg.text)}</Fragment>
        ),
      )}
    </>
  );
}

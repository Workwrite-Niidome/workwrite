'use client';

import { useState, useEffect, useRef } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Highlight } from '@/lib/api';

const COLORS = [
  { value: 'yellow', bg: 'bg-yellow-400' },
  { value: 'green', bg: 'bg-green-400' },
  { value: 'blue', bg: 'bg-blue-400' },
  { value: 'pink', bg: 'bg-pink-400' },
  { value: 'purple', bg: 'bg-purple-400' },
];

interface HighlightDetailPopoverProps {
  highlight: Highlight;
  position: { top: number; left: number };
  onUpdate: (id: string, data: { memo?: string; color?: string }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function HighlightDetailPopover({
  highlight,
  position,
  onUpdate,
  onDelete,
  onClose,
}: HighlightDetailPopoverProps) {
  const [memo, setMemo] = useState(highlight.memo || '');
  const [color, setColor] = useState(highlight.color);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleEsc);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  function handleSave() {
    const updates: { memo?: string; color?: string } = {};
    if (memo !== (highlight.memo || '')) updates.memo = memo;
    if (color !== highlight.color) updates.color = color;
    if (Object.keys(updates).length > 0) {
      onUpdate(highlight.id, updates);
    }
    onClose();
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 bg-card border border-border rounded-lg shadow-lg p-3"
      style={{ top: position.top + 4, left: position.left, transform: 'translateX(-50%)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">ハイライト詳細</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Color selection */}
      <div className="flex items-center gap-1.5 mb-3">
        {COLORS.map((c) => (
          <button
            key={c.value}
            onClick={() => setColor(c.value)}
            className={`h-6 w-6 rounded-full ${c.bg} transition-transform ${color === c.value ? 'ring-2 ring-foreground ring-offset-1 scale-110' : 'hover:scale-105'}`}
          />
        ))}
      </div>

      {/* Memo editing */}
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="メモを入力..."
        rows={3}
        className="w-full text-xs border border-border rounded px-2 py-1.5 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
      />

      {/* Actions */}
      <div className="flex items-center justify-between mt-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive hover:text-destructive"
          onClick={() => { onDelete(highlight.id); onClose(); }}
        >
          <Trash2 className="h-3 w-3 mr-1" /> 削除
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
          保存
        </Button>
      </div>
    </div>
  );
}

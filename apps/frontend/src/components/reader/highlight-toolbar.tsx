'use client';
import { useState } from 'react';
import { Sparkles, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

const COLORS = [
  { value: 'yellow', bg: 'bg-yellow-400' },
  { value: 'green', bg: 'bg-green-400' },
  { value: 'blue', bg: 'bg-blue-400' },
  { value: 'pink', bg: 'bg-pink-400' },
  { value: 'purple', bg: 'bg-purple-400' },
];

interface HighlightToolbarProps {
  position: { top: number; left: number };
  onSave: (color: string, memo: string) => void;
  onAiExplain: () => void;
  onClose: () => void;
}

export function HighlightToolbar({ position, onSave, onAiExplain, onClose }: HighlightToolbarProps) {
  const [color, setColor] = useState('yellow');
  const [memo, setMemo] = useState('');
  const [showMemo, setShowMemo] = useState(false);

  return (
    <div
      className="fixed z-50 bg-card border border-border rounded-lg shadow-lg p-2"
      style={{ top: position.top - 8, left: position.left, transform: 'translate(-50%, -100%)' }}
    >
      <div className="flex items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c.value}
            onClick={() => setColor(c.value)}
            className={`h-8 w-8 min-h-[32px] min-w-[32px] rounded-full ${c.bg} ${color === c.value ? 'ring-2 ring-foreground ring-offset-1' : ''} touch-manipulation`}
          />
        ))}
        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8 min-h-[32px] min-w-[32px]" onClick={() => setShowMemo(!showMemo)} title="メモ">
          <Save className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 min-h-[32px] min-w-[32px]" onClick={onAiExplain} title="AI解説">
          <Sparkles className="h-3.5 w-3.5" />
        </Button>
      </div>
      {showMemo && (
        <div className="mt-2 flex gap-1">
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="メモ..."
            className="flex-1 text-xs border border-border rounded px-2 py-1 bg-background"
            autoFocus
          />
          <Button size="sm" className="h-7 text-xs" onClick={() => { onSave(color, memo); onClose(); }}>
            保存
          </Button>
        </div>
      )}
      {!showMemo && (
        <div className="mt-1 flex justify-center">
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { onSave(color, memo); onClose(); }}>
            ハイライト保存
          </Button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { ActionSuggestion } from '../types';

interface ActionPaletteProps {
  actions: ActionSuggestion[];
  onAction: (action: ActionSuggestion) => void;
  onFreeInput: (text: string) => void;
  disabled: boolean;
}

/**
 * ActionPalette — コンテキストアクションと自由入力
 *
 * 選択肢はプロースタイルで提示。ボタンではなく、テキストとして。
 * 自由入力は折り畳み式。パワーユーザー向け。
 */
export function ActionPalette({ actions, onAction, onFreeInput, disabled }: ActionPaletteProps) {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onFreeInput(input.trim());
    setInput('');
    setExpanded(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-border bg-background px-6 py-4 md:px-10">
      <div className="mx-auto max-w-xl">
        {/* Action suggestions */}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={() => !disabled && onAction(action)}
                disabled={disabled}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-full hover:border-foreground/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Free input (collapsed) */}
        {!expanded ? (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors cursor-pointer"
          >
            &#9656; 自分の言葉で
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="何をしますか？"
              disabled={disabled}
              autoFocus
              className="flex-1 px-4 py-2 bg-transparent border border-border rounded-lg text-sm focus:outline-none focus:border-foreground/30 transition-colors disabled:opacity-40 font-sans"
            />
            <button
              type="submit"
              disabled={disabled || !input.trim()}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:border-foreground/20 transition-all disabled:opacity-40 cursor-pointer"
            >
              送る
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

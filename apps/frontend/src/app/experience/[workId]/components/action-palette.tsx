'use client';

import { useState } from 'react';
import type { ActionSuggestion } from '../types';

interface ActionPaletteProps {
  actions: ActionSuggestion[];
  onAction: (action: ActionSuggestion) => void;
  onFreeInput: (text: string) => void;
  disabled: boolean;
  visible?: boolean;
}

export function ActionPalette({ actions, onAction, onFreeInput, disabled, visible = true }: ActionPaletteProps) {
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
    <>
      {/* Subtle hint when actions are hidden */}
      {!visible && actions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pb-3 pointer-events-none">
          <div className="w-8 h-px bg-[#2a2a35] transition-opacity duration-700" />
        </div>
      )}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 border-t px-6 py-4 md:px-10 transition-all duration-700 ease-out ${
          visible
            ? 'border-[#1a1a25] bg-[#0a0a0f] opacity-100 translate-y-0'
            : 'border-transparent bg-transparent opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
      <div className="mx-auto max-w-lg">
        {actions.length > 0 && (() => {
          const primary = actions.filter(a => a.type !== 'read');
          const secondary = actions.filter(a => a.type === 'read');
          return (
            <>
              {primary.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {primary.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => !disabled && onAction(action)}
                      disabled={disabled}
                      className="px-4 py-2 text-sm text-[#8a8a95] hover:text-[#d8d5d0] border border-[#2a2a35] rounded-full hover:border-[#4a4a55] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
              {secondary.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 mt-1">
                  {secondary.map((action, i) => (
                    <button
                      key={`read-${i}`}
                      onClick={() => !disabled && onAction(action)}
                      disabled={disabled}
                      className="px-4 py-2 text-sm text-[#6a7a8a] hover:text-[#9ab0c0] border border-[#1e2a35] rounded-full hover:border-[#3a4a55] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          );
        })()}

        {!expanded ? (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-[#3a3a45] hover:text-[#55555f] transition-colors cursor-pointer"
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
              className="flex-1 px-4 py-2 bg-transparent border border-[#2a2a35] rounded-lg text-sm text-[#d8d5d0] placeholder:text-[#3a3a45] focus:outline-none focus:border-[#4a4a55] transition-colors disabled:opacity-30 font-sans"
            />
            <button
              type="submit"
              disabled={disabled || !input.trim()}
              className="px-4 py-2 text-sm text-[#8a8a95] border border-[#2a2a35] rounded-lg hover:border-[#4a4a55] transition-all disabled:opacity-30 cursor-pointer"
            >
              送る
            </button>
          </form>
        )}
      </div>
    </div>
    </>
  );
}

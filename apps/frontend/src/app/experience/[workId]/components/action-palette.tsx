'use client';

import { useState } from 'react';

interface ActionPaletteProps {
  onFreeInput: (text: string) => void;
  disabled: boolean;
  visible?: boolean;
}

export function ActionPalette({ onFreeInput, disabled, visible = true }: ActionPaletteProps) {
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
    <div className={`fixed bottom-0 left-0 right-0 z-40 px-6 py-3 md:px-10 transition-all duration-700 ease-out ${
      visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`}>
      <div className="mx-auto max-w-lg">
        {!expanded ? (
          <button
            onClick={() => setExpanded(true)}
            className="text-[10px] text-[#2a2a30] hover:text-[#3a3a45] tracking-[0.5em] transition-colors cursor-pointer w-full text-center py-2"
          >
            ...
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder=""
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
  );
}

'use client';

import { useEffect } from 'react';

interface ReaderShortcutCallbacks {
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  onToggleSettings?: () => void;
  onToggleComments?: () => void;
  onToggleCompanion?: () => void;
  onToggleImmersive?: () => void;
  onEscape?: () => void;
  onShowHelp?: () => void;
}

export function useReaderShortcuts(callbacks: ReaderShortcutCallbacks) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Don't intercept browser shortcuts (Ctrl+F, Ctrl+S, etc.)
      if (e.ctrlKey || e.metaKey) return;

      switch (e.key) {
        case 'ArrowLeft':
          callbacks.onPrevEpisode?.();
          break;
        case 'ArrowRight':
          callbacks.onNextEpisode?.();
          break;
        case 's':
          e.preventDefault();
          callbacks.onToggleSettings?.();
          break;
        case 'c':
          e.preventDefault();
          callbacks.onToggleComments?.();
          break;
        case 'a':
          e.preventDefault();
          callbacks.onToggleCompanion?.();
          break;
        case 'f':
          e.preventDefault();
          callbacks.onToggleImmersive?.();
          break;
        case 'Escape':
          callbacks.onEscape?.();
          break;
        case '?':
          e.preventDefault();
          callbacks.onShowHelp?.();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callbacks]);
}

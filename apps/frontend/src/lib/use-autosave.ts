import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from './api';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved' | 'error';

interface UseAutosaveOptions {
  workId: string;
  episodeId?: string;
  title: string;
  content: string;
  debounceMs?: number;
}

export function useAutosave({ workId, episodeId, title, content, debounceMs = 2000 }: UseAutosaveOptions) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef({ title: '', content: '' });
  const initialRef = useRef({ title, content });
  const mountedRef = useRef(false);

  const save = useCallback(async (t: string, c: string) => {
    if (t === lastSavedRef.current.title && c === lastSavedRef.current.content) return;
    if (!t.trim() && !c.trim()) return;

    setStatus('saving');
    try {
      await api.saveDraft({ workId, episodeId, title: t, content: c });
      lastSavedRef.current = { title: t, content: c };
      setLastSavedAt(new Date());
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }, [workId, episodeId]);

  useEffect(() => {
    // Skip first render (initial values)
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    // Skip if content hasn't changed from initial values
    if (title === initialRef.current.title && content === initialRef.current.content) return;

    setStatus('unsaved');

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      save(title, content);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [title, content, debounceMs, save]);

  const deleteDraft = useCallback(async () => {
    try {
      await api.deleteDraft(workId, episodeId);
    } catch {
      // ignore
    }
  }, [workId, episodeId]);

  return { status, lastSavedAt, deleteDraft };
}

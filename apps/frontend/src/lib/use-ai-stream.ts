import { useState, useRef, useCallback } from 'react';
import { api } from './api';

interface UseAiStreamReturn {
  result: string;
  isStreaming: boolean;
  error: string | null;
  generate: (templateSlug: string, variables: Record<string, string>, premiumMode?: boolean) => Promise<void>;
  abort: () => void;
  reset: () => void;
}

export function useAiStream(): UseAiStreamReturn {
  const [result, setResult] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    setResult('');
    setError(null);
    setIsStreaming(false);
  }, []);

  const generate = useCallback(async (templateSlug: string, variables: Record<string, string>, premiumMode?: boolean) => {
    abort();
    setResult('');
    setError(null);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await api.fetchSSE(
        '/ai/assist',
        { templateSlug, variables, ...(premiumMode ? { premiumMode: true } : {}) },
        controller.signal,
      );

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              setError(parsed.error);
              break;
            }
            if (parsed.text) {
              setResult((prev) => prev + parsed.text);
            }
          } catch {
            // Skip malformed data
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsStreaming(false);
    }
  }, [abort]);

  return { result, isStreaming, error, generate, abort, reset };
}

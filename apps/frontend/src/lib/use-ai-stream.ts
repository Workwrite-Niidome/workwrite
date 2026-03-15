import { useState, useRef, useCallback } from 'react';
import { api } from './api';

/**
 * Low-level SSE stream consumer. Handles reader/decoder/buffer boilerplate.
 * Call `onEvent` for each parsed SSE data object.
 */
export async function consumeSSEStream(
  response: Response,
  onEvent: (parsed: any) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  let buffer = '';

  const processLine = (line: string) => {
    if (!line.startsWith('data: ')) return;
    const d = line.slice(6).trim();
    if (d === '[DONE]') return;
    try {
      onEvent(JSON.parse(d));
    } catch { /* skip malformed */ }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) processLine(line);
  }
  if (buffer.trim()) {
    for (const line of buffer.split('\n')) processLine(line);
  }
}

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
          if (data === '[DONE]') continue;

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
      // Process remaining buffer
      if (buffer.trim()) {
        const remaining = buffer.trim();
        if (remaining.startsWith('data: ')) {
          const d = remaining.slice(6).trim();
          if (d !== '[DONE]') {
            try {
              const parsed = JSON.parse(d);
              if (parsed.error) {
                setError(parsed.error);
              } else if (parsed.text) {
                setResult((prev) => prev + parsed.text);
              }
            } catch { /* skip */ }
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

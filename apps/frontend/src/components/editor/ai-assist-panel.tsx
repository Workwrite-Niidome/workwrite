'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TemplateSelector, type PromptTemplate } from './template-selector';
import { useAiStream } from '@/lib/use-ai-stream';
import { api } from '@/lib/api';
import { X, Copy, ArrowDownToLine, StopCircle } from 'lucide-react';

interface AiAssistPanelProps {
  currentContent: string;
  onInsert: (text: string) => void;
  onClose: () => void;
}

export function AiAssistPanel({ currentContent, onInsert, onClose }: AiAssistPanelProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const { result, isStreaming, error, generate, abort, reset } = useAiStream();

  useEffect(() => {
    api.getAiStatus()
      .then((res) => setAvailable(res.data.available))
      .catch(() => setAvailable(false));
    api.getPromptTemplates()
      .then((res) => setTemplates(res.data))
      .catch(() => {});
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (available === false) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-sm font-medium">AI アシスト</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            AI機能は現在利用できません。<br />
            管理者がAPIキーを設定するとご利用いただけます。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-medium">AI アシスト</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <TemplateSelector
          templates={templates}
          onGenerate={(slug, vars) => {
            reset();
            generate(slug, vars);
          }}
          isStreaming={isStreaming}
          currentContent={currentContent}
        />

        {error && (
          <div className="p-2 text-xs text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {(result || isStreaming) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">AI応答</p>
              {isStreaming && (
                <button
                  onClick={abort}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <StopCircle className="h-3 w-3" /> 停止
                </button>
              )}
            </div>
            <div className="p-3 bg-secondary/50 rounded-md text-sm leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
              {result}
              {isStreaming && <span className="inline-block w-1 h-4 bg-foreground animate-pulse ml-0.5" />}
            </div>
            {!isStreaming && result && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onInsert(result)} className="flex-1 text-xs">
                  <ArrowDownToLine className="h-3 w-3 mr-1" /> 挿入
                </Button>
                <Button size="sm" variant="outline" onClick={handleCopy} className="flex-1 text-xs">
                  <Copy className="h-3 w-3 mr-1" /> {copied ? 'コピー済み' : 'コピー'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

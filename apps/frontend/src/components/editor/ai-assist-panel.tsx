'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TemplateSelector, type PromptTemplate } from './template-selector';
import { useAiStream } from '@/lib/use-ai-stream';
import { api } from '@/lib/api';
import { X, Copy, ArrowDownToLine, StopCircle, Replace, Wand2, BookCheck, PenLine } from 'lucide-react';

interface AiAssistPanelProps {
  currentContent: string;
  selectedText?: string;
  onInsert: (text: string) => void;
  onReplace?: (text: string) => void;
  onClose: () => void;
}

interface HistoryItem {
  slug: string;
  result: string;
  timestamp: Date;
}

export function AiAssistPanel({ currentContent, selectedText, onInsert, onReplace, onClose }: AiAssistPanelProps) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const { result, isStreaming, error, generate, abort, reset } = useAiStream();

  useEffect(() => {
    api.getAiStatus()
      .then((res) => setAvailable(res.data.available))
      .catch(() => setAvailable(false));
    api.getPromptTemplates()
      .then((res) => setTemplates(res.data))
      .catch(() => {});
  }, []);

  // Save to history when generation completes
  useEffect(() => {
    if (!isStreaming && result && result.length > 0) {
      setHistory((prev) => [
        { slug: 'last', result, timestamp: new Date() },
        ...prev.slice(0, 4),
      ]);
    }
  }, [isStreaming, result]);

  function handleCopy() {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleQuickAction(slug: string) {
    reset();
    const vars: Record<string, string> = { content: selectedText || currentContent };
    generate(slug, vars);
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
        {/* Quick actions */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">クイックアクション</p>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1"
              onClick={() => handleQuickAction('proofread')}
              disabled={isStreaming}
            >
              <BookCheck className="h-3 w-3" /> 校正
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1"
              onClick={() => handleQuickAction('continue-writing')}
              disabled={isStreaming}
            >
              <PenLine className="h-3 w-3" /> 続きを書く
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1"
              onClick={() => handleQuickAction('style-adjust')}
              disabled={isStreaming}
            >
              <Wand2 className="h-3 w-3" /> 文体調整
            </Button>
          </div>
        </div>

        {/* Selected text preview */}
        {selectedText && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">選択テキスト</p>
            <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground line-clamp-3 italic">
              {selectedText}
            </div>
          </div>
        )}

        <TemplateSelector
          templates={templates}
          onGenerate={(slug, vars) => {
            reset();
            generate(slug, vars);
          }}
          isStreaming={isStreaming}
          currentContent={selectedText || currentContent}
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
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => onInsert(result)} className="flex-1 text-xs">
                  <ArrowDownToLine className="h-3 w-3 mr-1" /> 挿入
                </Button>
                {selectedText && onReplace && (
                  <Button size="sm" variant="outline" onClick={() => onReplace(result)} className="flex-1 text-xs">
                    <Replace className="h-3 w-3 mr-1" /> 置換
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleCopy} className="flex-1 text-xs">
                  <Copy className="h-3 w-3 mr-1" /> {copied ? 'コピー済み' : 'コピー'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {history.length > 0 && !isStreaming && !result && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">履歴</p>
            {history.map((item, i) => (
              <button
                key={i}
                onClick={() => onInsert(item.result)}
                className="w-full text-left p-2 bg-muted/30 rounded text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <p className="line-clamp-2">{item.result}</p>
                <p className="text-[10px] mt-0.5">
                  {item.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

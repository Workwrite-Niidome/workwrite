'use client';

import { useState } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface Props {
  workId: string;
  episodeId: string;
  content: string;
}

interface CheckResult {
  typos: { location: string; issue: string; suggestion: string }[];
  characterIssues: { character: string; issue: string; detail: string }[];
  plotIssues: { issue: string; detail: string }[];
}

export function AiConsistencyCheck({ workId, episodeId, content }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState('');

  async function handleCheck() {
    if (!content.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.aiCheck(workId, episodeId, content);
      setResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'チェックに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  const totalIssues = result
    ? result.typos.length + result.characterIssues.length + result.plotIssues.length
    : 0;

  return (
    <div className="border-t border-border">
      <div className="flex items-center gap-2 p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCheck}
          disabled={loading || !content.trim()}
          className="gap-1 text-xs"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {loading ? 'チェック中...' : 'AIにチェックしてもらう'}
        </Button>
        {result && totalIssues === 0 && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> 問題なし
          </span>
        )}
        {result && totalIssues > 0 && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> {totalIssues}件の指摘
          </span>
        )}
      </div>

      {error && (
        <div className="px-3 pb-3 text-xs text-destructive">{error}</div>
      )}

      {result && totalIssues > 0 && (
        <div className="px-3 pb-3 space-y-2">
          {result.typos.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">誤字脱字</p>
              {result.typos.map((t, i) => (
                <div key={i} className="text-[10px] p-1.5 bg-amber-50 dark:bg-amber-950/20 rounded mb-1">
                  <span className="text-amber-700 dark:text-amber-400">「{t.location}」</span>
                  <span className="text-muted-foreground ml-1">{t.issue}</span>
                  {t.suggestion && <span className="text-foreground ml-1">→ {t.suggestion}</span>}
                </div>
              ))}
            </div>
          )}

          {result.characterIssues.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">キャラクター整合性</p>
              {result.characterIssues.map((c, i) => (
                <div key={i} className="text-[10px] p-1.5 bg-blue-50 dark:bg-blue-950/20 rounded mb-1">
                  <span className="font-medium">{c.character}:</span>
                  <span className="text-muted-foreground ml-1">{c.issue}</span>
                  {c.detail && <p className="text-muted-foreground mt-0.5">{c.detail}</p>}
                </div>
              ))}
            </div>
          )}

          {result.plotIssues.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">プロット整合性</p>
              {result.plotIssues.map((p, i) => (
                <div key={i} className="text-[10px] p-1.5 bg-purple-50 dark:bg-purple-950/20 rounded mb-1">
                  <span className="font-medium">{p.issue}</span>
                  {p.detail && <p className="text-muted-foreground mt-0.5">{p.detail}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

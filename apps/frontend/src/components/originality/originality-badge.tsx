import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OriginalityBadgeProps {
  /** 0.0 (全てAI) - 1.0 (全て人間)。nullの場合isAiGeneratedフラグで判定 */
  score: number | null;
  /** isAiGenerated=trueでoriginality=nullの作品向け */
  isAiGenerated?: boolean;
  className?: string;
}

/** AI利用率が高いほど目立つ色 */
function getColor(aiPct: number) {
  if (aiPct <= 10) return 'text-muted-foreground bg-muted/50 border-border';
  if (aiPct <= 30) return 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/30';
  if (aiPct <= 50) return 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30';
  return 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30';
}

export function OriginalityBadge({ score, isAiGenerated, className }: OriginalityBadgeProps) {
  // isAiGenerated=true だけどoriginality未算出 → AI利用率高として表示
  if (score == null) {
    if (!isAiGenerated) return null;
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium cursor-help',
          'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30',
          className,
        )}
        title="この作品はAIを主体に生成されています"
      >
        <Bot className="h-3 w-3" />
        AI利用率 高
      </span>
    );
  }

  const aiPct = Math.round((1 - score) * 100);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium cursor-help',
        getColor(aiPct),
        className,
      )}
      title={aiPct === 0 ? 'この作品はAIを使用していません' : `この作品の約${aiPct}%にAI執筆アシストが使用されています`}
    >
      <Bot className="h-3 w-3" />
      AI利用率 {aiPct}%
    </span>
  );
}

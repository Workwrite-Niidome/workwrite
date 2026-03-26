import { Bot, Pen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OriginalityBadgeProps {
  /** 0.0 (全てAI) - 1.0 (全て人間) */
  score: number | null;
  className?: string;
}

/** originality 50%以上の作品にのみ表示。50%未満はAiGeneratedBadgeに任せる */
export function OriginalityBadge({ score, className }: OriginalityBadgeProps) {
  if (score == null || score < 0.5) return null;

  const aiPct = Math.round((1 - score) * 100);
  const isOriginal = score >= 0.9;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border font-medium shrink-0 text-[10px] px-1.5 py-0.5',
        'bg-muted/50 border-border text-muted-foreground',
        className,
      )}
      title={aiPct === 0 ? 'この作品はAIを使用していません' : `この作品の約${aiPct}%にAI執筆アシストが使用されています`}
    >
      {isOriginal ? <Pen className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
      {isOriginal ? 'オリジナル' : `AI ${aiPct}%`}
    </span>
  );
}

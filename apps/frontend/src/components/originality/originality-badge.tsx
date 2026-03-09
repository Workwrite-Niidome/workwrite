import { Pen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OriginalityBadgeProps {
  score: number; // 0.0 - 1.0
  className?: string;
}

function getColor(score: number) {
  if (score >= 0.9) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 0.7) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (score >= 0.5) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-muted-foreground bg-muted border-border';
}

export function OriginalityBadge({ score, className }: OriginalityBadgeProps) {
  const pct = Math.round(score * 100);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium cursor-help',
        getColor(score),
        className,
      )}
      title={`この作品の ${pct}% は著者自身の言葉で書かれています。AIは創作の補助ツールとして使用されました。`}
    >
      <Pen className="h-3 w-3" />
      {pct}% 人間の創作
    </span>
  );
}

import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number;
  className?: string;
}

function getScoreColor(score: number) {
  if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (score >= 40) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-muted-foreground bg-muted border-border';
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        getScoreColor(score),
        className,
      )}
    >
      {Math.round(score)}
    </span>
  );
}

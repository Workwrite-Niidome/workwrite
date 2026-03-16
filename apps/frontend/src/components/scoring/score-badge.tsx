import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number;
  className?: string;
}

function getScoreColor(score: number) {
  if (score >= 90) return 'text-purple-600 bg-purple-50 border-purple-200';
  if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 65) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (score >= 50) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-muted-foreground bg-muted border-border';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return '傑作';
  if (score >= 80) return '秀作';
  if (score >= 65) return '良作';
  if (score >= 50) return '佳作';
  return '—';
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        getScoreColor(score),
        className,
      )}
    >
      {Math.round(score)}
      <span className="opacity-70">{getScoreLabel(score)}</span>
    </span>
  );
}

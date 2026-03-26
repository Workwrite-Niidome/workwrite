import { Bot, Pen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OriginalityBadgeProps {
  /** 0.0 (全てAI) - 1.0 (全て人間) */
  score: number | null;
  className?: string;
}

function getConfig(originality: number): { color: string; label: string; icon: 'pen' | 'bot' } {
  const aiPct = Math.round((1 - originality) * 100);
  if (originality >= 0.9) return { color: 'text-muted-foreground', label: 'オリジナル', icon: 'pen' };
  if (originality >= 0.7) return { color: 'text-muted-foreground', label: `AI ${aiPct}%`, icon: 'bot' };
  return { color: 'text-muted-foreground', label: `AI ${aiPct}%`, icon: 'bot' };
}

/** originality 50%以上の作品にのみ表示。50%未満はAiGeneratedBadgeに任せる */
export function OriginalityBadge({ score, className }: OriginalityBadgeProps) {
  if (score == null || score < 0.5) return null;

  const { color, label, icon } = getConfig(score);
  const aiPct = Math.round((1 - score) * 100);
  const Icon = icon === 'pen' ? Pen : Bot;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] cursor-help',
        color,
        className,
      )}
      title={aiPct === 0 ? 'この作品はAIを使用していません' : `この作品の約${aiPct}%にAI執筆アシストが使用されています`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

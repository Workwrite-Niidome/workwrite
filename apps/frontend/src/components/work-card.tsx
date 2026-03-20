import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScoreBadge } from '@/components/scoring/score-badge';
import { AiGeneratedBadge } from '@/components/ui/ai-generated-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GENRE_LABELS } from '@/lib/constants';
import type { Work } from '@/lib/api';

interface WorkCardProps {
  work: Work;
  showSynopsis?: boolean;
}

export function WorkCard({ work, showSynopsis = true }: WorkCardProps) {
  const totalWords = work.episodes?.reduce((sum, ep) => sum + ep.wordCount, 0) ?? 0;
  const episodeCount = work._count?.episodes ?? work.episodes?.length ?? 0;

  return (
    <Link href={`/works/${work.id}`} className="group block">
      <Card className="h-full hover:shadow-md hover:border-primary/20 transition-all">
        <CardContent className="p-5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {work.isAiGenerated && <AiGeneratedBadge />}
              {work.genre && (
                <Badge variant="outline" className="text-[11px] shrink-0">
                  {GENRE_LABELS[work.genre] || work.genre}
                </Badge>
              )}
            </div>
            {work.qualityScore && (
              <ScoreBadge score={work.qualityScore.overall} className="shrink-0" />
            )}
          </div>

          <h3 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-foreground/80 transition-colors">
            {work.title}
          </h3>

          <p className="text-xs text-muted-foreground">
            {work.author.displayName || work.author.name}
          </p>

          {showSynopsis && work.synopsis && (
            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
              {work.synopsis}
            </p>
          )}

          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {work.tags?.slice(0, 3).map((t) => (
              <span key={t.id} className="text-[11px] text-muted-foreground">#{t.tag}</span>
            ))}
            {(episodeCount > 0 || totalWords > 0) && (
              <span className="text-[11px] text-muted-foreground ml-auto">
                {episodeCount > 0 && `全${episodeCount}話`}
                {episodeCount > 0 && totalWords > 0 && ' / '}
                {totalWords > 0 && (totalWords >= 10000
                  ? `${(totalWords / 10000).toFixed(1)}万字`
                  : `${totalWords.toLocaleString()}字`)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function WorkCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </CardContent>
    </Card>
  );
}

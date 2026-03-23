'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { PostWork } from '@/lib/api';
import { GENRE_LABELS } from '@/lib/constants';

interface WorkEmbedProps {
  work: PostWork;
}

export function WorkEmbed({ work }: WorkEmbedProps) {
  const episodeCount = work._count?.episodes ?? 0;

  return (
    <Link
      href={`/works/${work.id}`}
      onClick={(e) => e.stopPropagation()}
      className="block mt-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start gap-2">
        <BookOpen className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{work.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {work.genre && <span>{GENRE_LABELS[work.genre] || work.genre}</span>}
            {episodeCount > 0 && <span>{work.genre ? ' · ' : ''}全{episodeCount}話</span>}
          </p>
          {work.synopsis && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {work.synopsis}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

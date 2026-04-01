'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { worldFragmentsApi, type CanonWork } from '@/lib/world-fragments-api';

export default function WorldFragmentsIndexPage() {
  const [works, setWorks] = useState<CanonWork[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    worldFragmentsApi
      .listCanonWorks()
      .then((data) => setWorks(data.works))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <header className="space-y-3 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground/60">
            World Fragments
          </p>
          <h1 className="text-2xl font-serif font-medium tracking-tight">
            世界の断片
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            物語の世界に、あなたの「もしも」を願う。
            原作を壊さず、見えなかった断片が生まれる。
          </p>
        </header>

        {/* Works List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : works.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            <p className="font-serif text-base mb-2">まだ世界はありません</p>
            <p>Canon が構築された作品がここに表示されます。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {works.map((work) => (
              <Link key={work.id} href={`/world-fragments/${work.id}`}>
                <Card className="hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group">
                  <CardContent className="p-5 flex gap-4">
                    {/* Cover */}
                    {work.coverUrl ? (
                      <div className="w-16 h-22 flex-shrink-0 rounded-md overflow-hidden bg-secondary">
                        <img
                          src={work.coverUrl}
                          alt={work.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-22 flex-shrink-0 rounded-md bg-secondary/60 flex items-center justify-center">
                        <span className="text-2xl text-muted-foreground/30 font-serif">
                          {work.title[0]}
                        </span>
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h2 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {work.title}
                        </h2>
                        {work.genre && (
                          <Badge variant="outline" className="text-xs font-normal flex-shrink-0">
                            {work.genre}
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {work.author.displayName || work.author.name}
                      </p>

                      {work.synopsis && (
                        <p className="text-xs text-muted-foreground/80 line-clamp-2">
                          {work.synopsis}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground/60 pt-0.5">
                        <span>Canon v{work.canon.canonVersion}</span>
                        <span>第{work.canon.upToEpisode}話まで</span>
                        {work.fragmentCount > 0 && (
                          <span>{work.fragmentCount} fragments</span>
                        )}
                        <span className="capitalize">
                          {work.completionStatus === 'COMPLETED' ? '完結' :
                           work.completionStatus === 'ONGOING' ? '連載中' : '休載中'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground/40 py-8 border-t border-border/30">
          <p>World Fragments — 一つの小説が、一つの世界になる</p>
        </footer>
      </div>
    </div>
  );
}

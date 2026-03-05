'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type Work } from '@/lib/api';

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Work[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialQuery) doSearch(initialQuery);
  }, [initialQuery]);

  async function doSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await api.searchWorks(q);
      setResults(res.data.hits);
      setTotal(res.data.total);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch(query);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="作品名、著者名、タグで検索..."
          className="flex-1"
        />
        <Button type="submit">
          <Search className="h-4 w-4 mr-2" /> 検索
        </Button>
      </form>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-1 mb-4">
          <p className="text-sm text-muted-foreground mb-4">{total}件の結果</p>
          {results.map((work) => (
            <Link key={work.id} href={`/works/${work.id}`}>
              <Card className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-medium">{work.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {work.author?.displayName || work.author?.name}
                    </p>
                    {work.synopsis && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{work.synopsis}</p>
                    )}
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {work.genre && <Badge variant="outline" className="text-xs">{work.genre}</Badge>}
                      {work.tags?.map((t) => (
                        <Badge key={t.id} variant="secondary" className="text-xs">{t.tag}</Badge>
                      ))}
                    </div>
                  </div>
                  {work.qualityScore && (
                    <Badge variant="default" className="shrink-0">
                      {Math.round(work.qualityScore.overall)}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : initialQuery ? (
        <p className="text-center text-muted-foreground py-16">
          「{initialQuery}」に一致する作品が見つかりませんでした
        </p>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}

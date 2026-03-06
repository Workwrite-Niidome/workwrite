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

const GENRES = ['fantasy', 'sf', 'mystery', 'romance', 'horror', 'literary', 'adventure', 'comedy', 'drama', 'historical', 'other'];
const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest' },
  { value: 'score', label: 'Highest Score' },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [genre, setGenre] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
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
      const res = await api.searchWorks(q, { genre: genre || undefined });
      let hits = res.data.hits;

      if (sortBy === 'newest') {
        hits = [...hits].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else if (sortBy === 'score') {
        hits = [...hits].sort((a, b) => (b.qualityScore?.overall ?? 0) - (a.qualityScore?.overall ?? 0));
      }

      setResults(hits);
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
    <div className="mx-auto max-w-2xl px-6 py-8">
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, author, or tag..."
            className="pl-9"
          />
        </div>
        <Button type="submit" aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <select
          value={genre}
          onChange={(e) => { setGenre(e.target.value); if (query) doSearch(query); }}
          className="h-8 rounded-lg border border-border bg-transparent px-2 text-xs"
          aria-label="Filter by genre"
        >
          <option value="">All genres</option>
          {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); if (query) doSearch(query); }}
          className="h-8 rounded-lg border border-border bg-transparent px-2 text-xs"
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="py-4 border-b border-border space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <div>
          <p className="text-xs text-muted-foreground mb-4">{total} results</p>
          {results.map((work) => (
            <Link key={work.id} href={`/works/${work.id}`} className="group block">
              <article className="py-4 border-b border-border last:border-b-0 transition-colors group-hover:bg-secondary/30 -mx-2 px-2 rounded">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm leading-snug group-hover:text-foreground/80 transition-colors">
                      {work.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {work.author?.displayName || work.author?.name}
                    </p>
                    {work.synopsis && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{work.synopsis}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {work.genre && (
                        <span className="text-[11px] text-muted-foreground">{work.genre}</span>
                      )}
                      {work.tags?.slice(0, 3).map((t) => (
                        <span key={t.id} className="text-[11px] text-muted-foreground">#{t.tag}</span>
                      ))}
                    </div>
                  </div>
                  {work.qualityScore && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      score {Math.round(work.qualityScore.overall)}
                    </span>
                  )}
                </div>
              </article>
            </Link>
          ))}
        </div>
      ) : initialQuery ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">
            No results for "{initialQuery}"
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Try different keywords or remove filters.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-2xl px-6 py-8 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}

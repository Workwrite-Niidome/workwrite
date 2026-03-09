'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScoreBadge } from '@/components/scoring/score-badge';
import { useAuth } from '@/lib/auth-context';
import { api, type Work } from '@/lib/api';

const GENRE_LABELS: Record<string, string> = {
  fantasy: 'ファンタジー',
  sf: 'SF',
  mystery: 'ミステリー',
  romance: '恋愛',
  horror: 'ホラー',
  literary: '純文学',
  adventure: '冒険',
  comedy: 'コメディ',
  drama: 'ドラマ',
  historical: '歴史',
  other: 'その他',
};

const GENRES = Object.keys(GENRE_LABELS);
const SORT_OPTIONS = [
  { value: 'relevance', label: '関連度' },
  { value: 'newest', label: '新しい順' },
  { value: 'score', label: 'スコア順' },
];

const PAGE_SIZE = 20;

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [genre, setGenre] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [results, setResults] = useState<Work[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialQuery) doSearch(initialQuery, 0);
  }, [initialQuery]);

  async function doSearch(q: string, pageNum: number) {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await api.searchWorks(q, {
        genre: genre || undefined,
        sort: sortBy !== 'relevance' ? sortBy : undefined,
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
      });
      setResults(res.data.hits);
      setTotal(res.data.total);
      setPage(pageNum);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch(query, 0);
  }

  function handleSortChange(value: string) {
    setSortBy(value);
    if (query) doSearch(query, 0);
  }

  function handleGenreChange(value: string) {
    setGenre(value);
    if (query) doSearch(query, 0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="タイトル、著者、タグで検索..."
            className="pl-9"
          />
        </div>
        <Button type="submit" aria-label="検索">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <select
          value={genre}
          onChange={(e) => handleGenreChange(e.target.value)}
          className="h-8 rounded-lg border border-border bg-transparent px-2 text-xs"
          aria-label="ジャンルで絞り込み"
        >
          <option value="">すべてのジャンル</option>
          {GENRES.map((g) => <option key={g} value={g}>{GENRE_LABELS[g]}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={(e) => handleSortChange(e.target.value)}
          className="h-8 rounded-lg border border-border bg-transparent px-2 text-xs"
          aria-label="並べ替え"
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
          <p className="text-xs text-muted-foreground mb-4">{total}件の結果</p>
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
                        <span className="text-[11px] text-muted-foreground">
                          {GENRE_LABELS[work.genre] || work.genre}
                        </span>
                      )}
                      {work.tags?.slice(0, 3).map((t) => (
                        <span key={t.id} className="text-[11px] text-muted-foreground">#{t.tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {work.qualityScore && (
                      <ScoreBadge score={work.qualityScore.overall} />
                    )}
                  </div>
                </div>
              </article>
            </Link>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => doSearch(query, page - 1)}
                className="min-h-[36px]"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => doSearch(query, page + 1)}
                className="min-h-[36px]"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ) : initialQuery ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">
            「{initialQuery}」の検索結果はありません
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            別のキーワードで検索するか、フィルターを変更してください。
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

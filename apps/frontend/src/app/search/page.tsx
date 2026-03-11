'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { api, type Work } from '@/lib/api';
import { WorkCard, WorkCardSkeleton } from '@/components/work-card';
import { GENRE_LABELS } from '@/lib/constants';

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
  const initialSort = searchParams.get('sort') || 'relevance';
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [genre, setGenre] = useState('');
  const [sortBy, setSortBy] = useState(initialSort);
  const [results, setResults] = useState<Work[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialQuery !== undefined) doSearch(initialQuery, 0);
  }, [initialQuery]);

  async function doSearch(q: string, pageNum: number) {
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
    doSearch(query, 0);
  }

  function handleGenreChange(value: string) {
    setGenre(value);
    doSearch(query, 0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="px-4 md:px-6 py-8">
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
      <div className="flex flex-wrap items-center gap-2 mb-6">
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
        {(genre || sortBy !== 'relevance') && (
          <button
            onClick={() => { setGenre(''); setSortBy('relevance'); doSearch(query, 0); }}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            フィルターをクリア
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <WorkCardSkeleton key={i} />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div>
          <p className="text-xs text-muted-foreground mb-4">{total}件の結果</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((work) => (
              <WorkCard key={work.id} work={work} />
            ))}
          </div>

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
      <div className="px-4 md:px-6 py-8">
        <Skeleton className="h-10 w-full mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <WorkCardSkeleton key={i} />
          ))}
        </div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CharacterCard } from '@/components/character-match-carousel';
import { api, type CharacterMatch } from '@/lib/api';
import { GENRE_LABELS } from '@/lib/constants';

const GENDERS = [
  { value: '男性', label: '男性' },
  { value: '女性', label: '女性' },
  { value: 'その他', label: 'その他' },
];
const AGE_RANGES = ['10代', '20代', '30代', '40代', '50代'];
const PAGE_SIZE = 20;

export default function DiscoverCharactersPage() {
  const [characters, setCharacters] = useState<CharacterMatch[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [gender, setGender] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [genre, setGenre] = useState('');

  const fetchCharacters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCharacterMatches({
        gender: gender || undefined,
        ageRange: ageRange || undefined,
        genre: genre || undefined,
        page,
        limit: PAGE_SIZE,
      });
      const raw = (res as any).data || res;
      setCharacters(Array.isArray(raw?.data) ? raw.data : []);
      setTotal(raw?.total || 0);
    } catch {
      setCharacters([]);
      setTotal(0);
    }
    setLoading(false);
  }, [gender, ageRange, genre, page]);

  useEffect(() => { fetchCharacters(); }, [fetchCharacters]);

  const hasFilter = !!(gender || ageRange || genre);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function applyFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <div className="px-4 md:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/discover">
          <Button variant="ghost" size="sm" className="gap-1">
            <ChevronLeft className="h-4 w-4" /> 探す
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">キャラクターと出会う</h1>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-primary/30 text-primary">Beta</span>
          </div>
          <p className="text-xs text-muted-foreground">気になるキャラクターから、作品を見つけよう</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <select
          value={gender}
          onChange={(e) => applyFilter(setGender, e.target.value)}
          className="h-9 rounded-lg border border-border bg-transparent px-3 text-sm"
          aria-label="性別"
        >
          <option value="">性別</option>
          {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        <select
          value={ageRange}
          onChange={(e) => applyFilter(setAgeRange, e.target.value)}
          className="h-9 rounded-lg border border-border bg-transparent px-3 text-sm"
          aria-label="年代"
        >
          <option value="">年代</option>
          {AGE_RANGES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={genre}
          onChange={(e) => applyFilter(setGenre, e.target.value)}
          className="h-9 rounded-lg border border-border bg-transparent px-3 text-sm"
          aria-label="ジャンル"
        >
          <option value="">ジャンル</option>
          {Object.entries(GENRE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-sm gap-1"
            onClick={() => { setGender(''); setAgeRange(''); setGenre(''); setPage(1); }}
          >
            <X className="h-3.5 w-3.5" /> クリア
          </Button>
        )}
        {!loading && (
          <span className="flex items-center text-xs text-muted-foreground ml-auto">
            {total}件
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border border-border rounded-xl p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-3/4 mb-3" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))
        ) : characters.length === 0 ? (
          <div className="col-span-full text-center py-16 text-sm text-muted-foreground">
            {hasFilter ? '条件に合うキャラクターが見つかりませんでした' : 'キャラクターがまだ登録されていません'}
          </div>
        ) : (
          characters.map((char) => (
            <CharacterCard key={char.id} character={char} />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8">
          <p className="text-xs text-muted-foreground">{total}件中 {(page - 1) * PAGE_SIZE + 1}〜{Math.min(page * PAGE_SIZE, total)}件</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

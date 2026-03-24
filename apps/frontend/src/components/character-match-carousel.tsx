'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessageCircle, BookOpen, ChevronLeft, ChevronRight, Filter, X, Send, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type CharacterMatch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { GENRE_LABELS } from '@/lib/constants';

const GENDERS = [
  { value: '男性', label: '男性' },
  { value: '女性', label: '女性' },
  { value: 'その他', label: 'その他' },
];
const AGE_RANGES = ['10代', '20代', '30代', '40代', '50代'];

interface CharacterMatchCarouselProps {
  limit?: number;
}

export function CharacterMatchCarousel({ limit = 10 }: CharacterMatchCarouselProps) {
  const [characters, setCharacters] = useState<CharacterMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [gender, setGender] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [genre, setGenre] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchCharacters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCharacterMatches({
        gender: gender || undefined,
        ageRange: ageRange || undefined,
        genre: genre || undefined,
        limit,
      });
      const data = (res as any).data || res;
      setCharacters(Array.isArray(data) ? data : []);
    } catch {
      setCharacters([]);
    }
    setLoading(false);
  }, [gender, ageRange, genre, limit]);

  useEffect(() => { fetchCharacters(); }, [fetchCharacters]);

  const hasFilter = !!(gender || ageRange || genre);

  function scroll(direction: 'left' | 'right') {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.7;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }

  if (!loading && characters.length === 0 && !hasFilter) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">キャラクターと出会う</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-primary/30 text-primary">Beta</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 text-xs gap-1', hasFilter && 'text-primary')}
            onClick={() => setShowFilter(!showFilter)}
          >
            <Filter className="h-3.5 w-3.5" />
            絞り込み
            {hasFilter && (
              <span className="bg-primary text-primary-foreground rounded-full h-4 w-4 text-[10px] flex items-center justify-center">
                {[gender, ageRange, genre].filter(Boolean).length}
              </span>
            )}
          </Button>
          <Link href="/discover/characters" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            もっと見る <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilter && (
        <div className="flex flex-wrap gap-2 mb-4 p-3 bg-secondary/30 rounded-lg border border-border">
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="h-8 rounded border border-border bg-transparent px-2 text-xs"
            aria-label="性別"
          >
            <option value="">性別</option>
            {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          <select
            value={ageRange}
            onChange={(e) => setAgeRange(e.target.value)}
            className="h-8 rounded border border-border bg-transparent px-2 text-xs"
            aria-label="年代"
          >
            <option value="">年代</option>
            {AGE_RANGES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="h-8 rounded border border-border bg-transparent px-2 text-xs"
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
              className="h-8 text-xs gap-1"
              onClick={() => { setGender(''); setAgeRange(''); setGenre(''); }}
            >
              <X className="h-3 w-3" /> クリア
            </Button>
          )}
        </div>
      )}

      {/* Carousel */}
      <div className="relative group">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/90 border border-border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="前へ"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-64 border border-border rounded-xl p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-3/4 mb-3" />
                <Skeleton className="h-12 w-full mb-3" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))
          ) : characters.length === 0 ? (
            <div className="flex-shrink-0 w-full text-center py-8 text-sm text-muted-foreground">
              条件に合うキャラクターが見つかりませんでした
            </div>
          ) : (
            characters.map((char) => (
              <div key={char.id} className="flex-shrink-0 w-64">
                <CharacterCard character={char} />
              </div>
            ))
          )}
        </div>
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/90 border border-border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="次へ"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

const PRESET_MESSAGES = [
  'あなたはどんな人？',
  'あなたの世界ってどんなところ？',
  '最近どんなことがあった？',
];

export function CharacterCard({ character }: { character: CharacterMatch }) {
  const c = character;
  const router = useRouter();
  const [freeText, setFreeText] = useState('');
  const [showTalk, setShowTalk] = useState(false);
  const personalitySnippet = c.personality
    ? c.personality.length > 60 ? c.personality.slice(0, 60) + '...' : c.personality
    : null;

  function goToTalk(message: string) {
    const params = new URLSearchParams();
    params.set('characterId', c.id);
    params.set('message', message);
    router.push(`/works/${c.work.id}/character-talk?${params.toString()}`);
  }

  return (
    <div className="border border-border rounded-xl p-4 hover:border-primary/20 hover:shadow-sm transition-all bg-card">
      {/* Character header */}
      <div className="mb-2">
        <div className="flex items-center gap-1.5">
          <h3 className="font-medium text-sm truncate">{c.name}</h3>
          {c.firstPerson && (
            <span className="text-[10px] text-muted-foreground shrink-0 max-w-[4em] truncate">
              {c.firstPerson}
            </span>
          )}
        </div>
        <div className="flex gap-1 mt-1">
          {c.gender && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{c.gender}</Badge>}
          {c.age && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{c.age}</Badge>}
        </div>
      </div>

      {/* Personality + Speech style */}
      {(personalitySnippet || c.speechStyle) && (
        <div className="text-xs text-muted-foreground mb-3 space-y-1">
          {personalitySnippet && <p className="line-clamp-2">{personalitySnippet}</p>}
          {c.speechStyle && <p className="text-[10px] truncate">口調: {c.speechStyle}</p>}
        </div>
      )}

      {/* Work info */}
      <div className="border-t border-border pt-2 mt-auto">
        <Link href={`/works/${c.work.id}`} className="group/work">
          <p className="text-xs font-medium truncate group-hover/work:text-primary transition-colors">
            {c.work.title}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {c.work.author.displayName || c.work.author.name}
          </p>
        </Link>
      </div>

      {/* Actions */}
      <div className="mt-3 space-y-1.5">
        {c.work.enableCharacterTalk && !showTalk && (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs gap-1"
            onClick={() => setShowTalk(true)}
          >
            <MessageCircle className="h-3 w-3" /> 話してみる
          </Button>
        )}

        {c.work.enableCharacterTalk && showTalk && (
          <div className="space-y-1">
            {PRESET_MESSAGES.map((msg) => (
              <button
                key={msg}
                onClick={() => goToTalk(msg)}
                className="w-full text-left text-xs px-2 py-1.5 rounded-md border border-border hover:bg-secondary hover:border-primary/20 transition-colors truncate"
              >
                {msg}
              </button>
            ))}
            <div className="flex gap-1">
              <input
                type="text"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && freeText.trim()) goToTalk(freeText.trim()); }}
                placeholder="自由に聞く..."
                className="flex-1 h-7 rounded-md border border-border bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={!freeText.trim()}
                onClick={() => freeText.trim() && goToTalk(freeText.trim())}
              >
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        <Link href={`/works/${c.work.id}`} className="block">
          <Button variant="ghost" size="sm" className="w-full h-7 text-xs gap-1">
            <BookOpen className="h-3 w-3" /> 作品を見る
          </Button>
        </Link>
      </div>
    </div>
  );
}

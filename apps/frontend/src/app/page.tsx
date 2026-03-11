'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { estimateReadingTime } from '@/lib/utils';
import { WorkCard, WorkCardSkeleton } from '@/components/work-card';
import { api, type Work, type TopPageData, type ContinueReadingItem } from '@/lib/api';

function FollowingFeedSection() {
  const [feed, setFeed] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFollowingFeed()
      .then((res) => setFeed(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && feed.length === 0) return null;

  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-medium">フォロー中の新着</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <WorkCardSkeleton key={i} />)
          : feed.slice(0, 6).map((work) => <WorkCard key={work.id} work={work} />)}
      </div>
    </section>
  );
}

const MOOD_CARDS = [
  { mood: 'courage', label: '勇気をもらいたい' },
  { mood: 'tears', label: '泣きたい' },
  { mood: 'healing', label: '癒されたい' },
  { mood: 'excitement', label: 'ドキドキしたい' },
  { mood: 'worldview', label: '世界観を広げたい' },
  { mood: 'laughter', label: '笑いたい' },
];

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<TopPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [continueReading, setContinueReading] = useState<ContinueReadingItem[]>([]);
  const [autocompleteResults, setAutocompleteResults] = useState<{ id: string; title: string; author: { name: string; displayName: string | null } }[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getTopPage()
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      api.getContinueReading()
        .then((res) => setContinueReading(res.data))
        .catch(() => {});
    }
  }, [isAuthenticated]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    if (value.trim().length < 2) {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
      return;
    }
    autocompleteTimer.current = setTimeout(async () => {
      try {
        const res = await api.autocomplete(value.trim());
        setAutocompleteResults(res.data);
        setShowAutocomplete(res.data.length > 0);
      } catch {
        setShowAutocomplete(false);
      }
    }, 300);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setShowAutocomplete(false);
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 md:px-6 py-16 sm:py-28 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6">Novel Platform</p>
          <h1 className="text-2xl sm:text-3xl font-serif font-normal leading-relaxed tracking-wide">
            読書で、変わる。
          </h1>
          <p className="mt-4 text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
            AIスコアリングと感情タグで、<br className="sm:hidden" />
            あなたの心に響く次の一冊を。
          </p>
          <form onSubmit={handleSearch} className="mt-10 flex gap-2 max-w-sm mx-auto">
            <div className="relative flex-1" ref={autocompleteRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => autocompleteResults.length > 0 && setShowAutocomplete(true)}
                placeholder="作品を検索"
                className="pl-9"
              />
              {showAutocomplete && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                  {autocompleteResults.map((item) => (
                    <Link
                      key={item.id}
                      href={`/works/${item.id}`}
                      onClick={() => setShowAutocomplete(false)}
                      className="block px-4 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.author.displayName || item.author.name}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Button type="submit" aria-label="検索">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </section>

      <div className="px-4 md:px-6 py-12 space-y-16">
        {/* Continue Reading */}
        {isAuthenticated && continueReading.length > 0 && (
          <section>
            <h2 className="text-sm font-medium mb-4">続きを読む</h2>
            <div className="space-y-1">
              {continueReading.map((item) => (
                <Link
                  key={item.workId}
                  href={item.currentEpisode ? `/read/${item.currentEpisode.id}` : `/works/${item.workId}`}
                  className="group block"
                >
                  <div className="flex items-center gap-4 py-3 border-b border-border last:border-b-0 -mx-2 px-2 rounded hover:bg-secondary/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.work.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.work.author.displayName || item.work.author.name}
                        {item.currentEpisode && (
                          <span className="ml-2">
                            第{item.currentEpisode.orderIndex + 1}話
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.round(item.progressPct * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">
                        {Math.round(item.progressPct * 100)}%
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Following feed */}
        {isAuthenticated && <FollowingFeedSection />}

        {/* Mood Discovery */}
        <section>
          <h2 className="text-sm font-medium mb-6">今の気分で探す</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {MOOD_CARDS.map((card) => (
              <Link key={card.mood} href={`/discover/emotion/${card.mood}`}>
                <div className="border border-border rounded-lg px-4 py-3 text-center text-sm transition-all hover:bg-secondary hover:border-foreground/10 cursor-pointer">
                  {card.label}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Popular */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-medium">人気作品</h2>
            <Link href="/search?q=&sort=score" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              すべて見る →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <WorkCardSkeleton key={i} />)
              : data?.popular.slice(0, 6).map((work) => <WorkCard key={work.id} work={work} />)}
            {!loading && data?.popular.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-12 text-sm">
                まだ作品が投稿されていません
              </p>
            )}
          </div>
        </section>

        {/* Hidden Gems */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-medium">埋もれた名作</h2>
            <Link href="/search?q=" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              すべて見る →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <WorkCardSkeleton key={i} />)
              : data?.hiddenGems.slice(0, 6).map((work) => <WorkCard key={work.id} work={work} />)}
            {!loading && data?.hiddenGems.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-12 text-sm">
                まだデータがありません
              </p>
            )}
          </div>
        </section>

        {/* Recent */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-medium">新着</h2>
            <Link href="/search?q=&sort=newest" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              すべて見る →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <WorkCardSkeleton key={i} />)
              : data?.recent.slice(0, 6).map((work) => <WorkCard key={work.id} work={work} />)}
          </div>
        </section>

        {/* Tags */}
        {data?.trendingTags && data.trendingTags.length > 0 && (
          <section>
            <h2 className="text-sm font-medium mb-4">感情タグ</h2>
            <div className="flex flex-wrap gap-2">
              {data.trendingTags.map((tag) => (
                <Link key={tag.id} href={`/discover/emotion/${tag.name}`}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-secondary transition-colors">
                    {tag.nameJa} ({tag.count})
                  </Badge>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="border-t border-border pt-12 pb-4 text-center">
          <p className="font-serif text-lg mb-2">あなたの物語を届けよう</p>
          <p className="text-sm text-muted-foreground mb-6">
            AIが作品の品質を分析し、読者の感情変化を可視化します。
          </p>
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button variant="outline" className="gap-2">
                執筆をはじめる <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Link href="/register">
              <Button variant="outline" className="gap-2">
                始める <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}

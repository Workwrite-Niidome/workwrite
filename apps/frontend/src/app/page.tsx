'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, BookOpen, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { estimateReadingTime } from '@/lib/utils';
import { WorkCard, WorkCardSkeleton } from '@/components/work-card';
import { CharacterMatchCarousel } from '@/components/character-match-carousel';
import { api, type Work, type TopPageData, type ContinueReadingItem, type RecentEpisode } from '@/lib/api';

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
        <div className="mx-auto max-w-4xl px-4 md:px-6 py-12 sm:py-20 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6">Novel Platform</p>
          <h1 className="text-2xl sm:text-3xl font-serif font-normal leading-relaxed tracking-wide">
            読書で、変わる。
          </h1>
          <p className="mt-4 text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
            AIスコアリングと感情タグで、あなたの心に響く次の一冊を。
          </p>
          <div className="mt-8 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="flex gap-2 px-4 md:px-0 md:justify-center">
              {MOOD_CARDS.map((card) => (
                <Link key={card.mood} href={`/discover/emotion/${card.mood}`} className="shrink-0">
                  <div className="border border-border rounded-full px-4 py-2 text-center text-sm whitespace-nowrap transition-all hover:bg-secondary hover:border-foreground/10 cursor-pointer">
                    {card.label}
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-2">
            <Link href="/discover" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              すべての作品を探す →
            </Link>
          </div>
        </div>
      </section>

      <div className="px-4 md:px-6 py-12 space-y-16">
        {/* Following feed — top priority for returning users */}
        {isAuthenticated && <FollowingFeedSection />}

        {/* Popular */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-medium">人気作品</h2>
            <Link href="/search?sort=popular" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
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
            <Link href="/search?category=hidden-gems&sort=score" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
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
            <Link href="/search?sort=newest" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              すべて見る →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <WorkCardSkeleton key={i} />)
              : data?.recent.slice(0, 6).map((work) => <WorkCard key={work.id} work={work} />)}
          </div>
        </section>

        {/* Recent Episodes */}
        {data?.recentEpisodes && data.recentEpisodes.length > 0 && (
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-medium">新着エピソード</h2>
              <Link href="/discover/recent-episodes" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                すべて見る →
              </Link>
            </div>
            <div className="divide-y divide-border rounded-lg border">
              {data.recentEpisodes.slice(0, 10).map((ep) => (
                <Link
                  key={ep.id}
                  href={`/works/${ep.work.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{ep.work.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {ep.work.author.displayName || ep.work.author.name}
                      <span className="mx-1">·</span>
                      第{ep.orderIndex + 1}話「{ep.title}」更新
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(ep.publishedAt || ep.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Character Match — after novels, visually distinct */}
        <CharacterMatchCarousel limit={10} />

        {/* AI Generated Works */}
        <AiWorksSection />

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

function AiWorksSection() {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.searchWorks('', { aiGenerated: true } as any)
      .then((res: any) => {
        const hits = res?.data?.hits || res?.hits || [];
        setWorks(Array.isArray(hits) ? hits.slice(0, 6) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && works.length === 0) return null;

  return (
    <section>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-medium">AI作品</h2>
        <Link href="/search?category=ai" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          すべて見る →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <WorkCardSkeleton key={i} />)
          : works.map((work) => <WorkCard key={work.id} work={work} />)}
      </div>
    </section>
  );
}

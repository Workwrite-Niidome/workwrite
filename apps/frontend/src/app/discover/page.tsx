'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { api, type Work, type TopPageData } from '@/lib/api';
import { cn } from '@/lib/utils';
import { WorkCard, WorkCardSkeleton } from '@/components/work-card';
import { GENRE_LABELS } from '@/lib/constants';

const MOOD_CARDS = [
  { mood: 'courage', label: '勇気をもらいたい' },
  { mood: 'tears', label: '泣きたい' },
  { mood: 'healing', label: '癒されたい' },
  { mood: 'excitement', label: 'ドキドキしたい' },
  { mood: 'worldview', label: '世界観を広げたい' },
  { mood: 'laughter', label: '笑いたい' },
  { mood: 'awe', label: '畏怖を感じたい' },
  { mood: 'nostalgia', label: '懐かしさに浸りたい' },
  { mood: 'empathy', label: '共感したい' },
  { mood: 'mystery', label: '謎を解きたい' },
  { mood: 'growth', label: '成長を感じたい' },
  { mood: 'warmth', label: '温かさを感じたい' },
];

const GENRES = Object.keys(GENRE_LABELS);

export default function DiscoverPage() {
  const router = useRouter();
  const [data, setData] = useState<TopPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'works' | 'ai-works'>('works');
  const [aiWorks, setAiWorks] = useState<Work[]>([]);
  const [aiWorksLoading, setAiWorksLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
    <div className="px-4 md:px-6 py-8 space-y-12">
      {/* Header + Search */}
      <div>
        <h1 className="text-xl font-bold mb-1">作品を探す</h1>
        <p className="text-sm text-muted-foreground mb-6">
          気分やジャンルから、あなたにぴったりの一冊を見つけましょう
        </p>
        <form onSubmit={handleSearch} className="flex gap-2 max-w-lg">
          <div className="relative flex-1" ref={autocompleteRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => autocompleteResults.length > 0 && setShowAutocomplete(true)}
              placeholder="タイトル、著者、キャラクター名で検索..."
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

      {/* Tab Bar */}
      <div className="border-b border-border">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('works')}
            className={cn(
              'pb-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'works' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            作品
          </button>
          <button
            onClick={() => {
              setActiveTab('ai-works');
              if (aiWorks.length === 0 && !aiWorksLoading) {
                setAiWorksLoading(true);
                api.searchWorks('', { aiGenerated: true })
                  .then((res: any) => {
                    const hits = res?.data?.hits || res?.hits || [];
                    setAiWorks(Array.isArray(hits) ? hits : []);
                  })
                  .catch(() => {})
                  .finally(() => setAiWorksLoading(false));
              }
            }}
            className={cn(
              'pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1',
              activeTab === 'ai-works' ? 'border-indigo-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Bot className="h-3.5 w-3.5" /> AI作品
          </button>
        </div>
      </div>

      {activeTab === 'ai-works' && (
        <section>
          <h2 className="text-sm font-medium mb-4">AI生成作品</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiWorksLoading
              ? Array.from({ length: 6 }).map((_, i) => <WorkCardSkeleton key={i} />)
              : aiWorks.map((work) => <WorkCard key={work.id} work={work} />)}
            {!aiWorksLoading && aiWorks.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-12 text-sm">
                AI作品はまだありません
              </p>
            )}
          </div>
        </section>
      )}

      {activeTab === 'works' && <>
      {/* Trending Reactions */}
      <TrendingReactionsSection />

      {/* Mood Discovery */}
      <section>
        <h2 className="text-sm font-medium mb-4">今の気分で探す</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {MOOD_CARDS.map((card) => (
            <Link key={card.mood} href={`/discover/emotion/${card.mood}`}>
              <div className="border border-border rounded-lg px-4 py-3 text-center text-sm transition-all hover:bg-secondary hover:border-foreground/10 cursor-pointer">
                {card.label}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Genre Browse */}
      <section>
        <h2 className="text-sm font-medium mb-4">ジャンルで探す</h2>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <Link key={g} href={`/search?q=&genre=${g}`}>
              <Badge variant="outline" className="cursor-pointer hover:bg-secondary transition-colors px-3 py-1.5">
                {GENRE_LABELS[g]}
              </Badge>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-medium">人気作品</h2>
          <Link href="/search?q=&sort=score" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            すべて見る <ArrowRight className="h-3 w-3" />
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
          <Link href="/search?q=" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            すべて見る <ArrowRight className="h-3 w-3" />
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
          <Link href="/search?q=&sort=newest" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            すべて見る <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <WorkCardSkeleton key={i} />)
            : data?.recent.slice(0, 6).map((work) => <WorkCard key={work.id} work={work} />)}
        </div>
      </section>

      {/* Emotion Tags */}
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
      </>}
    </div>
  );
}

function TrendingReactionsSection() {
  const [trending, setTrending] = useState<{ work: { id: string; title: string; genre: string; author: { displayName: string | null; name: string } }; reactionCount: number; totalClaps: number }[]>([]);

  useEffect(() => {
    api.getTrendingReactions()
      .then((res) => setTrending(res.data || []))
      .catch(() => {});
  }, []);

  if (trending.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-medium mb-4">いま拍手が集まっている作品</h2>
      <div className="space-y-2">
        {trending.map((item) => (
          <Link key={item.work.id} href={`/works/${item.work.id}`} className="block group">
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:border-primary/20 hover:bg-muted/30 transition-all">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{item.work.title}</p>
                <p className="text-xs text-muted-foreground">{item.work.author.displayName || item.work.author.name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium">拍手 {item.totalClaps}</p>
                <p className="text-[10px] text-muted-foreground">直近24時間</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

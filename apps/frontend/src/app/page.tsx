'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { api, type Work, type TopPageData } from '@/lib/api';

const MOOD_CARDS = [
  { mood: 'courage', label: '勇気をもらいたい' },
  { mood: 'tears', label: '泣きたい' },
  { mood: 'healing', label: '癒されたい' },
  { mood: 'excitement', label: 'ドキドキしたい' },
  { mood: 'worldview', label: '世界観を広げたい' },
  { mood: 'laughter', label: '笑いたい' },
];

function WorkCard({ work }: { work: Work }) {
  return (
    <Link href={`/works/${work.id}`} className="group block">
      <article className="py-4 border-b border-border last:border-b-0 transition-colors group-hover:bg-secondary/30 -mx-2 px-2 rounded">
        <h3 className="font-medium text-sm leading-snug group-hover:text-foreground/80 transition-colors">
          {work.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {work.author.displayName || work.author.name}
        </p>
        {work.synopsis && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{work.synopsis}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          {work.genre && (
            <span className="text-[11px] text-muted-foreground">{work.genre}</span>
          )}
          {work.qualityScore && (
            <span className="text-[11px] text-muted-foreground">
              score {Math.round(work.qualityScore.overall)}
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}

function WorkCardSkeleton() {
  return (
    <div className="py-4 border-b border-border space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [data, setData] = useState<TopPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    api.getTopPage()
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Hero - like opening a book */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-2xl px-6 py-20 sm:py-28 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6">Novel Platform</p>
          <h1 className="text-2xl sm:text-3xl font-serif font-normal leading-relaxed tracking-wide">
            読書で、変わる。
          </h1>
          <p className="mt-4 text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
            AIスコアリングと感情タグで、<br className="sm:hidden" />
            あなたの心に響く次の一冊を。
          </p>
          <form onSubmit={handleSearch} className="mt-10 flex gap-2 max-w-sm mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="作品を検索"
                className="pl-9"
              />
            </div>
            <Button type="submit" aria-label="検索">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-6 py-12 space-y-16">
        {/* Mood Discovery - minimal, text-based */}
        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-6">今の気分で探す</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
          <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">人気作品</h2>
          <div>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <WorkCardSkeleton key={i} />)
              : data?.popular.slice(0, 5).map((work) => <WorkCard key={work.id} work={work} />)}
            {!loading && data?.popular.length === 0 && (
              <p className="text-center text-muted-foreground py-12 text-sm">
                まだ作品が投稿されていません
              </p>
            )}
          </div>
        </section>

        {/* Hidden Gems */}
        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">埋もれた名作</h2>
          <div>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <WorkCardSkeleton key={i} />)
              : data?.hiddenGems.slice(0, 5).map((work) => <WorkCard key={work.id} work={work} />)}
            {!loading && data?.hiddenGems.length === 0 && (
              <p className="text-center text-muted-foreground py-12 text-sm">
                まだデータがありません
              </p>
            )}
          </div>
        </section>

        {/* Recent */}
        <section>
          <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">新着</h2>
          <div>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <WorkCardSkeleton key={i} />)
              : data?.recent.slice(0, 5).map((work) => <WorkCard key={work.id} work={work} />)}
          </div>
        </section>

        {/* Tags */}
        {data?.trendingTags && data.trendingTags.length > 0 && (
          <section>
            <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-4">感情タグ</h2>
            <div className="flex flex-wrap gap-2">
              {data.trendingTags.map((tag) => (
                <Link key={tag.id} href={`/discover/emotion/${tag.name}`}>
                  <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer border-b border-transparent hover:border-foreground">
                    {tag.nameJa} ({tag.count})
                  </span>
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
          <Link href="/register">
            <Button variant="outline" className="gap-2">
              始める <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      </div>
    </div>
  );
}

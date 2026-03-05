'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Sparkles, Eye, TrendingUp, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { api, type Work, type TopPageData } from '@/lib/api';

const MOOD_CARDS = [
  { mood: 'courage', label: '勇気をもらいたい', emoji: '🔥', color: 'bg-orange-50 border-orange-200 hover:bg-orange-100' },
  { mood: 'tears', label: '泣きたい', emoji: '💧', color: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { mood: 'healing', label: '癒されたい', emoji: '🌿', color: 'bg-green-50 border-green-200 hover:bg-green-100' },
  { mood: 'excitement', label: 'ドキドキしたい', emoji: '💓', color: 'bg-pink-50 border-pink-200 hover:bg-pink-100' },
  { mood: 'worldview', label: '世界観を広げたい', emoji: '🌍', color: 'bg-purple-50 border-purple-200 hover:bg-purple-100' },
  { mood: 'laughter', label: '笑いたい', emoji: '😄', color: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' },
];

function WorkCard({ work }: { work: Work }) {
  return (
    <Link href={`/works/${work.id}`}>
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4 space-y-2">
          <h3 className="font-medium text-sm line-clamp-2">{work.title}</h3>
          <p className="text-xs text-muted-foreground">
            {work.author.displayName || work.author.name}
          </p>
          {work.synopsis && (
            <p className="text-xs text-muted-foreground line-clamp-2">{work.synopsis}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {work.genre && (
              <Badge variant="outline" className="text-xs">{work.genre}</Badge>
            )}
            {work.qualityScore && (
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-0.5" />
                {Math.round(work.qualityScore.overall)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function WorkCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-full" />
      </CardContent>
    </Card>
  );
}

export default function Home() {
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
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
    }
  }

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative bg-gradient-to-b from-primary/5 to-background py-16 px-4">
        <div className="mx-auto max-w-4xl text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Workwrite
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            読後の自己変容を設計する小説プラットフォーム
          </p>
          <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="作品を検索..."
              className="flex-1"
            />
            <Button type="submit" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-12">
        {/* Popular Works */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              今すぐ読める人気作
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <WorkCardSkeleton key={i} />)
              : data?.popular.map((work) => <WorkCard key={work.id} work={work} />)}
            {!loading && data?.popular.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-8">
                まだ作品が投稿されていません
              </p>
            )}
          </div>
        </section>

        {/* Mood-based Discovery */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            今の気分で探す
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {MOOD_CARDS.map((card) => (
              <Link key={card.mood} href={`/discover/emotion/${card.mood}`}>
                <div className={`rounded-lg border p-4 text-center transition-colors cursor-pointer ${card.color}`}>
                  <span className="text-2xl">{card.emoji}</span>
                  <p className="text-sm font-medium mt-2">{card.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Hidden Gems */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              埋もれた名作
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <WorkCardSkeleton key={i} />)
              : data?.hiddenGems.map((work) => <WorkCard key={work.id} work={work} />)}
            {!loading && data?.hiddenGems.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-8">
                まだデータがありません
              </p>
            )}
          </div>
        </section>

        {/* Recent Works */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              新着作品
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <WorkCardSkeleton key={i} />)
              : data?.recent.map((work) => <WorkCard key={work.id} work={work} />)}
          </div>
        </section>

        {/* Trending Emotion Tags */}
        {data?.trendingTags && data.trendingTags.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4">人気の感情タグ</h2>
            <div className="flex flex-wrap gap-2">
              {data.trendingTags.map((tag) => (
                <Link key={tag.id} href={`/discover/emotion/${tag.name}`}>
                  <Badge
                    variant="outline"
                    className="px-3 py-1.5 text-sm cursor-pointer hover:bg-primary/10 transition-colors"
                  >
                    {tag.nameJa}
                    <span className="ml-1 text-muted-foreground">({tag.count})</span>
                  </Badge>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

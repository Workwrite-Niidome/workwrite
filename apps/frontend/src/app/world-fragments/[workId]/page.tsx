'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  worldFragmentsApi,
  type WorldFragment,
  type WorldCanon,
  type WishType,
  type WishSeed,
  type FragmentListResponse,
} from '@/lib/world-fragments-api';

// ===== Constants =====

const WISH_TYPES: { value: WishType; label: string; description: string; cost: number }[] = [
  { value: 'PERSPECTIVE', label: '別の視点', description: '既存シーンを別のキャラクターの目から', cost: 15 },
  { value: 'SIDE_STORY', label: '裏側の物語', description: '本編の裏で起きていたこと', cost: 20 },
  { value: 'MOMENT', label: '描かれなかった一瞬', description: '本編から零れ落ちた一瞬', cost: 10 },
  { value: 'WHAT_IF', label: 'もしも', description: 'もし違う選択をしていたら', cost: 25 },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: '受付中', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  CHECKING: { label: '検証中', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  GENERATING: { label: '生成中', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  EVALUATING: { label: '評価中', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
  PUBLISHED: { label: '公開', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  REJECTED: { label: '却下', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  FAILED: { label: '失敗', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300' },
};

// ===== Page Component =====

export default function WorldFragmentsPage() {
  const params = useParams();
  const workId = params.workId as string;

  const [canon, setCanon] = useState<WorldCanon | null>(null);
  const [fragments, setFragments] = useState<WorldFragment[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [selectedFragment, setSelectedFragment] = useState<WorldFragment | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wish form
  const [wish, setWish] = useState('');
  const [wishType, setWishType] = useState<WishType>('MOMENT');
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest');
  const [filterType, setFilterType] = useState<WishType | ''>('');

  // Wish seeds
  const [wishSeeds, setWishSeeds] = useState<WishSeed[]>([]);
  const [seedsLoading, setSeedsLoading] = useState(false);

  // Load canon & fragments
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [canonData, fragmentsData, seedsData] = await Promise.all([
        worldFragmentsApi.getCanon(workId).catch(() => null),
        worldFragmentsApi.listFragments(workId, {
          sort: sortBy,
          wishType: filterType || undefined,
        }),
        worldFragmentsApi.getWishSeeds(workId).catch(() => ({ seeds: [] })),
      ]);

      setCanon(canonData);
      setFragments(fragmentsData.fragments);
      setPagination(fragmentsData.pagination);
      if (seedsData.seeds.length > 0) setWishSeeds(seedsData.seeds);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [workId, sortBy, filterType]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reload wish seeds
  const handleReloadSeeds = async () => {
    setSeedsLoading(true);
    try {
      const data = await worldFragmentsApi.getWishSeeds(workId);
      setWishSeeds(data.seeds);
    } catch {}
    setSeedsLoading(false);
  };

  // Select a wish seed
  const handleSelectSeed = (seed: WishSeed) => {
    setWish(seed.wish);
    setWishType(seed.wishType);
  };

  // Generate fragment
  const handleGenerateFragment = async () => {
    if (!wish.trim() || !canon) return;

    try {
      setGenerating(true);
      setError(null);

      const fragment = await worldFragmentsApi.createWish(
        workId,
        wish.trim(),
        wishType,
        canon.upToEpisode,
      );

      if (fragment.status === 'REJECTED') {
        setError(`願いは叶えられませんでした: ${fragment.rejectionReason}`);
      } else {
        setWish('');
        setSelectedFragment(fragment);
        await loadData();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  // Toggle applause
  const handleApplause = async (fragmentId: string) => {
    try {
      await worldFragmentsApi.toggleApplause(fragmentId);
      await loadData();
    } catch {}
  };

  // Toggle bookmark
  const handleBookmark = async (fragmentId: string) => {
    try {
      await worldFragmentsApi.toggleBookmark(fragmentId);
      await loadData();
    } catch {}
  };

  // Delete fragment
  const handleDeleteFragment = async (fragmentId: string) => {
    try {
      await worldFragmentsApi.deleteFragment(fragmentId);
      setSelectedFragment(null);
      await loadData();
    } catch {}
  };

  // View fragment detail
  const handleViewFragment = async (fragmentId: string) => {
    try {
      const fragment = await worldFragmentsApi.getFragment(fragmentId);
      setSelectedFragment(fragment);
    } catch {}
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <header className="space-y-2">
          <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground/60">
            World Fragments
          </p>
          <h1 className="text-2xl font-serif font-medium tracking-tight">
            世界の断片
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            この世界に、あなたの「もしも」を願ってください。
            原作の世界を壊すことなく、見えなかった断片が生まれます。
          </p>
          {canon && (
            <p className="text-xs text-muted-foreground">
              Canon v{canon.canonVersion} / 第{canon.upToEpisode}話まで分析済み
            </p>
          )}
        </header>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Wish Input */}
        {canon ? (
          <Card className="border-dashed border-primary/20 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-serif">願いを紡ぐ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Wish Type Selector */}
              <div className="grid grid-cols-2 gap-2">
                {WISH_TYPES.map((wt) => (
                  <button
                    key={wt.value}
                    onClick={() => setWishType(wt.value)}
                    className={`rounded-lg border p-3 text-left transition-all ${
                      wishType === wt.value
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/30 hover:bg-secondary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{wt.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{wt.cost}cr</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{wt.description}</p>
                  </button>
                ))}
              </div>

              {/* Wish Seeds */}
              {wishSeeds.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">この作品の願いの種</p>
                    <button
                      onClick={handleReloadSeeds}
                      disabled={seedsLoading}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {seedsLoading ? '...' : '別の種を見る'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {wishSeeds.map((seed, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectSeed(seed)}
                        className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary/30 hover:bg-secondary/50 transition-all text-left"
                      >
                        {seed.wish}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Wish Text */}
              <textarea
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                placeholder="願いの種を選ぶか、自由に願いを書いてください"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none resize-none"
                rows={3}
              />

              {/* Generate Button */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {WISH_TYPES.find((wt) => wt.value === wishType)?.cost ?? 0} クレジット消費
                </p>
                <Button
                  onClick={handleGenerateFragment}
                  disabled={!wish.trim() || generating}
                  className="font-serif"
                >
                  {generating ? '紡いでいます...' : '断片を願う'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              この作品のWorldCanonはまだ構築されていません。
            </CardContent>
          </Card>
        )}

        {/* Fragment Detail Modal (inline) */}
        {selectedFragment && selectedFragment.content && (
          <Card className="border-primary/20 shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Badge variant="outline" className="font-normal text-xs">
                    {WISH_TYPES.find((wt) => wt.value === selectedFragment.wishType)?.label}
                  </Badge>
                  <p className="text-sm text-muted-foreground italic">
                    &ldquo;{selectedFragment.wish}&rdquo;
                  </p>
                </div>
                <button
                  onClick={() => setSelectedFragment(null)}
                  className="text-muted-foreground hover:text-foreground text-lg"
                >
                  &times;
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Generated Content */}
              <div className="font-serif text-sm leading-[2] tracking-wide whitespace-pre-wrap border-l-2 border-primary/10 pl-4">
                {selectedFragment.content}
              </div>

              {/* Meta & Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {selectedFragment.contentMeta && (
                    <>
                      <span>{selectedFragment.contentMeta.wordCount.toLocaleString()}字</span>
                      <span>約{selectedFragment.contentMeta.estimatedReadTime}分</span>
                    </>
                  )}
                  <span>{selectedFragment.viewCount} views</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleApplause(selectedFragment.id)}
                    className={selectedFragment.hasApplauded ? 'text-primary' : ''}
                  >
                    {selectedFragment.applauseCount}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBookmark(selectedFragment.id)}
                    className={selectedFragment.hasBookmarked ? 'text-primary' : ''}
                  >
                    {selectedFragment.hasBookmarked ? 'Saved' : 'Save'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('この断片を削除しますか？')) {
                        handleDeleteFragment(selectedFragment.id);
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    削除
                  </Button>
                </div>
              </div>

              {/* Quality Score */}
              {selectedFragment.qualityScore && (
                <div className="grid grid-cols-4 gap-2 text-xs text-center">
                  {[
                    { key: 'characterConsistency', label: 'Character' },
                    { key: 'worldCoherence', label: 'World' },
                    { key: 'literaryQuality', label: 'Literary' },
                    { key: 'wishFulfillment', label: 'Wish' },
                  ].map(({ key, label }) => (
                    <div key={key} className="rounded-md bg-secondary/50 p-2">
                      <div className="font-medium text-foreground">
                        {(selectedFragment.qualityScore as any)?.[key] ?? '-'}
                      </div>
                      <div className="text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Fragment List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-serif font-medium">生まれた断片たち</h2>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setSortBy('latest')}
                className={`px-2 py-1 rounded ${sortBy === 'latest' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                新しい順
              </button>
              <button
                onClick={() => setSortBy('popular')}
                className={`px-2 py-1 rounded ${sortBy === 'popular' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                人気順
              </button>
            </div>
          </div>

          {/* Type Filter */}
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={filterType === '' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilterType('')}
            >
              すべて
            </Badge>
            {WISH_TYPES.map((wt) => (
              <Badge
                key={wt.value}
                variant={filterType === wt.value ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setFilterType(wt.value)}
              >
                {wt.label}
              </Badge>
            ))}
          </div>

          {/* Fragment Cards */}
          {fragments.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <p className="font-serif text-base mb-2">まだ断片はありません</p>
              <p>最初の「もしも」を願ってみてください。</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fragments.map((fragment) => (
                <FragmentCard
                  key={fragment.id}
                  fragment={fragment}
                  onView={() => handleViewFragment(fragment.id)}
                  onApplause={() => handleApplause(fragment.id)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              {Array.from({ length: pagination.totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    worldFragmentsApi
                      .listFragments(workId, { page: i + 1, sort: sortBy, wishType: filterType || undefined })
                      .then((data) => {
                        setFragments(data.fragments);
                        setPagination(data.pagination);
                      });
                  }}
                  className={`w-8 h-8 rounded text-xs ${
                    pagination.page === i + 1
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground/40 py-8 border-t border-border/30">
          <p>World Fragments — 一つの小説が、一つの世界になる</p>
        </footer>
      </div>
    </div>
  );
}

// ===== Fragment Card Component =====

function FragmentCard({
  fragment,
  onView,
  onApplause,
}: {
  fragment: WorldFragment;
  onView: () => void;
  onApplause: () => void;
}) {
  const wishTypeInfo = WISH_TYPES.find((wt) => wt.value === fragment.wishType);
  const statusInfo = STATUS_LABELS[fragment.status] || { label: fragment.status, color: '' };

  return (
    <Card
      className="hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group"
      onClick={onView}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-normal text-xs">
              {wishTypeInfo?.label ?? fragment.wishType}
            </Badge>
            {fragment.status !== 'PUBLISHED' && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {new Date(fragment.createdAt).toLocaleDateString('ja-JP')}
          </span>
        </div>

        <p className="text-sm italic text-muted-foreground">
          &ldquo;{fragment.wish}&rdquo;
        </p>

        {fragment.content && (
          <p className="text-sm font-serif leading-relaxed line-clamp-3 text-foreground/80 group-hover:text-foreground transition-colors">
            {fragment.content}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {fragment.contentMeta && (
              <span>{fragment.contentMeta.wordCount.toLocaleString()}字</span>
            )}
            <span>{fragment.viewCount} views</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApplause();
            }}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {fragment.applauseCount > 0 && fragment.applauseCount}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

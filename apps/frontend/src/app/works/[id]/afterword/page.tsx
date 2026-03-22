'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star, ChevronDown, BookOpen, Sparkles, Mail, PenLine, Share2, Hand, Droplets, Heart, Zap, Flame, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { InsightCard } from '@/components/ai/insight-card';
import { RecommendationCard } from '@/components/ai/recommendation-card';
import { api, type Work, type EmotionTag, type AiInsightData, type AiRecommendation } from '@/lib/api';

const EMOTIONS = [
  { icon: Droplets, label: '泣いた', value: 'moved' },
  { icon: Heart, label: '温かい', value: 'warm' },
  { icon: Zap, label: '驚いた', value: 'surprised' },
  { icon: Flame, label: '燃えた', value: 'fired_up' },
  { icon: Brain, label: '深い', value: 'thoughtful' },
];

const STATE_AXES = [
  { axis: 'confidence', label: '自信' },
  { axis: 'worldview', label: '世界観' },
  { axis: 'empathy', label: '共感力' },
  { axis: 'motivation', label: 'モチベーション' },
];

export default function AfterwordPage() {
  const params = useParams();
  const workId = params.id as string;
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [work, setWork] = useState<Work | null>(null);
  const [loading, setLoading] = useState(true);

  // Main actions
  const [claps, setClaps] = useState(0);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [reactionSent, setReactionSent] = useState(false);
  const [comment, setComment] = useState('');

  // Expandable sections
  const [showDetailedEmotions, setShowDetailedEmotions] = useState(false);
  const [showStateChange, setShowStateChange] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // Detailed emotion tags
  const [allEmotionTags, setAllEmotionTags] = useState<EmotionTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagIntensities, setTagIntensities] = useState<Record<string, number>>({});

  // State change
  const [stateChanges, setStateChanges] = useState<Record<string, { before: number; after: number }>>(
    Object.fromEntries(STATE_AXES.map((a) => [a.axis, { before: 5, after: 5 }])),
  );

  // AI Insights
  const [insights, setInsights] = useState<AiInsightData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Review
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Recommendations
  const [recs, setRecs] = useState<AiRecommendation[]>([]);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return; }
    Promise.all([
      api.getWork(workId),
      api.getEmotionTags(),
    ]).then(([workRes, tagsRes]) => {
      setWork(workRes.data);
      setAllEmotionTags(tagsRes.data);
    }).catch(() => router.push('/'))
      .finally(() => setLoading(false));

    // Pre-load recommendations
    api.getAiRecommendationsBecauseYouRead(workId)
      .then((res) => setRecs(res.data || []))
      .catch(() => {});
  }, [workId, isAuthenticated, router]);

  function handleClap() {
    const newClaps = Math.min(claps + 1, 5);
    setClaps(newClaps);
  }

  async function sendReaction() {
    if (claps === 0) return;
    // Save as reaction on the last episode
    try {
      const workData = await api.getWork(workId);
      const episodes = workData.data?.episodes;
      if (episodes && episodes.length > 0) {
        const lastEp = episodes.sort((a: any, b: any) => b.orderIndex - a.orderIndex)[0];
        await api.sendReaction(lastEp.id, { claps, emotion: selectedEmotion || undefined });
      }
    } catch { /* ignore */ }
    setReactionSent(true);
  }

  // Auto-send reaction when claps change
  useEffect(() => {
    if (claps > 0) {
      const timer = setTimeout(() => sendReaction(), 1500);
      return () => clearTimeout(timer);
    }
  }, [claps, selectedEmotion]);

  async function handleSubmitEmotionTags() {
    if (selectedTags.length > 0) {
      await api.addEmotionTags(workId, selectedTags.map((tagId) => ({ tagId, intensity: tagIntensities[tagId] || 3 }))).catch(() => {});
    }
  }

  async function handleSubmitStateChanges() {
    const changes = STATE_AXES
      .filter((a) => stateChanges[a.axis].before !== stateChanges[a.axis].after)
      .map((a) => ({ axis: a.axis, ...stateChanges[a.axis] }));
    if (changes.length > 0) {
      await api.saveStateChanges(workId, changes).catch(() => {});
    }
  }

  function handleLoadInsights() {
    setShowInsights(true);
    if (!insights && !insightsLoading) {
      setInsightsLoading(true);
      api.getAiInsights(workId)
        .then((res) => setInsights(res.data))
        .catch(() => {})
        .finally(() => setInsightsLoading(false));
    }
  }

  async function handleSubmitReview() {
    if (reviewText.trim()) {
      await api.createReview({ workId, content: reviewText }).catch(() => {});
      setReviewSubmitted(true);
    }
  }

  function handleShare() {
    const text = `「${work?.title}」を読了しました！\n${selectedEmotion ? EMOTIONS.find(e => e.value === selectedEmotion)?.label + '。' : ''}\n#Workwrite #読書`;
    const url = `${window.location.origin}/works/${workId}`;
    const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text + '\n' + url)}`;
    window.open(shareUrl, '_blank', 'width=550,height=420');
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Skeleton className="h-40 w-80" /></div>;
  if (!work) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="max-w-lg mx-auto px-4 py-16 space-y-8">

        {/* Afterglow */}
        <div className="text-center space-y-4 animate-in fade-in duration-1000">
          <Star className="h-10 w-10 mx-auto text-primary/60" />
          <h1 className="text-2xl font-serif font-bold">{work.title}</h1>
          <p className="text-muted-foreground">読了おめでとうございます</p>
        </div>

        {/* Main Action: Clap + Emotion */}
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
          <p className="text-sm text-muted-foreground">この作品はどうでしたか？</p>
          <button
            onClick={handleClap}
            disabled={claps >= 5}
            className={cn(
              'h-16 w-16 rounded-full border-2 flex items-center justify-center transition-all mx-auto',
              claps > 0 ? 'border-primary bg-primary/10 scale-110' : 'border-border hover:border-primary hover:bg-primary/5',
            )}
          >
            <Hand className={cn('h-7 w-7', claps > 0 ? 'text-primary' : 'text-muted-foreground')} />
          </button>
          <p className={cn('text-xs', claps > 0 ? 'text-primary font-medium' : 'text-muted-foreground')}>
            {claps > 0 ? `${claps}/5 拍手` : '拍手する'}
          </p>

          {claps > 0 && (
            <div className="flex justify-center gap-2 flex-wrap animate-in fade-in duration-300">
              {EMOTIONS.map((e) => (
                <button
                  key={e.value}
                  onClick={() => setSelectedEmotion(selectedEmotion === e.value ? null : e.value)}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs transition-all',
                    selectedEmotion === e.value
                      ? 'border-primary bg-primary/15 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <e.icon className="h-3 w-3" />
                  {e.label}
                </button>
              ))}
            </div>
          )}

          {reactionSent && <p className="text-[11px] text-muted-foreground">作者に届きました</p>}
        </div>

        {/* Comment + Action buttons */}
        <div className="space-y-3 animate-in fade-in duration-500 delay-700">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="一言感想（任意）"
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1.5" onClick={handleShare}>
              <Share2 className="h-3.5 w-3.5" /> シェア
            </Button>
            <Link href={`/read/${work.episodes?.sort((a: any, b: any) => b.orderIndex - a.orderIndex)[0]?.id}#letter`} className="flex-1">
              <Button variant="outline" className="w-full gap-1.5">
                <Mail className="h-3.5 w-3.5" /> レターを送る
              </Button>
            </Link>
          </div>

          {/* Review with Cr incentive */}
          {!reviewSubmitted ? (
            <div className="space-y-2">
              <button
                onClick={() => setShowReview(!showReview)}
                className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <span className="flex items-center gap-1.5"><PenLine className="h-3.5 w-3.5" /> レビューを書く</span>
                <span className="text-xs text-primary">5Cr</span>
              </button>
              {showReview && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <Textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    rows={4}
                    placeholder="この作品について思ったことを自由に書いてください..."
                    className="text-sm font-serif"
                  />
                  <Button onClick={handleSubmitReview} disabled={reviewText.length < 20} className="w-full">
                    {reviewText.length < 20 ? `あと${20 - reviewText.length}文字` : 'レビューを投稿して5Cr獲得'}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-center text-primary">レビューを投稿しました（5Cr獲得）</p>
          )}
        </div>

        {/* Expandable optional sections */}
        <div className="space-y-1 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground mb-2">もっと記録する（任意）</p>

          {/* Detailed emotion tags */}
          <button
            onClick={() => setShowDetailedEmotions(!showDetailedEmotions)}
            className="w-full flex items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            感情タグを詳細に記録する
            <ChevronDown className={cn('h-4 w-4 transition-transform', showDetailedEmotions && 'rotate-180')} />
          </button>
          {showDetailedEmotions && (
            <div className="pb-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex flex-wrap gap-2">
                {allEmotionTags.map((tag) => (
                  <div key={tag.id} className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => setSelectedTags((prev) => prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id])}
                      className={cn('px-3 py-1.5 rounded-full text-xs transition-all', selectedTags.includes(tag.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80')}
                    >
                      {tag.nameJa}
                    </button>
                    {selectedTags.includes(tag.id) && (
                      <input type="range" min={1} max={5} value={tagIntensities[tag.id] || 3}
                        onChange={(e) => setTagIntensities((prev) => ({ ...prev, [tag.id]: Number(e.target.value) }))}
                        className="w-14 accent-primary" />
                    )}
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={handleSubmitEmotionTags}>保存</Button>
            </div>
          )}

          {/* State change */}
          <button
            onClick={() => setShowStateChange(!showStateChange)}
            className="w-full flex items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            読書前後の自分の変化を記録する
            <ChevronDown className={cn('h-4 w-4 transition-transform', showStateChange && 'rotate-180')} />
          </button>
          {showStateChange && (
            <div className="pb-4 space-y-4 animate-in fade-in duration-200">
              {STATE_AXES.map(({ axis, label }) => (
                <div key={axis} className="space-y-1">
                  <div className="flex justify-between text-xs"><span>{label}</span><span>{stateChanges[axis].before} → {stateChanges[axis].after}</span></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[10px] text-muted-foreground">読む前</label>
                      <input type="range" min={1} max={10} value={stateChanges[axis].before} onChange={(e) => setStateChanges((prev) => ({ ...prev, [axis]: { ...prev[axis], before: Number(e.target.value) } }))} className="w-full accent-primary" /></div>
                    <div><label className="text-[10px] text-muted-foreground">読んだ後</label>
                      <input type="range" min={1} max={10} value={stateChanges[axis].after} onChange={(e) => setStateChanges((prev) => ({ ...prev, [axis]: { ...prev[axis], after: Number(e.target.value) } }))} className="w-full accent-primary" /></div>
                  </div>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={handleSubmitStateChanges}>保存</Button>
            </div>
          )}

          {/* AI Insights */}
          <button
            onClick={handleLoadInsights}
            className="w-full flex items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> AIインサイトを見る</span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', showInsights && 'rotate-180')} />
          </button>
          {showInsights && (
            <div className="pb-4 space-y-3 animate-in fade-in duration-200">
              {insightsLoading ? (
                <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
              ) : insights ? (
                <>
                  {insights.themes.length > 0 && (
                    <InsightCard title="テーマ" defaultOpen>
                      <ul className="space-y-1">{insights.themes.map((t, i) => <li key={i}><span className="font-medium">{t.name}</span> - {t.explanation}</li>)}</ul>
                    </InsightCard>
                  )}
                  {insights.emotionalJourney && <InsightCard title="感情の旅路"><p>{insights.emotionalJourney}</p></InsightCard>}
                  {insights.characterInsights.length > 0 && (
                    <InsightCard title="キャラクター分析">
                      <ul className="space-y-1">{insights.characterInsights.map((c, i) => <li key={i}><span className="font-medium">{c.name}</span> - {c.arc}</li>)}</ul>
                    </InsightCard>
                  )}
                </>
              ) : <p className="text-xs text-muted-foreground text-center py-4">AI分析を取得できませんでした</p>}
            </div>
          )}
        </div>

        {/* Recommendations */}
        {recs.length > 0 && (
          <div className="space-y-3 border-t border-border pt-6">
            <h2 className="text-sm font-medium">この作品が好きなら</h2>
            <div className="space-y-2">
              {recs.slice(0, 3).map((rec, i) => (
                <RecommendationCard key={i} rec={rec} />
              ))}
            </div>
          </div>
        )}

        {/* Back to bookshelf */}
        <div className="text-center pt-4">
          <Link href="/bookshelf">
            <Button variant="ghost" className="text-muted-foreground">
              本棚へ戻る
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

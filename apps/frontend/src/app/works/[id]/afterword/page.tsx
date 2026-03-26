'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Star, ChevronDown, Sparkles, Mail, PenLine, Share2, Hand,
  Droplets, Heart, Zap, Flame, Brain, Check, BookOpen, ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { InsightCard } from '@/components/ai/insight-card';
import { RecommendationCard } from '@/components/ai/recommendation-card';
import { LetterComposeDialog } from '@/components/reader/letter-compose-dialog';
import { api, type Work, type EmotionTag, type AiInsightData, type AiRecommendation } from '@/lib/api';

const EMOTIONS = [
  { icon: Droplets, label: '泣いた', value: 'moved' },
  { icon: Heart, label: '温かい', value: 'warm' },
  { icon: Zap, label: '驚いた', value: 'surprised' },
  { icon: Flame, label: '燃えた', value: 'fired_up' },
  { icon: Brain, label: '深い', value: 'thoughtful' },
];


// ワンタップひとことタグ（感情タグ + インパクトタグを統合）
const QUICK_TAGS = [
  { id: '_recommend', label: '誰かに勧めたい' },
  { id: '_reread', label: 'もう一度読みたい' },
  { id: '_lifechanging', label: '人生観が変わった' },
  { id: '_perspective', label: '考え方が変わった' },
  { id: '_motivated', label: 'やる気が出た' },
  { id: '_cried', label: '泣いた' },
  { id: '_stayed_up', label: '夜更かしした' },
  { id: '_told_someone', label: '人に話したくなった' },
];

export default function AfterwordPage() {
  const params = useParams();
  const workId = params.id as string;
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [work, setWork] = useState<Work | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastEpisodeId, setLastEpisodeId] = useState<string | null>(null);

  // Reaction
  const [claps, setClaps] = useState(0);
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [reactionSent, setReactionSent] = useState(false);
  const [reactionLoaded, setReactionLoaded] = useState(false);
  const [sendingReaction, setSendingReaction] = useState(false);

  // Expandable sections
  const [showTags, setShowTags] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // Unified tags (API emotion tags + built-in quick tags)
  const [allEmotionTags, setAllEmotionTags] = useState<EmotionTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsSaved, setTagsSaved] = useState(false);

  // AI Insights
  const [insights, setInsights] = useState<AiInsightData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Review
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Recommendations
  const [recs, setRecs] = useState<AiRecommendation[]>([]);

  // Letter dialog
  const [letterOpen, setLetterOpen] = useState(false);

  // Load work + emotion tags + existing reaction
  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return; }

    api.getWork(workId).then((workRes) => {
      const w = workRes.data;
      setWork(w);

      // Find last episode
      const episodes = w?.episodes;
      if (episodes && episodes.length > 0) {
        const lastEp = [...episodes].sort((a: any, b: any) => b.orderIndex - a.orderIndex)[0];
        setLastEpisodeId(lastEp.id);

        // Load existing reaction for last episode
        api.getEpisodeReactions(lastEp.id).then((res) => {
          const data = res.data;
          if (data.myReaction) {
            setClaps(data.myReaction.claps);
            setSelectedEmotion(data.myReaction.emotion);
            setReactionSent(true);
          }
          setReactionLoaded(true);
        }).catch(() => setReactionLoaded(true));
      } else {
        setReactionLoaded(true);
      }
    }).catch(() => router.push('/'))
      .finally(() => setLoading(false));

    api.getEmotionTags().then((res) => setAllEmotionTags(res.data)).catch(() => {});
    api.getAiRecommendationsBecauseYouRead(workId)
      .then((res) => setRecs(res.data || []))
      .catch(() => {});
  }, [workId, isAuthenticated, router]);

  // Explicit reaction send (no more auto-send)
  const handleSendReaction = useCallback(async () => {
    if (claps === 0 || !lastEpisodeId) return;
    setSendingReaction(true);
    try {
      await api.sendReaction(lastEpisodeId, { claps, emotion: selectedEmotion || undefined });
      setReactionSent(true);
    } catch { /* ignore */ }
    setSendingReaction(false);
  }, [claps, selectedEmotion, lastEpisodeId]);

  function handleClap() {
    const newClaps = Math.min(claps + 1, 5);
    setClaps(newClaps);
    setReactionSent(false); // Mark as unsaved
  }

  function handleEmotion(value: string) {
    setSelectedEmotion(selectedEmotion === value ? null : value);
    setReactionSent(false);
  }

  async function handleSubmitTags() {
    // Send API emotion tags (filter out built-in quick tags starting with _)
    const emotionTagIds = selectedTags.filter((id) => !id.startsWith('_'));
    const quickTagIds = selectedTags.filter((id) => id.startsWith('_'));

    try {
      if (emotionTagIds.length > 0) {
        await api.addEmotionTags(workId, emotionTagIds.map((tagId) => ({ tagId, intensity: 3 })));
      }
      // Save quick tags as state changes (map to axes for backend compatibility)
      const stateChanges = quickTagIds.map((id) => ({
        axis: id.replace('_', ''),
        before: 5,
        after: 8,
      }));
      if (stateChanges.length > 0) {
        await api.saveStateChanges(workId, stateChanges);
      }
      setTagsSaved(true);
      setTimeout(() => setTagsSaved(false), 3000);
    } catch { /* ignore */ }
  }

  function handleLoadInsights() {
    setShowInsights(!showInsights);
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

  const hasUnsavedReaction = claps > 0 && !reactionSent;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="max-w-lg mx-auto px-4 py-16 space-y-8">

        {/* Afterglow header */}
        <div className="text-center space-y-4 animate-in fade-in duration-1000">
          <Star className="h-10 w-10 mx-auto text-primary/60" />
          <h1 className="text-2xl font-serif font-bold">{work.title}</h1>
          <p className="text-muted-foreground">読了おめでとうございます</p>
        </div>

        {/* Clap + Emotion */}
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">この作品はどうでしたか？</p>
            <p className="text-[11px] text-muted-foreground/70">タップで拍手を送れます（最大5回）。回数が気持ちの大きさになります</p>
          </div>

          {/* Clap button */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleClap}
              disabled={claps >= 5}
              className={cn(
                'h-16 w-16 rounded-full border-2 flex items-center justify-center transition-all mx-auto',
                claps > 0 ? 'border-primary bg-primary/10 scale-110' : 'border-border hover:border-primary hover:bg-primary/5',
                claps >= 5 && 'opacity-60',
              )}
            >
              <Hand className={cn('h-7 w-7', claps > 0 ? 'text-primary' : 'text-muted-foreground')} />
            </button>
            <span className={cn('text-xs', claps > 0 ? 'text-primary font-medium' : 'text-muted-foreground')}>
              {claps === 0 && '拍手する'}
              {claps === 1 && '1/5 ありがとう！'}
              {claps === 2 && '2/5 面白かった！'}
              {claps === 3 && '3/5 すごく良い！'}
              {claps === 4 && '4/5 最高！'}
              {claps === 5 && '5/5 感動した！'}
            </span>
          </div>

          {/* Emotion selection (show after first clap) */}
          {claps > 0 && (
            <div className="space-y-3 animate-in fade-in duration-300">
              <p className="text-xs text-muted-foreground">どんな気持ちでしたか？（任意）</p>
              <div className="flex justify-center gap-2 flex-wrap">
                {EMOTIONS.map((e) => (
                  <button
                    key={e.value}
                    onClick={() => handleEmotion(e.value)}
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
            </div>
          )}

          {/* Explicit send button */}
          {claps > 0 && (
            <div className="pt-1">
              {hasUnsavedReaction ? (
                <Button
                  size="sm"
                  onClick={handleSendReaction}
                  disabled={sendingReaction}
                  className="gap-1.5"
                >
                  {sendingReaction ? '送信中...' : '作者に届ける'}
                </Button>
              ) : (
                <p className="text-[11px] text-primary flex items-center justify-center gap-1">
                  <Check className="h-3 w-3" /> 作者に届きました
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action buttons: Share + Letter */}
        <div className="flex gap-2 animate-in fade-in duration-500 delay-500">
          <Button variant="outline" className="flex-1 gap-1.5" onClick={handleShare}>
            <Share2 className="h-3.5 w-3.5" /> シェア
          </Button>
          <Button variant="outline" className="flex-1 gap-1.5" onClick={() => setLetterOpen(true)}>
            <Mail className="h-3.5 w-3.5" /> ギフトレターを送る
          </Button>
        </div>

        {/* Letter compose dialog (opens in-place, no navigation) */}
        {lastEpisodeId && (
          <LetterComposeDialog
            open={letterOpen}
            onOpenChange={setLetterOpen}
            episodeId={lastEpisodeId}
            onSent={() => setLetterOpen(false)}
          />
        )}

        {/* Review with Cr incentive */}
        {!reviewSubmitted ? (
          <div className="space-y-2">
            <button
              onClick={() => setShowReview(!showReview)}
              className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <span className="flex items-center gap-1.5"><PenLine className="h-3.5 w-3.5" /> レビューを書く</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-primary">5Cr</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', showReview && 'rotate-180')} />
              </span>
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
          <p className="text-xs text-center text-primary flex items-center justify-center gap-1">
            <Check className="h-3 w-3" /> レビューを投稿しました（5Cr獲得）
          </p>
        )}

        {/* Expandable optional sections */}
        <div className="space-y-1 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground mb-2">もっと記録する（任意）</p>

          {/* Unified tags: quick tags + API emotion tags */}
          <button
            onClick={() => setShowTags(!showTags)}
            className="w-full flex items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            この作品にタグをつける
            <ChevronDown className={cn('h-4 w-4 transition-transform', showTags && 'rotate-180')} />
          </button>
          {showTags && (
            <div className="pb-4 space-y-3 animate-in fade-in duration-200">
              <p className="text-[11px] text-muted-foreground">当てはまるものをタップ（いくつでも）</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedTags((prev) => prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id])}
                    className={cn('px-3 py-1.5 rounded-full text-xs transition-all', selectedTags.includes(tag.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80')}
                  >
                    {tag.label}
                  </button>
                ))}
                {allEmotionTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedTags((prev) => prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id])}
                    className={cn('px-3 py-1.5 rounded-full text-xs transition-all', selectedTags.includes(tag.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-muted/80')}
                  >
                    {tag.nameJa}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleSubmitTags} disabled={selectedTags.length === 0}>
                  保存
                </Button>
                {tagsSaved && (
                  <span className="text-xs text-primary flex items-center gap-1 animate-in fade-in duration-200">
                    <Check className="h-3 w-3" /> 保存しました
                  </span>
                )}
              </div>
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

        {/* Navigation — both work page and bookshelf */}
        <div className="flex justify-center gap-3 pt-4">
          <Link href={`/works/${workId}`}>
            <Button variant="outline" className="gap-1.5 text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" /> 作品ページ
            </Button>
          </Link>
          <Link href="/bookshelf">
            <Button variant="ghost" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> 本棚へ戻る
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

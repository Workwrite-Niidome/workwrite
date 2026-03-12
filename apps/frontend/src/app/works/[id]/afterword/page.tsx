'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star, ChevronRight, BookOpen, Sparkles } from 'lucide-react';
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

type Step = 'afterglow' | 'emotions' | 'stateChange' | 'insights' | 'nextBook' | 'review';

const STATE_AXES = [
  { axis: 'confidence', label: '自信' },
  { axis: 'worldview', label: '世界観' },
  { axis: 'empathy', label: '共感力' },
  { axis: 'motivation', label: 'モチベーション' },
];

const REVIEW_GUIDES = [
  'この作品を読んで、あなたの中で変わったことは何ですか？',
  'もっとも心に残ったシーンは？',
  '読む前の自分に伝えたい一言は？',
];

export default function AfterwordPage() {
  const params = useParams();
  const workId = params.id as string;
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [step, setStep] = useState<Step>('afterglow');
  const [work, setWork] = useState<Work | null>(null);
  const [allEmotionTags, setAllEmotionTags] = useState<EmotionTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [stateChanges, setStateChanges] = useState<Record<string, { before: number; after: number }>>(
    Object.fromEntries(STATE_AXES.map((a) => [a.axis, { before: 5, after: 5 }])),
  );
  const [nextBooks, setNextBooks] = useState<Work[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<AiRecommendation[]>([]);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<AiInsightData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [tagIntensities, setTagIntensities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    Promise.all([
      api.getWork(workId),
      api.getEmotionTags(),
    ]).then(([workRes, tagsRes]) => {
      setWork(workRes.data);
      setAllEmotionTags(tagsRes.data);
    }).catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [workId, isAuthenticated, router]);

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
  }

  async function handleEmotionSubmit() {
    if (selectedTags.length > 0) {
      await api.addEmotionTags(
        workId,
        selectedTags.map((tagId) => ({ tagId, intensity: tagIntensities[tagId] || 3 })),
      ).catch(() => {});
    }
    setStep('stateChange');
  }

  async function handleStateChangeSubmit() {
    const changes = STATE_AXES
      .filter((a) => stateChanges[a.axis].before !== stateChanges[a.axis].after)
      .map((a) => ({ axis: a.axis, ...stateChanges[a.axis] }));
    if (changes.length > 0) {
      await api.saveStateChanges(workId, changes).catch(() => {});
    }
    // Start loading AI insights
    setInsightsLoading(true);
    api.getAiInsights(workId)
      .then((res) => setInsights(res.data))
      .catch(() => {})
      .finally(() => setInsightsLoading(false));
    setStep('insights');
  }

  async function handleInsightsNext() {
    // Load AI recommendations, fall back to getNextForMe
    api.getAiRecommendationsBecauseYouRead(workId)
      .then((res) => setAiRecommendations(res.data))
      .catch(() => {
        api.getNextForMe(workId)
          .then((res) => setNextBooks(res.data))
          .catch(() => {});
      });
    setStep('nextBook');
  }

  async function handleReviewSubmit() {
    if (reviewText.trim()) {
      await api.createReview({ workId, content: reviewText }).catch(() => {});
    }
    router.push('/bookshelf');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-40 w-80" />
      </div>
    );
  }

  if (!work) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="px-4 py-16">
        {/* Step: Afterglow */}
        {step === 'afterglow' && (
          <div className="text-center space-y-8 animate-in fade-in duration-1000">
            <div className="space-y-4">
              <Star className="h-12 w-12 mx-auto text-primary/60" />
              <h1 className="text-2xl font-serif font-bold">{work.title}</h1>
              <p className="text-muted-foreground">お疲れさまでした</p>
            </div>
            <div className="pt-8 space-y-3">
              <Button onClick={() => setStep('emotions')} size="lg" className="min-h-[48px]">
                読後の気持ちを記録する <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => router.push('/bookshelf')}
                >
                  すべてスキップ
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Emotion Tags */}
        {step === 'emotions' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">この作品で感じたことは？</h2>
              <p className="text-sm text-muted-foreground">当てはまるものをタップしてください</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {allEmotionTags.map((tag) => (
                <div key={tag.id} className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      'px-4 py-2 rounded-full text-sm transition-all min-h-[44px]',
                      selectedTags.includes(tag.id)
                        ? 'bg-primary text-primary-foreground scale-105'
                        : 'bg-muted text-foreground hover:bg-muted/80',
                    )}
                  >
                    {tag.nameJa}
                  </button>
                  {selectedTags.includes(tag.id) && (
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={tagIntensities[tag.id] || 3}
                      onChange={(e) => setTagIntensities((prev) => ({ ...prev, [tag.id]: Number(e.target.value) }))}
                      className="w-16 accent-primary"
                      title={`強度: ${tagIntensities[tag.id] || 3}`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-center pt-4">
              <Button onClick={handleEmotionSubmit} size="lg" className="min-h-[48px]">
                次へ <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: State Change Sliders */}
        {step === 'stateChange' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">読む前と読んだ後で変わったこと</h2>
              <p className="text-sm text-muted-foreground">スライダーで変化を記録してください</p>
            </div>
            <div className="space-y-6">
              {STATE_AXES.map(({ axis, label }) => (
                <div key={axis} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground">
                      {stateChanges[axis].before} → {stateChanges[axis].after}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground">読む前</label>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={stateChanges[axis].before}
                        onChange={(e) => setStateChanges((prev) => ({
                          ...prev,
                          [axis]: { ...prev[axis], before: Number(e.target.value) },
                        }))}
                        className="w-full accent-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">読んだ後</label>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={stateChanges[axis].after}
                        onChange={(e) => setStateChanges((prev) => ({
                          ...prev,
                          [axis]: { ...prev[axis], after: Number(e.target.value) },
                        }))}
                        className="w-full accent-primary"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center pt-4">
              <Button onClick={handleStateChangeSubmit} size="lg" className="min-h-[48px]">
                次へ <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: AI Insights */}
        {step === 'insights' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center">
              <Sparkles className="h-8 w-8 mx-auto text-primary/60 mb-2" />
              <h2 className="text-xl font-bold mb-2">AIによる作品分析</h2>
              <p className="text-sm text-muted-foreground">この作品から見えてきたこと</p>
            </div>
            {insightsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : insights ? (
              <div className="space-y-3">
                {insights.themes.length > 0 && (
                  <InsightCard title="テーマ" defaultOpen>
                    <ul className="space-y-2">
                      {insights.themes.map((t, i) => (
                        <li key={i}>
                          <span className="font-medium text-foreground">{t.name}</span>
                          <span className="mx-1">-</span>
                          {t.explanation}
                        </li>
                      ))}
                    </ul>
                  </InsightCard>
                )}
                {insights.emotionalJourney && (
                  <InsightCard title="感情の旅路">
                    <p>{insights.emotionalJourney}</p>
                  </InsightCard>
                )}
                {insights.characterInsights.length > 0 && (
                  <InsightCard title="キャラクター分析">
                    <ul className="space-y-2">
                      {insights.characterInsights.map((c, i) => (
                        <li key={i}>
                          <span className="font-medium text-foreground">{c.name}</span>
                          <span className="mx-1">-</span>
                          {c.arc}
                        </li>
                      ))}
                    </ul>
                  </InsightCard>
                )}
                {insights.symbolism.length > 0 && (
                  <InsightCard title="象徴・シンボル">
                    <ul className="space-y-2">
                      {insights.symbolism.map((s, i) => (
                        <li key={i}>
                          <span className="font-medium text-foreground">{s.element}</span>
                          <span className="mx-1">-</span>
                          {s.meaning}
                        </li>
                      ))}
                    </ul>
                  </InsightCard>
                )}
                {insights.discussionQuestions.length > 0 && (
                  <InsightCard title="議論のきっかけ">
                    <ul className="space-y-1 list-disc list-inside">
                      {insights.discussionQuestions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </InsightCard>
                )}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                AI分析を取得できませんでした
              </p>
            )}
            <div className="flex justify-center pt-4">
              <Button onClick={handleInsightsNext} size="lg" className="min-h-[48px]">
                次へ <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Next Book */}
        {step === 'nextBook' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">次にこの一冊はいかが？</h2>
              <p className="text-sm text-muted-foreground">あなたの感情に近い作品です</p>
            </div>
            {aiRecommendations.length > 0 ? (
              <div className="grid gap-3">
                {aiRecommendations.map((rec, i) => (
                  <RecommendationCard key={i} rec={rec} />
                ))}
              </div>
            ) : nextBooks.length > 0 ? (
              <div className="grid gap-3">
                {nextBooks.map((w) => (
                  <Link key={w.id} href={`/works/${w.id}`}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-5 flex items-center gap-4">
                        <BookOpen className="h-8 w-8 text-primary/40 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm">{w.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            {w.author.displayName || w.author.name}
                          </p>
                        </div>
                        {w.qualityScore && (
                          <Badge variant="secondary" className="shrink-0">
                            {Math.round(w.qualityScore.overall)}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                おすすめの作品が見つかりませんでした
              </p>
            )}
            <div className="flex justify-center pt-4">
              <Button onClick={() => setStep('review')} variant="outline" size="lg" className="min-h-[48px]">
                レビューを書く <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">レビューを書く（任意）</h2>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {REVIEW_GUIDES.map((guide, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-muted min-h-[36px]"
                    onClick={() => setReviewText((prev) => prev + (prev ? '\n' : '') + guide)}
                  >
                    {guide}
                  </Badge>
                ))}
              </div>
              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={6}
                placeholder="この作品について思ったことを自由に書いてください..."
                className="font-serif leading-relaxed"
              />
            </div>
            {/* Share on X */}
            <div className="flex justify-center">
              <a
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(`「${work.title}」を読了しました！\n\n#Workwrite #読書`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Xで感想をシェア
              </a>
            </div>
            <div className="flex justify-center gap-3 pt-4">
              <Button onClick={() => { setReviewText(''); handleReviewSubmit(); }} variant="ghost" className="min-h-[48px]">
                スキップ
              </Button>
              <Button onClick={handleReviewSubmit} size="lg" className="min-h-[48px]">
                投稿して完了
              </Button>
            </div>
          </div>
        )}

        {/* Progress indicator */}
        <div className="flex justify-center gap-2 mt-12">
          {(['afterglow', 'emotions', 'stateChange', 'insights', 'nextBook', 'review'] as Step[]).map((s) => (
            <div
              key={s}
              className={cn(
                'h-1.5 w-8 rounded-full transition-colors',
                s === step ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

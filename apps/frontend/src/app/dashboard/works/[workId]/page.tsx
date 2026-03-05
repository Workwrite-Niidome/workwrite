'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Zap, Users, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type QualityScoreDetail } from '@/lib/api';

interface HeatmapEntry {
  episodeId: string;
  title: string;
  orderIndex: number;
  readers: number;
  avgProgress: number;
}

interface EmotionCloudEntry {
  name: string;
  count: number;
  avgIntensity: number;
}

const SCORE_LABELS: Record<string, string> = {
  immersion: '没入力',
  transformation: '変容力',
  virality: '拡散力',
  worldBuilding: '世界構築力',
};

export default function WorkAnalyticsPage() {
  const params = useParams();
  const workId = params.workId as string;
  const router = useRouter();

  const [score, setScore] = useState<QualityScoreDetail | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [emotionCloud, setEmotionCloud] = useState<EmotionCloudEntry[]>([]);
  const [scoring, setScoring] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getScoreAnalysis(workId).catch(() => ({ data: null })),
      api.getWorkHeatmap(workId).catch(() => ({ data: [] })),
      api.getWorkEmotionCloud(workId).catch(() => ({ data: [] })),
    ]).then(([scoreRes, heatmapRes, emotionRes]) => {
      setScore(scoreRes.data);
      setHeatmap(heatmapRes.data);
      setEmotionCloud(emotionRes.data);
    }).finally(() => setLoading(false));
  }, [workId]);

  async function handleScore() {
    setScoring(true);
    try {
      const res = await api.triggerScoring(workId);
      if (res.data) {
        setScore(res.data);
      }
    } catch {}
    setScoring(false);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> ダッシュボードへ戻る
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">作品分析</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Quality Score */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" /> AI品質スコア
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleScore}
              disabled={scoring}
            >
              {scoring ? 'スコアリング中...' : score ? '再スコアリング' : 'スコアリング実行'}
            </Button>
          </CardHeader>
          <CardContent>
            {score ? (
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <span className="text-4xl font-bold text-primary">{Math.round(score.overall)}</span>
                  <span className="text-muted-foreground text-sm ml-1">/ 100</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(['immersion', 'transformation', 'virality', 'worldBuilding'] as const).map((key) => (
                    <div key={key} className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">{SCORE_LABELS[key]}</p>
                      <p className="text-xl font-bold">{Math.round(score[key])}</p>
                      {score.analysis?.[key] && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{score.analysis[key]}</p>
                      )}
                    </div>
                  ))}
                </div>
                {score.tips.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium mb-2">改善提案</h3>
                    <ul className="space-y-1">
                      {score.tips.map((tip, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary font-bold">{i + 1}.</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                まだスコアリングされていません
              </p>
            )}
          </CardContent>
        </Card>

        {/* Reading Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart className="h-4 w-4" /> エピソード読了率
            </CardTitle>
          </CardHeader>
          <CardContent>
            {heatmap.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">データなし</p>
            ) : (
              <div className="space-y-2">
                {heatmap.map((ep) => (
                  <div key={ep.episodeId} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">第{ep.orderIndex + 1}話 {ep.title}</span>
                      <span>{ep.readers}人 / {ep.avgProgress}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${ep.avgProgress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Emotion Tag Cloud */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> 読者の感情タグ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {emotionCloud.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">データなし</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {emotionCloud.map((tag) => {
                  const size = Math.min(tag.count * 4 + 12, 24);
                  return (
                    <Badge
                      key={tag.name}
                      variant="secondary"
                      className="transition-all"
                      style={{ fontSize: `${size}px`, padding: `${size / 4}px ${size / 2}px` }}
                    >
                      {tag.name}
                      <span className="ml-1 opacity-60">({tag.count})</span>
                    </Badge>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

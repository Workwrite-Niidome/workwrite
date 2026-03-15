'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScoreCard } from '@/components/scoring/score-card';
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

export default function WorkAnalyticsPage() {
  const params = useParams();
  const workId = params.workId as string;
  const router = useRouter();

  const [score, setScore] = useState<QualityScoreDetail | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [emotionCloud, setEmotionCloud] = useState<EmotionCloudEntry[]>([]);
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

  if (loading) {
    return (
      <div className="px-4 py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> ダッシュボードへ戻る
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">作品分析</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Quality Score - unified component */}
        <div className="md:col-span-2">
          <ScoreCard score={score} workId={workId} onScoreUpdate={setScore} />
        </div>

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

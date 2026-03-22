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
import { api, type QualityScoreDetail, type Work } from '@/lib/api';

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
  const [workTitle, setWorkTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [workReactions, setWorkReactions] = useState<any>(null);
  const [creationPlan, setCreationPlan] = useState<any>(null);
  const [reactionFeed, setReactionFeed] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.getWork(workId).then((res) => setWorkTitle(res.data?.title || '')).catch(() => {}),
      api.getScoreAnalysis(workId).catch(() => ({ data: null })),
      api.getWorkHeatmap(workId).catch(() => ({ data: [] })),
      api.getWorkEmotionCloud(workId).catch(() => ({ data: [] })),
    ]).then(([, scoreRes, heatmapRes, emotionRes]) => {
      setScore((scoreRes as any)?.data ?? null);
      setHeatmap((heatmapRes as any)?.data ?? []);
      setEmotionCloud((emotionRes as any)?.data ?? []);
    }).finally(() => setLoading(false));

    // Fetch reactions and creation plan for emotion achievement
    api.getWorkReactions(workId).then((res) => setWorkReactions(res.data)).catch(() => {});
    api.getCreationPlan(workId).then((res) => setCreationPlan(res.data)).catch(() => {});
    api.getWorkReactionFeed(workId).then((res) => setReactionFeed(res.data || [])).catch(() => {});
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
          <ScoreCard score={score} workId={workId} workTitle={workTitle} onScoreUpdate={setScore} />
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
        {/* Emotion Achievement (design intent vs reader reactions) */}
        {creationPlan?.chapterOutline && workReactions?.byEpisode?.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">感情達成度</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(creationPlan.chapterOutline as any[]).map((ch: any, i: number) => {
                  const epReaction = workReactions.byEpisode.find((e: any) => e.orderIndex === i);
                  const emotionLabels: Record<string, string> = { moved: '泣いた', warm: '温かい', surprised: '驚いた', fired_up: '燃えた', thoughtful: '深い' };
                  return (
                    <div key={i} className="flex items-start gap-4 py-2 border-b border-border last:border-b-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">第{i + 1}話「{ch.title || ''}」</p>
                        {ch.emotionTarget && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            設計意図: {ch.emotionTarget}
                            {ch.emotionIntensity && ` (${ch.emotionIntensity}/10)`}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {epReaction ? (
                          <div>
                            <p className="text-sm">拍手 {epReaction.totalClaps || epReaction.claps || 0}</p>
                            {epReaction.topEmotion && (
                              <p className="text-xs text-primary">{emotionLabels[epReaction.topEmotion] || epReaction.topEmotion}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">反応なし</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reaction Feed for this work */}
        {reactionFeed.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">最近のリアクション</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0 divide-y divide-border">
                {reactionFeed.slice(0, 15).map((item: any) => {
                  const emotionLabels: Record<string, string> = { moved: '泣いた', warm: '温かい', surprised: '驚いた', fired_up: '燃えた', thoughtful: '深い' };
                  const diff = Date.now() - new Date(item.createdAt).getTime();
                  const mins = Math.floor(diff / 60000);
                  const timeAgo = mins < 1 ? 'たった今' : mins < 60 ? `${mins}分前` : mins < 1440 ? `${Math.floor(mins / 60)}時間前` : `${Math.floor(mins / 1440)}日前`;
                  return (
                    <div key={item.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="text-xs text-muted-foreground w-14 shrink-0 text-right">{timeAgo}</span>
                      <span className="text-muted-foreground">{item.userDisplayName}</span>
                      <span className="text-muted-foreground">が第{item.episodeOrderIndex + 1}話に</span>
                      <span>拍手{item.claps > 1 ? `(${item.claps}回)` : ''}</span>
                      {item.emotion && <span className="text-primary text-xs">「{emotionLabels[item.emotion] || item.emotion}」</span>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

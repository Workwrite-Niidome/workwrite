'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, type QualityScoreDetail } from '@/lib/api';
import { ShareScoreButton } from './share-score-button';

interface ScoreCardProps {
  score: QualityScoreDetail | null;
  workId?: string;
  workTitle?: string;
  onScoreUpdate?: (score: QualityScoreDetail) => void;
}

const ALL_AXES = [
  { key: 'immersion', label: '没入力', desc: '読者を引き込む力', angle: -90 },
  { key: 'transformation', label: '変容力', desc: '心に残る読後感', angle: -30 },
  { key: 'virality', label: '拡散力', desc: '人に薦めたくなる魅力', angle: 30 },
  { key: 'worldBuilding', label: '世界構築力', desc: '舞台設定の奥行き', angle: 90 },
  { key: 'characterDepth', label: 'キャラクター深度', desc: '人物の立体感', angle: 150 },
  { key: 'structuralScore', label: '構造スコア', desc: '物語の設計力', angle: 210 },
] as const;

const EMOTION_TAG_LABELS: Record<string, string> = {
  courage: '勇気', tears: '涙', worldview: '世界観', healing: '癒し',
  excitement: '興奮', thinking: '思考', laughter: '笑い', empathy: '共感',
  awe: '畏怖', nostalgia: '郷愁', suspense: 'サスペンス', mystery: 'ミステリー',
  hope: '希望', beauty: '美しさ', growth: '成長',
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function RadarChart({ score }: { score: QualityScoreDetail }) {
  const cx = 120;
  const cy = 120;
  const maxR = 90;
  const levels = [25, 50, 75, 100];

  const points = ALL_AXES.map((axis) => {
    const value = score[axis.key as keyof QualityScoreDetail] as number || 0;
    const r = (value / 100) * maxR;
    return polarToCartesian(cx, cy, r, axis.angle);
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-[220px] mx-auto">
      {levels.map((level) => {
        const r = (level / 100) * maxR;
        const gridPoints = ALL_AXES.map((axis) => polarToCartesian(cx, cy, r, axis.angle));
        const gridPolygon = gridPoints.map((p) => `${p.x},${p.y}`).join(' ');
        return (
          <polygon key={level} points={gridPolygon} fill="none" stroke="currentColor" className="text-border" strokeWidth="0.5" />
        );
      })}
      {ALL_AXES.map((axis) => {
        const end = polarToCartesian(cx, cy, maxR, axis.angle);
        return <line key={axis.key} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="currentColor" className="text-border" strokeWidth="0.5" />;
      })}
      <polygon points={polygon} fill="currentColor" className="text-primary/20" stroke="currentColor" strokeWidth="1.5" />
      {ALL_AXES.map((axis) => {
        const pos = polarToCartesian(cx, cy, maxR + 18, axis.angle);
        return (
          <text key={axis.key} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground" fontSize="8">
            {axis.label}
          </text>
        );
      })}
      {ALL_AXES.map((axis, i) => {
        const value = Math.round((score[axis.key as keyof QualityScoreDetail] as number) || 0);
        return (
          <text key={`val-${axis.key}`} x={points[i].x} y={points[i].y - 8} textAnchor="middle" className="fill-foreground font-medium" fontSize="8">
            {value}
          </text>
        );
      })}
    </svg>
  );
}

export function ScoreCard({ score, workId, workTitle, onScoreUpdate }: ScoreCardProps) {
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState('');

  async function handleScore() {
    if (!workId) return;
    setScoring(true);
    setError('');
    try {
      const res = await api.triggerScoring(workId);
      if (res.data) {
        onScoreUpdate?.(res.data);
      }
    } catch (e: any) {
      setError(e?.message || 'スコアリングに失敗しました');
    }
    setScoring(false);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            AI品質スコア
          </span>
          {workId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleScore}
              disabled={scoring}
              className="text-xs h-7"
            >
              {scoring ? 'スコアリング中...' : score ? '再スコアリング' : 'スコアリング実行'}
            </Button>
          )}
        </CardTitle>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        {score ? (
          <>
            {(score as any).isImported && (
              <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
                <p className="text-[11px] text-blue-700 dark:text-blue-400">
                  本文から読み取れる魅力をもとに分析しました。キャラクター設定やプロットをWorkwriteに登録すると、
                  キャラの一貫性チェックや伏線追跡など、さらに深い分析が可能になります。
                </p>
              </div>
            )}
            {/* Overall score */}
            <div className="text-center">
              <span className="text-4xl font-bold text-primary">{Math.round(score.overall)}</span>
              <span className="text-muted-foreground text-sm ml-1">/ 100</span>
              {score.overall >= 50 && (
                <p className="text-sm font-medium mt-1" style={{ color: score.overall >= 90 ? '#9333ea' : score.overall >= 80 ? '#16a34a' : score.overall >= 65 ? '#2563eb' : '#d97706' }}>
                  {score.overall >= 90 ? '傑作' : score.overall >= 80 ? '秀作' : score.overall >= 65 ? '良作' : '佳作'}
                </p>
              )}
            </div>

            {/* Radar chart */}
            <RadarChart score={score} />

            {/* All 6 axes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_AXES.map((axis) => {
                const val = score[axis.key as keyof QualityScoreDetail] as number | undefined;
                if (val == null) return null;
                return (
                  <div key={axis.key} className="p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="text-xs font-medium">{axis.label}</p>
                        <p className="text-[10px] text-muted-foreground">{axis.desc}</p>
                      </div>
                      <p className="text-lg font-bold">{Math.round(val)}</p>
                    </div>
                    {score.analysis?.[axis.key] && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{score.analysis[axis.key]}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Emotion tags */}
            {score.emotionTags && score.emotionTags.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5">感情タグ</p>
                <div className="flex flex-wrap gap-1">
                  {score.emotionTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">
                      {EMOTION_TAG_LABELS[tag] || tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Improvement tips */}
            {score.tips && score.tips.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">改善提案</p>
                <ol className="space-y-1.5">
                  {score.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                スコアリング: {new Date(score.scoredAt).toLocaleDateString('ja-JP')}
                {' '}(1クレジット消費)
              </p>
              {workId && (
                <ShareScoreButton
                  workId={workId}
                  title={workTitle || '作品'}
                  score={score.overall}
                />
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-2">まだスコアリングされていません</p>
            {workId && (
              <p className="text-xs text-muted-foreground">
                上のボタンからAIスコアリングを実行できます（1クレジット）
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

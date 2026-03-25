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

interface CostEstimate {
  credits: number;
  sonnetCredits?: number;
  totalChars: number;
  balance: { total: number };
}

type ScoringModel = 'haiku' | 'sonnet';

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

function formatChars(chars: number): string {
  if (chars >= 10000) return `${Math.round(chars / 1000) / 10}万`;
  if (chars >= 1000) return `${Math.round(chars / 100) / 10}千`;
  return `${chars}`;
}

export function ScoreCard({ score, workId, workTitle, onScoreUpdate }: ScoreCardProps) {
  const [scoring, setScoring] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [selectedModel, setSelectedModel] = useState<ScoringModel>('haiku');
  const [error, setError] = useState('');
  const [lastCreditCost, setLastCreditCost] = useState<number | null>(null);

  async function handleEstimate() {
    if (!workId) return;
    setEstimating(true);
    setError('');
    setCostEstimate(null);
    try {
      const res = await api.estimateScoringCost(workId);
      setCostEstimate({
        credits: res.estimate.credits,
        sonnetCredits: res.sonnetEstimate?.credits,
        totalChars: res.totalChars,
        balance: res.balance,
      });
    } catch (e: any) {
      setError(e?.message || '見積もりの取得に失敗しました');
    }
    setEstimating(false);
  }

  const currentCredits = selectedModel === 'sonnet' && costEstimate?.sonnetCredits
    ? costEstimate.sonnetCredits
    : costEstimate?.credits || 0;

  async function handleConfirmScore() {
    if (!workId) return;
    setScoring(true);
    setError('');
    try {
      const res = await api.triggerScoring(workId, selectedModel);
      if (res.data) {
        setLastCreditCost(currentCredits || null);
        onScoreUpdate?.(res.data);
      }
    } catch (e: any) {
      setError(e?.message || 'スコアリングに失敗しました');
    }
    setScoring(false);
    setCostEstimate(null);
  }

  function handleCancel() {
    setCostEstimate(null);
  }

  const insufficientCredits = costEstimate && costEstimate.balance.total < currentCredits;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            AI品質スコア
          </span>
          {workId && !costEstimate && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEstimate}
              disabled={scoring || estimating}
              className="text-xs h-7"
            >
              {estimating ? '見積もり中...' : scoring ? 'スコアリング中...' : score ? '再スコアリング' : 'スコアリング実行'}
            </Button>
          )}
        </CardTitle>
        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Cost confirmation dialog */}
        {costEstimate && (
          <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-border space-y-2">
            <p className="text-xs font-medium">スコアリングのコスト確認</p>

            {/* Model selection */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedModel('haiku')}
                className={`flex-1 px-3 py-2 rounded-md border text-xs transition-colors ${
                  selectedModel === 'haiku'
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-secondary'
                }`}
              >
                <span className="font-medium block">Standard</span>
                <span className="block mt-0.5">{costEstimate.credits}cr</span>
              </button>
              {costEstimate.sonnetCredits && (
                <button
                  type="button"
                  onClick={() => setSelectedModel('sonnet')}
                  className={`flex-1 px-3 py-2 rounded-md border text-xs transition-colors ${
                    selectedModel === 'sonnet'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <span className="font-medium block">Pro</span>
                  <span className="block mt-0.5">{costEstimate.sonnetCredits}cr</span>
                </button>
              )}
            </div>
            {selectedModel === 'sonnet' && (
              <p className="text-[10px] text-muted-foreground">より精度の高い分析と具体的な改善提案が得られます。</p>
            )}

            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>作品文字数: 約{formatChars(costEstimate.totalChars)}文字</p>
              <p>消費クレジット: <span className="font-bold text-foreground">{currentCredits}cr</span></p>
              <p>残高: {costEstimate.balance.total}cr</p>
            </div>
            {insufficientCredits && (
              <p className="text-xs text-destructive">
                クレジットが不足しています。
                <a href="/settings/billing" className="underline ml-1">クレジットを追加</a>
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleConfirmScore}
                disabled={scoring || !!insufficientCredits}
                className="text-xs h-7"
              >
                {scoring ? 'スコアリング中...' : `${currentCredits}cr で実行`}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                disabled={scoring}
                className="text-xs h-7"
              >
                キャンセル
              </Button>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {score ? (
          <>
            {(score as any).isImported && (
              <div className="p-2.5 bg-muted/50 rounded-md border border-border">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
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
                {lastCreditCost != null && ` (${lastCreditCost}クレジット消費)`}
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
                上のボタンからAIスコアリングを実行できます（文字数に応じたクレジット消費）
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

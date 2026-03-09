'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { QualityScoreDetail } from '@/lib/api';

interface ScoreCardProps {
  score: QualityScoreDetail;
}

const AXES = [
  { key: 'immersion', label: '没入力', angle: -90 },
  { key: 'transformation', label: '変容力', angle: 0 },
  { key: 'virality', label: '拡散力', angle: 90 },
  { key: 'worldBuilding', label: '世界構築力', angle: 180 },
] as const;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function RadarChart({ score }: { score: QualityScoreDetail }) {
  const cx = 100;
  const cy = 100;
  const maxR = 80;
  const levels = [25, 50, 75, 100];

  const points = AXES.map((axis) => {
    const value = score[axis.key] || 0;
    const r = (value / 100) * maxR;
    return polarToCartesian(cx, cy, r, axis.angle);
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[200px] mx-auto">
      {/* Grid */}
      {levels.map((level) => {
        const r = (level / 100) * maxR;
        const gridPoints = AXES.map((axis) => polarToCartesian(cx, cy, r, axis.angle));
        const gridPolygon = gridPoints.map((p) => `${p.x},${p.y}`).join(' ');
        return (
          <polygon
            key={level}
            points={gridPolygon}
            fill="none"
            stroke="currentColor"
            className="text-border"
            strokeWidth="0.5"
          />
        );
      })}

      {/* Axes */}
      {AXES.map((axis) => {
        const end = polarToCartesian(cx, cy, maxR, axis.angle);
        return (
          <line
            key={axis.key}
            x1={cx}
            y1={cy}
            x2={end.x}
            y2={end.y}
            stroke="currentColor"
            className="text-border"
            strokeWidth="0.5"
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={polygon}
        fill="currentColor"
        className="text-primary/20"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Labels */}
      {AXES.map((axis) => {
        const pos = polarToCartesian(cx, cy, maxR + 16, axis.angle);
        return (
          <text
            key={axis.key}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            fontSize="9"
          >
            {axis.label}
          </text>
        );
      })}

      {/* Values */}
      {AXES.map((axis, i) => {
        const value = Math.round(score[axis.key] || 0);
        return (
          <text
            key={`val-${axis.key}`}
            x={points[i].x}
            y={points[i].y - 8}
            textAnchor="middle"
            className="fill-foreground font-medium"
            fontSize="8"
          >
            {value}
          </text>
        );
      })}
    </svg>
  );
}

export function ScoreCard({ score }: ScoreCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>AI品質スコア</span>
          <span className="text-2xl font-bold">{Math.round(score.overall)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadarChart score={score} />

        {score.analysis && (
          <div className="space-y-2">
            {AXES.map((axis) => {
              const comment = score.analysis?.[axis.key];
              if (!comment) return null;
              return (
                <div key={axis.key} className="text-xs">
                  <span className="font-medium">{axis.label}:</span>{' '}
                  <span className="text-muted-foreground">{comment}</span>
                </div>
              );
            })}
          </div>
        )}

        {score.tips && score.tips.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium">改善ポイント</p>
            <ul className="space-y-1">
              {score.tips.map((tip, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="shrink-0">{'>'}</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

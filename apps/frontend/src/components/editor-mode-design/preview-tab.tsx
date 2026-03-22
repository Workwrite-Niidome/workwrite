'use client';

import { ChevronRight, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { DesignData } from './types';

interface Props {
  design: DesignData;
  onFinalize: () => void;
  finalizing: boolean;
  creditsRemaining: number | null;
  creditsConsumed: number;
}

function SummaryRow({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <div className="text-xs">
      <span className="font-medium text-foreground">{label}:</span>{' '}
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

function formatProtagonist(p: DesignData['protagonist']): string | null {
  if (!p) return null;
  if (typeof p === 'string') return p;
  return p.name ? `${p.name}${p.role ? ` (${p.role})` : ''}${p.personality ? ` -- ${p.personality}` : ''}` : null;
}

function formatCharacters(c: DesignData['characters']): string | null {
  if (!c) return null;
  if (typeof c === 'string') return c;
  if (Array.isArray(c) && c.length > 0) {
    return c.map(ch => ch.name || '(unnamed)').join(', ');
  }
  return null;
}

export function PreviewTab({ design, onFinalize, finalizing, creditsRemaining, creditsConsumed }: Props) {
  const hasContent = !!(design.genre || design.theme || design.protagonist || design.plotOutline);

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
          <Eye className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          設計内容がまだありません
        </p>
      </div>
    );
  }

  const episodeCount = design.episodeCount || 0;
  const charCount = design.charCountPerEpisode || 0;

  return (
    <div className="p-4 space-y-4">
      {/* Summary */}
      <Card>
        <CardContent className="pt-5 space-y-2">
          <h3 className="text-sm font-medium mb-2">設計サマリー</h3>
          <SummaryRow label="ジャンル" value={design.genre} />
          <SummaryRow label="テーマ" value={design.theme} />
          <SummaryRow label="読後感" value={design.afterReading} />
          <SummaryRow label="主人公" value={formatProtagonist(design.protagonist)} />
          <SummaryRow label="キャラクター" value={formatCharacters(design.characters)} />
          <SummaryRow label="世界観" value={design.worldBuilding} />
          <SummaryRow label="葛藤" value={design.conflict} />
          <SummaryRow label="プロット" value={design.plotOutline} />
          <SummaryRow label="トーン" value={design.tone} />
          <SummaryRow
            label="スコープ"
            value={episodeCount ? `${episodeCount}話 x ${charCount || '?'}字` : undefined}
          />
        </CardContent>
      </Card>

      {/* Credit estimate */}
      {episodeCount > 0 && charCount > 0 && (
        <Card className="border-indigo-400/30 bg-indigo-50/10 dark:bg-indigo-950/10">
          <CardContent className="pt-5">
            <h3 className="text-sm font-medium mb-2">推定クレジット消費</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">通常モード</p>
                <p className="font-bold text-sm">{episodeCount} x 1 = {episodeCount}cr</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">高精度モード</p>
                <p className="font-bold text-sm">{episodeCount} x 5 = {episodeCount * 5}cr</p>
              </div>
            </div>
            {creditsRemaining !== null && (
              <p className="text-xs mt-2">
                残り: <span className="font-bold">{creditsRemaining}cr</span>
                {' '}(消費済み: {creditsConsumed}cr)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Finalize button */}
      <Button
        onClick={onFinalize}
        disabled={!design.episodeCount || !design.charCountPerEpisode || finalizing}
        className="w-full gap-2"
      >
        {finalizing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        設計を確定して第1話を生成
      </Button>
    </div>
  );
}

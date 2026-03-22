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

function formatCharacters(c: DesignData['characters']): string | null {
  if (!c || !Array.isArray(c) || c.length === 0) return null;
  return c.map((ch: any) => {
    const name = ch.name || '(unnamed)';
    const role = ch.role ? ` (${ch.role})` : '';
    return `${name}${role}`;
  }).join(', ');
}

function formatWorldBuilding(wb: DesignData['worldBuilding']): string | null {
  if (!wb) return null;
  if (typeof wb === 'string') return wb;
  const parts: string[] = [];
  if (wb.basics?.era) parts.push(`時代: ${wb.basics.era}`);
  if (wb.basics?.setting) parts.push(`舞台: ${wb.basics.setting}`);
  if (wb.rules?.length) parts.push(`ルール: ${wb.rules.length}件`);
  if (wb.terminology?.length) parts.push(`用語: ${wb.terminology.length}件`);
  if (wb.items?.length) parts.push(`アイテム: ${wb.items.length}件`);
  return parts.length > 0 ? parts.join(' / ') : null;
}

function formatPlot(design: DesignData): string | null {
  if (design.actGroups && design.actGroups.length > 0) {
    const totalEps = design.actGroups.reduce((sum, g) => sum + g.episodes.length, 0);
    const template = design.structureTemplate || '?';
    return `${template} (${design.actGroups.length}パート, ${totalEps}エピソード)`;
  }
  if (design.plotOutline) return design.plotOutline;
  return null;
}

export function PreviewTab({ design, onFinalize, finalizing, creditsRemaining, creditsConsumed }: Props) {
  const hasContent = !!(
    design.genre || design.title || design.coreMessage || design.theme ||
    design.characters?.length || design.actGroups?.length || design.plotOutline
  );

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
      {/* Finalize button */}
      <Button
        onClick={onFinalize}
        disabled={!design.episodeCount || finalizing}
        className="w-full gap-2"
        size="lg"
      >
        {finalizing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        設計を確定して第1話を生成
      </Button>

      {/* Credit estimate */}
      {episodeCount > 0 && (
        <Card className="border-indigo-400/30 bg-indigo-50/10 dark:bg-indigo-950/10">
          <CardContent className="pt-4 pb-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-[10px]">通常モード</p>
                <p className="font-bold text-xs">{episodeCount} x 1 = {episodeCount}cr</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px]">高精度モード</p>
                <p className="font-bold text-xs">{episodeCount} x 5 = {episodeCount * 5}cr</p>
              </div>
            </div>
            {creditsRemaining !== null && (
              <p className="text-[10px] mt-1.5 text-muted-foreground">
                残り: <span className="font-medium text-foreground">{creditsRemaining}cr</span>
                {' '}(消費済み: {creditsConsumed}cr)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card>
        <CardContent className="pt-5 space-y-2">
          <h3 className="text-sm font-medium mb-2">設計サマリー</h3>
          <SummaryRow label="タイトル" value={design.title} />
          <SummaryRow label="ジャンル" value={design.genre} />
          <SummaryRow label="サブジャンル" value={design.subGenres?.join(', ')} />
          <SummaryRow label="テーマ/メッセージ" value={design.coreMessage || design.theme} />
          <SummaryRow label="読者の感情" value={design.targetEmotions || design.afterReading} />
          <SummaryRow label="読者の旅路" value={design.readerJourney} />
          <SummaryRow label="インスピレーション" value={design.inspiration} />
          <SummaryRow label="キャラクター" value={formatCharacters(design.characters)} />
          <SummaryRow label="世界観" value={formatWorldBuilding(design.worldBuilding)} />
          <SummaryRow label="プロット" value={formatPlot(design)} />
          <SummaryRow label="あらすじ" value={design.synopsis} />
          <SummaryRow label="トーン" value={design.tone} />
          <SummaryRow label="葛藤" value={design.conflict} />
          <SummaryRow
            label="スコープ"
            value={episodeCount ? `${episodeCount}話 x ${charCount || '?'}字` : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { Map } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import type { DesignData } from './types';

interface Props {
  design: DesignData;
  onChange: (d: Partial<DesignData>) => void;
}

export function PlotTab({ design, onChange }: Props) {
  const hasContent = !!(design.conflict || design.plotOutline);

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
          <Map className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          プロット設定がまだありません
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">中心的な葛藤</label>
            <Textarea
              value={design.conflict || ''}
              onChange={(e) => onChange({ conflict: e.target.value })}
              placeholder="物語の中心となるコンフリクト"
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">プロット概要</label>
            <Textarea
              value={design.plotOutline || ''}
              onChange={(e) => onChange({ plotOutline: e.target.value })}
              placeholder="ストーリーの流れ"
              rows={6}
              className="text-sm resize-none"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

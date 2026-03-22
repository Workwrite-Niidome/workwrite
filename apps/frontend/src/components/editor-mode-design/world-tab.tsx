'use client';

import { Globe } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import type { DesignData } from './types';

interface Props {
  design: DesignData;
  onChange: (d: Partial<DesignData>) => void;
}

export function WorldTab({ design, onChange }: Props) {
  if (!design.worldBuilding) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
          <Globe className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          世界観の設定がまだありません
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <Card>
        <CardContent className="pt-5 space-y-1.5">
          <label className="text-sm font-medium">世界観・ルール</label>
          <Textarea
            value={design.worldBuilding || ''}
            onChange={(e) => onChange({ worldBuilding: e.target.value })}
            placeholder="物語の世界観、時代背景、特別なルール"
            rows={6}
            className="text-sm resize-none"
          />
        </CardContent>
      </Card>
    </div>
  );
}

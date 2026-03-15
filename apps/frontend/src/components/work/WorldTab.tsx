'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Globe, BookOpen, Sparkles, ScrollText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';

interface WorldData {
  basics: { era?: string; setting?: string; civilizationLevel?: string } | null;
  rules: { name: string; description: string; constraints?: string }[];
  terminology: { term: string; reading?: string; definition: string }[];
  history: string | null;
  items: { name: string; appearance?: string; ability?: string; constraints?: string }[];
}

export function WorldTab({ workId }: { workId: string }) {
  const [data, setData] = useState<WorldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basics']));

  useEffect(() => {
    api.getWorldData(workId)
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workId]);

  if (loading) return <div className="text-sm text-muted-foreground py-4">読み込み中...</div>;
  if (!data) return null;

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const hasContent = data.basics || data.rules?.length > 0 || data.terminology?.length > 0 || data.history || data.items?.length > 0;
  if (!hasContent) return null;

  return (
    <div className="space-y-3">
      {/* Basics */}
      {data.basics && (data.basics.era || data.basics.setting || data.basics.civilizationLevel) && (
        <div className="flex flex-wrap gap-2">
          {data.basics.era && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Globe className="h-3 w-3" /> {data.basics.era}
            </Badge>
          )}
          {data.basics.setting && (
            <Badge variant="secondary" className="text-xs gap-1">
              {data.basics.setting}
            </Badge>
          )}
          {data.basics.civilizationLevel && (
            <Badge variant="outline" className="text-xs">
              {data.basics.civilizationLevel}
            </Badge>
          )}
        </div>
      )}

      {/* Terminology */}
      {data.terminology?.length > 0 && (
        <Card>
          <button
            onClick={() => toggleSection('terminology')}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
          >
            {expandedSections.has('terminology') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">用語集 ({data.terminology.length})</span>
          </button>
          {expandedSections.has('terminology') && (
            <CardContent className="pt-0 space-y-2">
              {data.terminology.map((t, i) => (
                <div key={i} className="border-b border-border/50 last:border-0 pb-2 last:pb-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">{t.term}</span>
                    {t.reading && <span className="text-xs text-muted-foreground">({t.reading})</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.definition}</p>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Rules */}
      {data.rules?.length > 0 && (
        <Card>
          <button
            onClick={() => toggleSection('rules')}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
          >
            {expandedSections.has('rules') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">世界のルール ({data.rules.length})</span>
          </button>
          {expandedSections.has('rules') && (
            <CardContent className="pt-0 space-y-3">
              {data.rules.map((r, i) => (
                <div key={i} className="bg-muted/30 rounded-lg p-3">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
                  {r.constraints && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">制約: {r.constraints}</p>
                  )}
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Items */}
      {data.items?.length > 0 && (
        <Card>
          <button
            onClick={() => toggleSection('items')}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
          >
            {expandedSections.has('items') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="text-sm font-medium">重要アイテム ({data.items.length})</span>
          </button>
          {expandedSections.has('items') && (
            <CardContent className="pt-0 space-y-3">
              {data.items.map((item, i) => (
                <div key={i} className="bg-muted/30 rounded-lg p-3">
                  <p className="text-sm font-medium">{item.name}</p>
                  {item.appearance && <p className="text-xs text-muted-foreground mt-1">外見: {item.appearance}</p>}
                  {item.ability && <p className="text-xs text-muted-foreground">能力: {item.ability}</p>}
                  {item.constraints && <p className="text-xs text-yellow-600 dark:text-yellow-400">制約: {item.constraints}</p>}
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* History */}
      {data.history && (
        <Card>
          <button
            onClick={() => toggleSection('history')}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
          >
            {expandedSections.has('history') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <ScrollText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">歴史</span>
          </button>
          {expandedSections.has('history') && (
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{data.history}</p>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

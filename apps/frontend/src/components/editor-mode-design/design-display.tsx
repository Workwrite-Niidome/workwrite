'use client';

import { useState, type ReactNode } from 'react';
import {
  BookOpen, Heart, Users, Globe, Pen, Edit3,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DesignData } from './types';

interface DesignDisplayProps {
  design: DesignData;
  onChange: (partial: Partial<DesignData>) => void;
  onRequestRevision: (sectionLabel: string, context: string) => void;
  highlightedKeys: Set<string>;
}

/** Wrapper that adds a glow effect when the field key is highlighted */
function HighlightField({ fieldKey, highlightedKeys, children }: {
  fieldKey: string;
  highlightedKeys: Set<string>;
  children: ReactNode;
}) {
  const isHighlighted = highlightedKeys.has(fieldKey);
  return (
    <div
      className={cn(
        'transition-all duration-500 rounded-lg',
        isHighlighted && 'ring-2 ring-indigo-500/50 bg-indigo-500/5',
      )}
    >
      {children}
    </div>
  );
}

/** Collapsible section */
function Section({ icon: Icon, label, children, onRevise, defaultOpen = true }: {
  icon: typeof BookOpen;
  label: string;
  children: ReactNode;
  onRevise?: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <Icon className="h-4 w-4 text-indigo-500 flex-shrink-0" />
        <span className="text-sm font-medium flex-1">{label}</span>
        {onRevise && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-indigo-500"
            onClick={(e) => {
              e.stopPropagation();
              onRevise();
            }}
          >
            <Edit3 className="h-3 w-3 mr-1" />
            修正を依頼
          </Button>
        )}
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="p-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground flex-shrink-0 w-24">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

export function DesignDisplay({ design, onChange, onRequestRevision, highlightedKeys }: DesignDisplayProps) {
  return (
    <div className="space-y-4">
      {/* ─── 概要 ─── */}
      <Section
        icon={BookOpen}
        label="概要"
        onRevise={() => onRequestRevision('概要', JSON.stringify({ genre: design.genre, theme: design.theme, title: design.title }))}
      >
        <HighlightField fieldKey="title" highlightedKeys={highlightedKeys}>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">タイトル</label>
            <Input
              value={design.title || ''}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="タイトル未定"
              className="text-sm"
            />
          </div>
        </HighlightField>
        <HighlightField fieldKey="genre" highlightedKeys={highlightedKeys}>
          <FieldRow label="ジャンル" value={design.genre} />
        </HighlightField>
        <HighlightField fieldKey="theme" highlightedKeys={highlightedKeys}>
          <FieldRow label="テーマ" value={design.coreMessage || design.theme} />
        </HighlightField>
        <HighlightField fieldKey="tone" highlightedKeys={highlightedKeys}>
          <FieldRow label="トーン" value={design.tone} />
        </HighlightField>
        <HighlightField fieldKey="synopsis" highlightedKeys={highlightedKeys}>
          {design.synopsis && (
            <div className="text-sm">
              <span className="text-muted-foreground">あらすじ</span>
              <p className="mt-1 text-foreground whitespace-pre-wrap leading-relaxed">{design.synopsis}</p>
            </div>
          )}
        </HighlightField>
        <HighlightField fieldKey="episodeCount" highlightedKeys={highlightedKeys}>
          <div className="flex gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">話数</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={design.episodeCount || ''}
                onChange={(e) => onChange({ episodeCount: parseInt(e.target.value) || undefined })}
                placeholder="10"
                className="w-20 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">1話あたり文字数</label>
              <Input
                type="number"
                min={500}
                max={20000}
                step={500}
                value={design.charCountPerEpisode || ''}
                onChange={(e) => onChange({ charCountPerEpisode: parseInt(e.target.value) || undefined })}
                placeholder="3000"
                className="w-24 text-sm"
              />
            </div>
          </div>
        </HighlightField>
      </Section>

      {/* ─── 感情設計 ─── */}
      <Section
        icon={Heart}
        label="感情設計"
        onRevise={() => onRequestRevision('感情設計', JSON.stringify({ targetEmotions: design.targetEmotions, readerJourney: design.readerJourney }))}
      >
        <HighlightField fieldKey="targetEmotions" highlightedKeys={highlightedKeys}>
          <FieldRow label="読者の感情" value={design.targetEmotions || design.afterReading} />
        </HighlightField>
        <HighlightField fieldKey="readerJourney" highlightedKeys={highlightedKeys}>
          {design.readerJourney && (
            <div className="text-sm">
              <span className="text-muted-foreground">読者の旅路</span>
              <p className="mt-1 text-foreground whitespace-pre-wrap leading-relaxed">{design.readerJourney}</p>
            </div>
          )}
        </HighlightField>
        <HighlightField fieldKey="readerOneLiner" highlightedKeys={highlightedKeys}>
          <FieldRow label="一言" value={design.readerOneLiner} />
        </HighlightField>
      </Section>

      {/* ─── キャラクター ─── */}
      <Section
        icon={Users}
        label="キャラクター"
        onRevise={() => onRequestRevision('キャラクター', JSON.stringify(design.characters?.map(c => c.name)))}
      >
        <HighlightField fieldKey="characters" highlightedKeys={highlightedKeys}>
          {Array.isArray(design.characters) && design.characters.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {design.characters.map((char: any, i: number) => (
                <div key={i} className="border rounded-lg p-3 space-y-1.5 bg-background">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{char.name || `キャラ${i + 1}`}</span>
                    {char.role && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        {char.role}
                      </span>
                    )}
                    {(char.gender || char.age) && (
                      <span className="text-[10px] text-muted-foreground">
                        {[char.gender, char.age].filter(Boolean).join(' / ')}
                      </span>
                    )}
                  </div>
                  {char.appearance && <p className="text-xs text-muted-foreground">外見: {char.appearance}</p>}
                  {char.personality && <p className="text-xs text-muted-foreground">性格: {char.personality}</p>}
                  {char.speechStyle && <p className="text-xs text-muted-foreground">口調: {char.speechStyle}</p>}
                  {char.firstPerson && <p className="text-xs text-muted-foreground">一人称: {char.firstPerson}</p>}
                  {char.motivation && <p className="text-xs text-muted-foreground">動機: {char.motivation}</p>}
                  {char.background && <p className="text-xs text-muted-foreground">背景: {char.background}</p>}
                </div>
              ))}
            </div>
          ) : design.protagonist ? (
            <div className="text-sm text-muted-foreground">
              主人公: {typeof design.protagonist === 'string' ? design.protagonist : design.protagonist.name}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">まだ設定されていません</p>
          )}
        </HighlightField>
      </Section>

      {/* ─── 世界観 ─── */}
      <Section
        icon={Globe}
        label="世界観"
        onRevise={() => onRequestRevision('世界観', '')}
      >
        <HighlightField fieldKey="worldBuilding" highlightedKeys={highlightedKeys}>
          {design.worldBuilding && typeof design.worldBuilding === 'object' ? (
            <div className="space-y-2">
              {design.worldBuilding.basics?.era && <FieldRow label="時代" value={design.worldBuilding.basics.era} />}
              {design.worldBuilding.basics?.setting && <FieldRow label="舞台" value={design.worldBuilding.basics.setting} />}
              {design.worldBuilding.basics?.civilizationLevel && <FieldRow label="文明" value={design.worldBuilding.basics.civilizationLevel} />}

              {Array.isArray(design.worldBuilding.rules) && design.worldBuilding.rules.length > 0 && (
                <div className="text-sm space-y-1">
                  <span className="text-muted-foreground">ルール</span>
                  <ul className="list-disc list-inside space-y-0.5">
                    {design.worldBuilding.rules.map((r: any, i: number) => (
                      <li key={i} className="text-foreground text-xs">
                        <span className="font-medium">{r.name}</span>
                        {r.description && <span className="text-muted-foreground">: {r.description}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(design.worldBuilding.terminology) && design.worldBuilding.terminology.length > 0 && (
                <div className="text-sm space-y-1">
                  <span className="text-muted-foreground">用語</span>
                  <ul className="list-disc list-inside space-y-0.5">
                    {design.worldBuilding.terminology.map((t: any, i: number) => (
                      <li key={i} className="text-foreground text-xs">
                        <span className="font-medium">{t.term}</span>
                        {t.definition && <span className="text-muted-foreground">: {t.definition}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {design.worldBuilding.history && (
                <div className="text-sm">
                  <span className="text-muted-foreground">歴史・背景</span>
                  <p className="mt-1 text-foreground text-xs whitespace-pre-wrap">{design.worldBuilding.history}</p>
                </div>
              )}

              {Array.isArray(design.worldBuilding.items) && design.worldBuilding.items.length > 0 && (
                <div className="text-sm space-y-1">
                  <span className="text-muted-foreground">重要アイテム</span>
                  <ul className="list-disc list-inside space-y-0.5">
                    {design.worldBuilding.items.map((item: any, i: number) => (
                      <li key={i} className="text-foreground text-xs">
                        <span className="font-medium">{item.name}</span>
                        {item.description && <span className="text-muted-foreground">: {item.description}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : typeof design.worldBuilding === 'string' ? (
            <p className="text-sm text-foreground whitespace-pre-wrap">{design.worldBuilding as string}</p>
          ) : (
            <p className="text-xs text-muted-foreground italic">まだ設定されていません</p>
          )}
        </HighlightField>
      </Section>

      {/* ─── プロット ─── */}
      <Section
        icon={Pen}
        label="プロット"
        onRevise={() => onRequestRevision('プロット', '')}
      >
        <HighlightField fieldKey="structureTemplate" highlightedKeys={highlightedKeys}>
          <FieldRow label="構成" value={design.structureTemplate} />
        </HighlightField>

        <HighlightField fieldKey="actGroups" highlightedKeys={highlightedKeys}>
          {Array.isArray(design.actGroups) && design.actGroups.length > 0 ? (
            <div className="space-y-3">
              {design.actGroups.map((group: any, gi: number) => {
                const colors = ['border-blue-400', 'border-green-400', 'border-amber-400', 'border-red-400', 'border-purple-400'];
                const color = colors[gi % colors.length];
                return (
                  <div key={gi} className={cn('border-l-4 pl-3 space-y-2', color)}>
                    <p className="text-sm font-medium">{group.label || `幕${gi + 1}`}</p>
                    {Array.isArray(group.episodes) && group.episodes.length > 0 && (
                      <div className="space-y-1.5">
                        {group.episodes.map((ep: any, ei: number) => (
                          <div key={ei} className="border rounded-md p-2 bg-background">
                            <p className="text-xs font-medium">{ep.title || `第${ei + 1}話`}</p>
                            {ep.summary && <p className="text-[11px] text-muted-foreground mt-0.5">{ep.summary}</p>}
                            {ep.emotionTarget && <p className="text-[10px] text-indigo-500 mt-0.5">{ep.emotionTarget}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <HighlightField fieldKey="conflict" highlightedKeys={highlightedKeys}>
                <FieldRow label="中心的な葛藤" value={design.conflict} />
              </HighlightField>
              <HighlightField fieldKey="plotOutline" highlightedKeys={highlightedKeys}>
                {design.plotOutline && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">プロット概要</span>
                    <p className="mt-1 text-foreground whitespace-pre-wrap leading-relaxed text-xs">{design.plotOutline}</p>
                  </div>
                )}
              </HighlightField>
              {!design.conflict && !design.plotOutline && (
                <p className="text-xs text-muted-foreground italic">まだ設定されていません</p>
              )}
            </>
          )}
        </HighlightField>
      </Section>
    </div>
  );
}

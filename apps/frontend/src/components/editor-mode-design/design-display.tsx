'use client';

import { useState, type ReactNode } from 'react';
import {
  BookOpen, Heart, Users, Globe, Pen, Edit3,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { DesignData } from './types';
import type { WorldBuildingData, ActGroup } from '@/components/creation-wizard/wizard-shell';

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
  // ── Helper: update a single character field by index ──
  function updateCharacter(index: number, field: string, value: string) {
    const chars = [...(design.characters || [])];
    chars[index] = { ...chars[index], [field]: value };
    onChange({ characters: chars });
  }

  // ── Helper: update worldBuilding sub-fields ──
  function updateWorldBuilding(patch: Partial<WorldBuildingData>) {
    const wb = (design.worldBuilding && typeof design.worldBuilding === 'object')
      ? design.worldBuilding
      : { basics: { era: '', setting: '', civilizationLevel: '' }, rules: [], terminology: [], history: '', infoAsymmetry: { commonKnowledge: '', hiddenTruths: '' }, items: [] };
    onChange({ worldBuilding: { ...wb, ...patch } });
  }

  function updateWorldBuildingBasics(field: string, value: string) {
    const wb = (design.worldBuilding && typeof design.worldBuilding === 'object')
      ? design.worldBuilding
      : { basics: { era: '', setting: '', civilizationLevel: '' }, rules: [], terminology: [], history: '', infoAsymmetry: { commonKnowledge: '', hiddenTruths: '' }, items: [] };
    updateWorldBuilding({ basics: { ...wb.basics, [field]: value } });
  }

  function updateRule(index: number, field: string, value: string) {
    const wb = (design.worldBuilding && typeof design.worldBuilding === 'object') ? design.worldBuilding : null;
    if (!wb) return;
    const rules = [...(wb.rules || [])];
    rules[index] = { ...rules[index], [field]: value };
    updateWorldBuilding({ rules });
  }

  function updateTerminology(index: number, field: string, value: string) {
    const wb = (design.worldBuilding && typeof design.worldBuilding === 'object') ? design.worldBuilding : null;
    if (!wb) return;
    const terms = [...(wb.terminology || [])];
    terms[index] = { ...terms[index], [field]: value };
    updateWorldBuilding({ terminology: terms });
  }

  // ── Helper: update actGroups ──
  function updateActGroup(gi: number, field: string, value: string) {
    const groups = [...(design.actGroups || [])];
    groups[gi] = { ...groups[gi], [field]: value };
    onChange({ actGroups: groups });
  }

  function updateEpisode(gi: number, ei: number, field: string, value: string) {
    const groups = [...(design.actGroups || [])];
    const episodes = [...(groups[gi].episodes || [])];
    episodes[ei] = { ...episodes[ei], [field]: value };
    groups[gi] = { ...groups[gi], episodes };
    onChange({ actGroups: groups });
  }

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
        <HighlightField fieldKey="synopsis" highlightedKeys={highlightedKeys}>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">あらすじ</label>
            <Textarea
              value={design.synopsis || ''}
              onChange={(e) => onChange({ synopsis: e.target.value })}
              placeholder="あらすじを入力..."
              className="text-sm resize-none"
              rows={2}
            />
          </div>
        </HighlightField>
        <HighlightField fieldKey="genre" highlightedKeys={highlightedKeys}>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">ジャンル</label>
            <Input
              value={design.genre || ''}
              onChange={(e) => onChange({ genre: e.target.value })}
              placeholder="ジャンル"
              className="text-sm"
            />
          </div>
        </HighlightField>
        <HighlightField fieldKey="theme" highlightedKeys={highlightedKeys}>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">テーマ</label>
            <Input
              value={design.coreMessage || design.theme || ''}
              onChange={(e) => onChange({ coreMessage: e.target.value })}
              placeholder="テーマ・コアメッセージ"
              className="text-sm"
            />
          </div>
        </HighlightField>
        <HighlightField fieldKey="tone" highlightedKeys={highlightedKeys}>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">トーン</label>
            <Input
              value={design.tone || ''}
              onChange={(e) => onChange({ tone: e.target.value })}
              placeholder="トーン"
              className="text-sm"
            />
          </div>
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
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">読者の感情</label>
            <Input
              value={design.targetEmotions || design.afterReading || ''}
              onChange={(e) => onChange({ targetEmotions: e.target.value })}
              placeholder="読者に感じてほしい感情"
              className="text-sm"
            />
          </div>
        </HighlightField>
        <HighlightField fieldKey="readerJourney" highlightedKeys={highlightedKeys}>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">読者の旅路</label>
            <Textarea
              value={design.readerJourney || ''}
              onChange={(e) => onChange({ readerJourney: e.target.value })}
              placeholder="読者がたどる感情の旅路"
              className="text-sm resize-none"
              rows={2}
            />
          </div>
        </HighlightField>
        <HighlightField fieldKey="readerOneLiner" highlightedKeys={highlightedKeys}>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">一言</label>
            <Input
              value={design.readerOneLiner || ''}
              onChange={(e) => onChange({ readerOneLiner: e.target.value })}
              placeholder="一言で表すと..."
              className="text-sm"
            />
          </div>
        </HighlightField>
        <HighlightField fieldKey="coreMessage" highlightedKeys={highlightedKeys}>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">コアメッセージ</label>
            <Input
              value={design.coreMessage || ''}
              onChange={(e) => onChange({ coreMessage: e.target.value })}
              placeholder="作品の核となるメッセージ"
              className="text-sm"
            />
          </div>
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
                <div key={i} className="border rounded-lg p-3 space-y-2 bg-background">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">名前</label>
                      <Input
                        value={char.name || ''}
                        onChange={(e) => updateCharacter(i, 'name', e.target.value)}
                        placeholder={`キャラ${i + 1}`}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">役割</label>
                      <Input
                        value={char.role || ''}
                        onChange={(e) => updateCharacter(i, 'role', e.target.value)}
                        placeholder="主人公"
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">性別</label>
                      <Input
                        value={char.gender || ''}
                        onChange={(e) => updateCharacter(i, 'gender', e.target.value)}
                        placeholder="性別"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">年齢</label>
                      <Input
                        value={char.age || ''}
                        onChange={(e) => updateCharacter(i, 'age', e.target.value)}
                        placeholder="年齢"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">一人称</label>
                      <Input
                        value={char.firstPerson || ''}
                        onChange={(e) => updateCharacter(i, 'firstPerson', e.target.value)}
                        placeholder="僕"
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">外見</label>
                    <Textarea
                      value={char.appearance || ''}
                      onChange={(e) => updateCharacter(i, 'appearance', e.target.value)}
                      placeholder="外見の特徴"
                      className="text-sm resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">性格</label>
                    <Textarea
                      value={char.personality || ''}
                      onChange={(e) => updateCharacter(i, 'personality', e.target.value)}
                      placeholder="性格の特徴"
                      className="text-sm resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">口調</label>
                    <Textarea
                      value={char.speechStyle || ''}
                      onChange={(e) => updateCharacter(i, 'speechStyle', e.target.value)}
                      placeholder="話し方の特徴"
                      className="text-sm resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">動機</label>
                    <Textarea
                      value={char.motivation || ''}
                      onChange={(e) => updateCharacter(i, 'motivation', e.target.value)}
                      placeholder="行動の動機"
                      className="text-sm resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">背景</label>
                    <Textarea
                      value={char.background || ''}
                      onChange={(e) => updateCharacter(i, 'background', e.target.value)}
                      placeholder="バックストーリー"
                      className="text-sm resize-none"
                      rows={2}
                    />
                  </div>
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
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">時代</label>
                  <Input
                    value={design.worldBuilding.basics?.era || ''}
                    onChange={(e) => updateWorldBuildingBasics('era', e.target.value)}
                    placeholder="時代"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">舞台</label>
                  <Input
                    value={design.worldBuilding.basics?.setting || ''}
                    onChange={(e) => updateWorldBuildingBasics('setting', e.target.value)}
                    placeholder="舞台"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">文明</label>
                  <Input
                    value={design.worldBuilding.basics?.civilizationLevel || ''}
                    onChange={(e) => updateWorldBuildingBasics('civilizationLevel', e.target.value)}
                    placeholder="文明レベル"
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">歴史・背景</label>
                <Textarea
                  value={design.worldBuilding.history || ''}
                  onChange={(e) => updateWorldBuilding({ history: e.target.value })}
                  placeholder="世界の歴史や背景"
                  className="text-sm resize-none"
                  rows={2}
                />
              </div>

              {Array.isArray(design.worldBuilding.rules) && design.worldBuilding.rules.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">ルール</span>
                  {design.worldBuilding.rules.map((r: any, i: number) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded-md p-2 bg-background">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">名前</label>
                        <Input
                          value={r.name || ''}
                          onChange={(e) => updateRule(i, 'name', e.target.value)}
                          placeholder="ルール名"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">説明</label>
                        <Input
                          value={r.description || ''}
                          onChange={(e) => updateRule(i, 'description', e.target.value)}
                          placeholder="説明"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {Array.isArray(design.worldBuilding.terminology) && design.worldBuilding.terminology.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">用語</span>
                  {design.worldBuilding.terminology.map((t: any, i: number) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2 border rounded-md p-2 bg-background">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">用語</label>
                        <Input
                          value={t.term || ''}
                          onChange={(e) => updateTerminology(i, 'term', e.target.value)}
                          placeholder="用語"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">読み</label>
                        <Input
                          value={t.reading || ''}
                          onChange={(e) => updateTerminology(i, 'reading', e.target.value)}
                          placeholder="読み"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">定義</label>
                        <Input
                          value={t.definition || ''}
                          onChange={(e) => updateTerminology(i, 'definition', e.target.value)}
                          placeholder="定義"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ))}
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
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">構成</label>
            <Input
              value={design.structureTemplate || ''}
              onChange={(e) => onChange({ structureTemplate: e.target.value })}
              placeholder="構成テンプレート"
              className="text-sm"
            />
          </div>
        </HighlightField>

        <HighlightField fieldKey="actGroups" highlightedKeys={highlightedKeys}>
          {Array.isArray(design.actGroups) && design.actGroups.length > 0 ? (
            <div className="space-y-3">
              {design.actGroups.map((group: any, gi: number) => {
                const colors = ['border-blue-400', 'border-green-400', 'border-amber-400', 'border-red-400', 'border-purple-400'];
                const color = colors[gi % colors.length];
                return (
                  <div key={gi} className={cn('border-l-4 pl-3 space-y-2', color)}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">幕ラベル</label>
                        <Input
                          value={group.label || ''}
                          onChange={(e) => updateActGroup(gi, 'label', e.target.value)}
                          placeholder={`幕${gi + 1}`}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">説明</label>
                        <Input
                          value={group.description || ''}
                          onChange={(e) => updateActGroup(gi, 'description', e.target.value)}
                          placeholder="幕の説明"
                          className="text-sm"
                        />
                      </div>
                    </div>
                    {Array.isArray(group.episodes) && group.episodes.length > 0 && (
                      <div className="space-y-2">
                        {group.episodes.map((ep: any, ei: number) => (
                          <div key={ei} className="border rounded-md p-2 bg-background space-y-1.5">
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">タイトル</label>
                              <Input
                                value={ep.title || ''}
                                onChange={(e) => updateEpisode(gi, ei, 'title', e.target.value)}
                                placeholder={`第${ei + 1}話`}
                                className="text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">内容</label>
                              <Textarea
                                value={ep.summary || ep.whatHappens || ''}
                                onChange={(e) => updateEpisode(gi, ei, ep.summary !== undefined ? 'summary' : 'whatHappens', e.target.value)}
                                placeholder="何が起こるか"
                                className="text-sm resize-none"
                                rows={2}
                              />
                            </div>
                            {ep.emotionTarget && (
                              <p className="text-[10px] text-indigo-500">{ep.emotionTarget}</p>
                            )}
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
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">中心的な葛藤</label>
                  <Textarea
                    value={design.conflict || ''}
                    onChange={(e) => onChange({ conflict: e.target.value })}
                    placeholder="物語の中心的な葛藤"
                    className="text-sm resize-none"
                    rows={2}
                  />
                </div>
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

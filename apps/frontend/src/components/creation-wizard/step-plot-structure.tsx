'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Sparkles, Plus, Trash2, ChevronDown, ChevronRight, GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { WizardData, ActGroup, EpisodeCard } from './wizard-shell';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

// ─── Structure Templates ────────────────────────────────────

interface StructureTemplate {
  key: string;
  label: string;
  description: string;
  groups: { label: string; description: string }[];
}

const STRUCTURE_TEMPLATES: StructureTemplate[] = [
  {
    key: 'kishotenketsu',
    label: '起承転結',
    description: '日本の伝統的な四部構成',
    groups: [
      { label: '起', description: '物語の導入・登場人物と世界観の提示' },
      { label: '承', description: '物語の展開・問題の発展' },
      { label: '転', description: '物語の転換・予想外の展開' },
      { label: '結', description: '物語の結末・解決と余韻' },
    ],
  },
  {
    key: 'jo-ha-kyu',
    label: '序破急',
    description: '能楽由来の三部構成',
    groups: [
      { label: '序', description: '静かな導入・世界への引き込み' },
      { label: '破', description: '展開と加速・対立と変化' },
      { label: '急', description: '急展開とクライマックス・結末' },
    ],
  },
  {
    key: 'three-act',
    label: '三幕構成',
    description: 'ハリウッド式の三幕構成',
    groups: [
      { label: '第一幕', description: 'セットアップ：主人公と世界、切っ掛けとなる事件' },
      { label: '第二幕', description: 'コンフロンテーション：試練と障害、ミッドポイント' },
      { label: '第三幕', description: 'レゾリューション：クライマックスと解決' },
    ],
  },
  {
    key: 'beat-sheet',
    label: 'ビートシート',
    description: 'Blake Snyder式の15ビート',
    groups: [
      { label: 'Opening Image', description: '冒頭のイメージ' },
      { label: 'Theme Stated', description: 'テーマの提示' },
      { label: 'Set-Up', description: '主人公の日常' },
      { label: 'Catalyst', description: 'きっかけとなる事件' },
      { label: 'Debate', description: '躊躇と葛藤' },
      { label: 'Break into Two', description: '新世界への旅立ち' },
      { label: 'B Story', description: 'サブプロット開始' },
      { label: 'Fun and Games', description: '新世界での冒険' },
      { label: 'Midpoint', description: '物語の転換点' },
      { label: 'Bad Guys Close In', description: '困難の増大' },
      { label: 'All Is Lost', description: '最大の危機' },
      { label: 'Dark Night of the Soul', description: '絶望の時' },
      { label: 'Break into Three', description: '解決への道' },
      { label: 'Finale', description: 'クライマックス' },
      { label: 'Final Image', description: '結末のイメージ' },
    ],
  },
  {
    key: 'free',
    label: '自由',
    description: '自分だけの構成で',
    groups: [
      { label: 'パート1', description: '' },
    ],
  },
];

// ─── Helpers ────────────────────────────────────────────────

function createEpisodeCard(overrides?: Partial<EpisodeCard>): EpisodeCard {
  return {
    id: crypto.randomUUID(),
    title: '',
    whatHappens: '',
    whyItHappens: '',
    characters: [],
    emotionTarget: '',
    aiSuggested: false,
    ...overrides,
  };
}

function createActGroups(template: StructureTemplate): ActGroup[] {
  return template.groups.map((g) => ({
    id: crypto.randomUUID(),
    label: g.label,
    description: g.description,
    episodes: [],
  }));
}

// Group border colors by index
const GROUP_COLORS = [
  'border-l-blue-500',
  'border-l-emerald-500',
  'border-l-amber-500',
  'border-l-rose-500',
  'border-l-purple-500',
  'border-l-cyan-500',
  'border-l-orange-500',
  'border-l-pink-500',
  'border-l-teal-500',
  'border-l-indigo-500',
  'border-l-lime-500',
  'border-l-fuchsia-500',
  'border-l-sky-500',
  'border-l-violet-500',
  'border-l-red-500',
];

// ─── Sortable Episode Card ─────────────────────────────────

function SortableEpisodeItem({
  episode,
  onUpdate,
  onRemove,
  characterNames,
}: {
  episode: EpisodeCard;
  onUpdate: (field: keyof EpisodeCard, value: any) => void;
  onRemove: () => void;
  characterNames: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: episode.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border border-border rounded-lg bg-background',
        episode.aiSuggested && 'border-blue-200 dark:border-blue-800/50',
      )}
    >
      <div className="flex items-center gap-1.5 p-2">
        <button {...attributes} {...listeners} className="cursor-grab touch-none p-1 text-muted-foreground/40 hover:text-muted-foreground">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left flex items-center gap-1.5 min-w-0"
        >
          {expanded
            ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          }
          <span className="text-sm truncate">
            {episode.title || '（タイトル未入力）'}
          </span>
          {episode.aiSuggested && <span className="text-[10px] text-blue-500 flex-shrink-0">(AI)</span>}
        </button>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive p-1 flex-shrink-0">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/50">
          <div className="pt-2">
            <label className="text-[10px] text-muted-foreground">エピソードタイトル</label>
            <Input
              value={episode.title}
              onChange={(e) => onUpdate('title', e.target.value)}
              placeholder="タイトル"
              className="h-7 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">何が起きるか</label>
            <Textarea
              value={episode.whatHappens}
              onChange={(e) => onUpdate('whatHappens', e.target.value)}
              placeholder="このエピソードで起きる出来事"
              rows={2} className="text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">なぜ起きるか</label>
            <Textarea
              value={episode.whyItHappens}
              onChange={(e) => onUpdate('whyItHappens', e.target.value)}
              placeholder="この展開の理由・動機"
              rows={2} className="text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">登場キャラクター</label>
            {characterNames.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {characterNames.map((name) => {
                  const selected = episode.characters.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? episode.characters.filter((n) => n !== name)
                          : [...episode.characters, name];
                        onUpdate('characters', next);
                      }}
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] border transition-colors',
                        selected
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/30',
                      )}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <Input
                value={episode.characters.join(', ')}
                onChange={(e) => onUpdate('characters', e.target.value.split(/[,、]\s*/).filter(Boolean))}
                placeholder="キャラクター名（カンマ区切り）"
                className="h-7 text-xs"
              />
            )}
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">感情目標</label>
            <Input
              value={episode.emotionTarget || ''}
              onChange={(e) => onUpdate('emotionTarget', e.target.value)}
              placeholder="例：不安から希望へ"
              className="h-7 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export function StepPlotStructure({ data, onChange }: Props) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [aiLoading, setAiLoading] = useState<string | null>(null); // groupId or null

  const template = data.structureTemplate || 'kishotenketsu';
  const actGroups = data.actGroups || [];
  const characterNames = (data.characters || []).map((c: any) => c.name).filter(Boolean);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ─── Template selection ───────────────────────────────────

  function selectTemplate(key: string) {
    const tmpl = STRUCTURE_TEMPLATES.find((t) => t.key === key);
    if (!tmpl) return;
    // Only reset groups if changing template and current groups are empty
    const hasContent = actGroups.some((g) => g.episodes.length > 0);
    if (hasContent && key !== template) {
      // Confirm before losing data
      if (!window.confirm('構成テンプレートを変更すると、現在のグループ構成がリセットされます。よろしいですか？')) {
        return;
      }
    }
    const newGroups = createActGroups(tmpl);
    onChange({ structureTemplate: key, actGroups: newGroups });
  }

  // Initialize groups if empty
  if (actGroups.length === 0) {
    const tmpl = STRUCTURE_TEMPLATES.find((t) => t.key === template) || STRUCTURE_TEMPLATES[0];
    const initial = createActGroups(tmpl);
    // Use setTimeout to avoid setState during render
    setTimeout(() => onChange({ actGroups: initial }), 0);
  }

  // ─── Group operations ─────────────────────────────────────

  function toggleGroup(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function addEpisode(groupId: string) {
    const updated = actGroups.map((g) =>
      g.id === groupId ? { ...g, episodes: [...g.episodes, createEpisodeCard()] } : g
    );
    onChange({ actGroups: updated });
  }

  function updateEpisode(groupId: string, episodeId: string, field: keyof EpisodeCard, value: any) {
    const updated = actGroups.map((g) =>
      g.id === groupId
        ? { ...g, episodes: g.episodes.map((ep) => ep.id === episodeId ? { ...ep, [field]: value } : ep) }
        : g
    );
    onChange({ actGroups: updated });
  }

  function removeEpisode(groupId: string, episodeId: string) {
    const updated = actGroups.map((g) =>
      g.id === groupId ? { ...g, episodes: g.episodes.filter((ep) => ep.id !== episodeId) } : g
    );
    onChange({ actGroups: updated });
  }

  function addGroup() {
    const newGroup: ActGroup = {
      id: crypto.randomUUID(),
      label: `パート${actGroups.length + 1}`,
      description: '',
      episodes: [],
    };
    onChange({ actGroups: [...actGroups, newGroup] });
  }

  function removeGroup(groupId: string) {
    const group = actGroups.find((g) => g.id === groupId);
    if (group && group.episodes.length > 0) {
      if (!window.confirm(`「${group.label}」にはエピソードがあります。削除しますか？`)) return;
    }
    onChange({ actGroups: actGroups.filter((g) => g.id !== groupId) });
  }

  function updateGroupLabel(groupId: string, label: string) {
    const updated = actGroups.map((g) => g.id === groupId ? { ...g, label } : g);
    onChange({ actGroups: updated });
  }

  // ─── Drag & Drop ──────────────────────────────────────────

  const allEpisodeIds = actGroups.flatMap((g) => g.episodes.map((ep) => ep.id));

  function findGroupByEpisodeId(episodeId: string): string | null {
    for (const g of actGroups) {
      if (g.episodes.some((ep) => ep.id === episodeId)) return g.id;
    }
    return null;
  }

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeGroupId = findGroupByEpisodeId(active.id as string);
    let overGroupId = findGroupByEpisodeId(over.id as string);

    // If dropping over a group header (not an episode), use that group
    if (!overGroupId) {
      overGroupId = actGroups.find((g) => g.id === over.id)?.id || null;
    }

    if (!activeGroupId || !overGroupId || activeGroupId === overGroupId) return;

    // Move episode between groups
    const activeEp = actGroups
      .find((g) => g.id === activeGroupId)
      ?.episodes.find((ep) => ep.id === active.id);
    if (!activeEp) return;

    const updated = actGroups.map((g) => {
      if (g.id === activeGroupId) {
        return { ...g, episodes: g.episodes.filter((ep) => ep.id !== active.id) };
      }
      if (g.id === overGroupId) {
        const overIndex = g.episodes.findIndex((ep) => ep.id === over.id);
        const newEps = [...g.episodes];
        if (overIndex >= 0) {
          newEps.splice(overIndex, 0, activeEp);
        } else {
          newEps.push(activeEp);
        }
        return { ...g, episodes: newEps };
      }
      return g;
    });
    onChange({ actGroups: updated });
  }, [actGroups, onChange]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const groupId = findGroupByEpisodeId(active.id as string);
    if (!groupId) return;

    const group = actGroups.find((g) => g.id === groupId);
    if (!group) return;

    const oldIndex = group.episodes.findIndex((ep) => ep.id === active.id);
    const newIndex = group.episodes.findIndex((ep) => ep.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newEps = [...group.episodes];
    const [moved] = newEps.splice(oldIndex, 1);
    newEps.splice(newIndex, 0, moved);

    const updated = actGroups.map((g) => g.id === groupId ? { ...g, episodes: newEps } : g);
    onChange({ actGroups: updated });
  }, [actGroups, onChange]);

  // ─── AI Episode Generation ────────────────────────────────

  async function handleAiSuggestForAct(groupId: string) {
    const group = actGroups.find((g) => g.id === groupId);
    if (!group) return;

    setAiLoading(groupId);
    try {
      const context: string[] = [];
      if (data.genre) context.push(`ジャンル: ${data.genre}`);
      if (data.coreMessage) context.push(`テーマ: ${data.coreMessage}`);
      if (data.inspiration) context.push(`インスピレーション: ${data.inspiration}`);
      if (data.characters.length > 0) {
        const charInfo = data.characters.map((c: any) =>
          `${c.name}(${c.role || ''}) - ${c.personality || ''}`
        ).join('\n');
        context.push(`キャラクター:\n${charInfo}`);
      }

      // Include existing plot context
      const existingPlot = actGroups.map((g) => {
        const eps = g.episodes.map((ep) => `  - ${ep.title}: ${ep.whatHappens}`).join('\n');
        return `${g.label}: ${g.description}\n${eps || '  （まだエピソードなし）'}`;
      }).join('\n');
      context.push(`構成（${STRUCTURE_TEMPLATES.find(t => t.key === template)?.label || template}）:\n${existingPlot}`);
      context.push(`\n対象セクション: 「${group.label}」（${group.description}）`);

      const res = await api.fetchSSE('/works/none/creation/episodes-for-act', {
        actLabel: group.label,
        actDescription: group.description,
        context: context.join('\n\n'),
        structureTemplate: template,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let serverParsed: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') continue;
          try {
            const event = JSON.parse(d);
            if (event.text) accumulated += event.text;
            if (event.parsed) serverParsed = event.parsed;
          } catch { /* skip */ }
        }
      }

      // Parse episodes from response
      let episodes: EpisodeCard[] = [];
      const parsed = serverParsed || parseEpisodesJson(accumulated);
      if (parsed?.episodes) {
        episodes = parsed.episodes.map((ep: any) => createEpisodeCard({
          title: ep.title || '',
          whatHappens: ep.whatHappens || ep.summary || '',
          whyItHappens: ep.whyItHappens || ep.reason || '',
          characters: ep.characters || [],
          emotionTarget: ep.emotionTarget || '',
          aiSuggested: true,
        }));
      }

      if (episodes.length > 0) {
        const updated = actGroups.map((g) =>
          g.id === groupId ? { ...g, episodes: [...g.episodes, ...episodes] } : g
        );
        onChange({ actGroups: updated });
      }
    } catch (err) {
      console.error('AI episode generation failed:', err);
    } finally {
      setAiLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">プロット構成</h2>
        <p className="text-sm text-muted-foreground">
          構成テンプレートを選び、各セクションにエピソードカードを配置して物語の骨格を組み立てましょう。
          カードはドラッグで並び替え・セクション間移動ができます。
        </p>
      </div>

      {/* Template selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">構成テンプレート</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {STRUCTURE_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.key}
              type="button"
              onClick={() => selectTemplate(tmpl.key)}
              className={cn(
                'p-3 rounded-lg border text-left transition-colors',
                template === tmpl.key
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30',
              )}
            >
              <p className="text-sm font-medium">{tmpl.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{tmpl.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Act groups with episodes */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          {actGroups.map((group, gi) => {
            const isCollapsed = collapsedGroups.has(group.id);
            const colorClass = GROUP_COLORS[gi % GROUP_COLORS.length];

            return (
              <div key={group.id} className={cn('border-l-4 rounded-lg border border-border', colorClass)}>
                {/* Group header */}
                <div className="flex items-center gap-2 p-3">
                  <button type="button" onClick={() => toggleGroup(group.id)} className="flex-shrink-0">
                    {isCollapsed
                      ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    }
                  </button>
                  <Input
                    value={group.label}
                    onChange={(e) => updateGroupLabel(group.id, e.target.value)}
                    className="h-7 text-sm font-medium border-none bg-transparent p-0 focus-visible:ring-0 max-w-[150px]"
                  />
                  <span className="text-[10px] text-muted-foreground flex-1 truncate">{group.description}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {group.episodes.length}話
                  </span>
                  {template === 'free' && (
                    <button onClick={() => removeGroup(group.id)} className="text-muted-foreground hover:text-destructive p-1 flex-shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Episodes */}
                {!isCollapsed && (
                  <div className="px-3 pb-3 space-y-2">
                    <SortableContext
                      items={group.episodes.map((ep) => ep.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {group.episodes.map((ep) => (
                        <SortableEpisodeItem
                          key={ep.id}
                          episode={ep}
                          characterNames={characterNames}
                          onUpdate={(field, value) => updateEpisode(group.id, ep.id, field, value)}
                          onRemove={() => removeEpisode(group.id, ep.id)}
                        />
                      ))}
                    </SortableContext>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => addEpisode(group.id)} className="gap-1 text-xs">
                        <Plus className="h-3 w-3" />
                        エピソード追加
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAiSuggestForAct(group.id)}
                        disabled={aiLoading !== null}
                        className="gap-1 text-xs"
                      >
                        <Sparkles className="h-3 w-3" />
                        {aiLoading === group.id ? '考え中...' : 'AIに提案'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DndContext>

      {template === 'free' && (
        <Button variant="outline" size="sm" onClick={addGroup} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          セクション追加
        </Button>
      )}
    </div>
  );
}

// ─── JSON Parser ────────────────────────────────────────────

function parseEpisodesJson(raw: string): { episodes: any[] } | null {
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const json = JSON.parse(cleaned.slice(start, end + 1));
      if (json.episodes && Array.isArray(json.episodes)) return json;
    }
  } catch { /* next */ }
  try {
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd > arrStart) {
      const arr = JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
      if (Array.isArray(arr) && arr.length > 0) return { episodes: arr };
    }
  } catch { /* skip */ }
  return null;
}

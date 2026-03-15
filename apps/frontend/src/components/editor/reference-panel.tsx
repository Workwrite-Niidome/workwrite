'use client';

import { useState, useEffect } from 'react';
import { X, Users, Map, Globe, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface Props {
  workId: string;
  onClose: () => void;
}

interface CreationPlan {
  characters?: any[];
  plotOutline?: any;
  emotionBlueprint?: any;
  chapterOutline?: any[];
  worldBuildingData?: any;
}

export function ReferencePanel({ workId, onClose }: Props) {
  const [plan, setPlan] = useState<CreationPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState<string>('characters');

  useEffect(() => {
    api.getCreationPlan(workId)
      .then((res) => setPlan(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workId]);

  const characters = plan?.characters || [];
  const plotOutline = plan?.plotOutline;
  const wb = plan?.worldBuildingData;

  // Parse actGroups from structured plot
  const actGroups = plotOutline?.type === 'structured' ? plotOutline.actGroups || [] : [];
  const legacyPlot = !actGroups.length && plotOutline
    ? (typeof plotOutline === 'string' ? plotOutline : plotOutline?.text || '')
    : '';

  function toggleSection(key: string) {
    setOpenSection(openSection === key ? '' : key);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b flex-shrink-0">
        <h3 className="text-sm font-medium">参照パネル</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-xs text-muted-foreground">読み込み中...</div>
        ) : !plan ? (
          <div className="p-4 text-xs text-muted-foreground">
            この作品にはCreation Planがありません。
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Characters */}
            {characters.length > 0 && (
              <SectionWrapper
                icon={Users}
                title={`キャラクター (${characters.length})`}
                isOpen={openSection === 'characters'}
                onToggle={() => toggleSection('characters')}
              >
                <div className="space-y-2">
                  {characters.map((c: any, i: number) => (
                    <div key={i} className="p-2 bg-muted/30 rounded">
                      <p className="text-xs font-medium">{c.name}{c.role && ` (${c.role})`}</p>
                      {c.personality && <p className="text-[10px] text-muted-foreground">性格: {c.personality}</p>}
                      {c.speechStyle && <p className="text-[10px] text-muted-foreground">口調: {c.speechStyle}</p>}
                      {c.firstPerson && <p className="text-[10px] text-muted-foreground">一人称: {c.firstPerson}</p>}
                      {c.motivation && <p className="text-[10px] text-muted-foreground">動機: {c.motivation}</p>}
                    </div>
                  ))}
                </div>
              </SectionWrapper>
            )}

            {/* Plot */}
            {(actGroups.length > 0 || legacyPlot) && (
              <SectionWrapper
                icon={Map}
                title="プロット"
                isOpen={openSection === 'plot'}
                onToggle={() => toggleSection('plot')}
              >
                {actGroups.length > 0 ? (
                  <div className="space-y-2">
                    {actGroups.map((group: any) => (
                      <div key={group.id}>
                        <p className="text-xs font-medium">{group.label}</p>
                        {group.description && <p className="text-[10px] text-muted-foreground mb-1">{group.description}</p>}
                        {group.episodes?.map((ep: any) => (
                          <div key={ep.id} className="ml-2 p-1.5 border-l-2 border-primary/20 space-y-0.5">
                            <p className="text-[10px] font-medium">{ep.title || '（無題）'}</p>
                            {ep.whatHappens && <p className="text-[10px] text-muted-foreground">{ep.whatHappens}</p>}
                            {ep.whyItHappens && <p className="text-[10px] text-muted-foreground/70">理由: {ep.whyItHappens}</p>}
                            {ep.characters?.length > 0 && <p className="text-[10px] text-muted-foreground/70">登場: {ep.characters.join('、')}</p>}
                            {ep.emotionTarget && <p className="text-[10px] text-muted-foreground/70">感情: {ep.emotionTarget}</p>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs whitespace-pre-wrap text-muted-foreground">{legacyPlot}</p>
                )}
              </SectionWrapper>
            )}

            {/* World Building */}
            {wb && (wb.basics?.era || wb.basics?.setting || wb.rules?.length > 0 || wb.terminology?.length > 0) && (
              <SectionWrapper
                icon={Globe}
                title="世界観"
                isOpen={openSection === 'world'}
                onToggle={() => toggleSection('world')}
              >
                <div className="space-y-1.5">
                  {wb.basics?.era && <p className="text-[10px]"><span className="text-muted-foreground">時代:</span> {wb.basics.era}</p>}
                  {wb.basics?.setting && <p className="text-[10px]"><span className="text-muted-foreground">舞台:</span> {wb.basics.setting}</p>}
                  {wb.rules?.map((r: any, i: number) => (
                    <div key={i} className="p-1.5 bg-muted/30 rounded">
                      <p className="text-[10px] font-medium">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground">{r.description}</p>
                    </div>
                  ))}
                  {wb.terminology?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium mb-1">用語集</p>
                      {wb.terminology.map((t: any, i: number) => (
                        <p key={i} className="text-[10px] text-muted-foreground">
                          <span className="font-medium text-foreground">{t.term}</span>
                          {t.reading && `（${t.reading}）`}: {t.definition}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </SectionWrapper>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionWrapper({
  icon: Icon,
  title,
  isOpen,
  onToggle,
  children,
}: {
  icon: typeof Users;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/30 transition-colors"
      >
        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{title}</span>
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

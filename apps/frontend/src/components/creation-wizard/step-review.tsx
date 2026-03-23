'use client';

import { BookOpen, Heart, Users, Map, List, Globe, Sparkles } from 'lucide-react';
import { GENRE_LABELS } from '@/lib/constants';
import type { WizardData } from './wizard-shell';

interface Props {
  data: WizardData;
}

const TEMPLATE_LABELS: Record<string, string> = {
  'kishotenketsu': '起承転結',
  'jo-ha-kyu': '序破急',
  'three-act': '三幕構成',
  'beat-sheet': 'ビートシート',
  'free': '自由',
};

function Section({ icon: Icon, title, children }: { icon: typeof BookOpen; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium flex items-center gap-1.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h3>
      <div className="p-3 bg-muted/50 rounded-lg text-sm">{children}</div>
    </div>
  );
}

export function StepReview({ data }: Props) {
  const characters = (data.characters || []) as { name: string; role: string; description?: string; personality?: string }[];
  const actGroups = data.actGroups || [];
  const wb = data.worldBuilding;
  const hasWorldBuilding = wb && (
    wb.basics.era || wb.basics.setting || wb.rules.length > 0 ||
    wb.terminology.length > 0 || wb.history || wb.items.length > 0
  );

  // Legacy plot support
  const legacyPlotText = !actGroups.length && data.plotOutline
    ? (typeof data.plotOutline === 'string' ? data.plotOutline : data.plotOutline?.text || '')
    : '';
  const legacyChapters = !actGroups.length ? (data.chapterOutline || []) as { title: string; summary: string }[] : [];

  const totalEpisodes = actGroups.reduce((sum, g) => sum + g.episodes.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">確認</h2>
        <p className="text-sm text-muted-foreground">
          設定内容を確認して、作品を作成しましょう。作成後も編集できます。
        </p>
      </div>

      {/* Title & Synopsis */}
      <Section icon={BookOpen} title="基本情報">
        <div className="space-y-1">
          <p><span className="text-muted-foreground">タイトル:</span> {data.title || '（未入力）'}</p>
          {data.synopsis && <p><span className="text-muted-foreground">あらすじ:</span> {data.synopsis}</p>}
          {data.genre && <p><span className="text-muted-foreground">ジャンル:</span> {GENRE_LABELS[data.genre] || data.genre}</p>}
          {data.tags && <p><span className="text-muted-foreground">タグ:</span> {data.tags}</p>}
        </div>
      </Section>

      {/* Emotion Blueprint */}
      {(data.coreMessage || data.targetEmotions || data.readerJourney || data.inspiration || data.readerOneLiner) && (
        <Section icon={Heart} title="想いを込める">
          <div className="space-y-1">
            {data.coreMessage && <p><span className="text-muted-foreground">伝えたいこと:</span> {data.coreMessage}</p>}
            {data.targetEmotions && <p><span className="text-muted-foreground">読者に感じてほしい感情:</span> {data.targetEmotions}</p>}
            {data.readerJourney && <p><span className="text-muted-foreground">読者の旅路:</span> {data.readerJourney}</p>}
            {data.inspiration && <p><span className="text-muted-foreground">インスピレーション:</span> {data.inspiration}</p>}
            {data.readerOneLiner && <p><span className="text-muted-foreground">読者の一言:</span> {data.readerOneLiner}</p>}
          </div>
        </Section>
      )}

      {/* Characters */}
      {characters.length > 0 && (
        <Section icon={Users} title={`キャラクター（${characters.length}人）`}>
          <div className="space-y-2">
            {characters.map((c, i) => (
              <div key={i}>
                <p className="font-medium">{c.name || `キャラクター ${i + 1}`}{c.role && ` — ${c.role}`}</p>
                {(c.personality || c.description) && (
                  <p className="text-muted-foreground text-xs">{c.personality || c.description}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* World Building */}
      {hasWorldBuilding && (
        <Section icon={Globe} title="世界観">
          <div className="space-y-1">
            {wb.basics.era && <p><span className="text-muted-foreground">時代:</span> {wb.basics.era}</p>}
            {wb.basics.setting && <p><span className="text-muted-foreground">舞台:</span> {wb.basics.setting}</p>}
            {wb.basics.civilizationLevel && <p><span className="text-muted-foreground">文明レベル:</span> {wb.basics.civilizationLevel}</p>}
            {wb.rules.length > 0 && <p><span className="text-muted-foreground">ルール:</span> {wb.rules.map(r => r.name).filter(Boolean).join(', ')}</p>}
            {wb.terminology.length > 0 && <p><span className="text-muted-foreground">用語:</span> {wb.terminology.map(t => t.term).filter(Boolean).join(', ')}</p>}
            {wb.items.length > 0 && <p><span className="text-muted-foreground">アイテム:</span> {wb.items.map(item => item.name).filter(Boolean).join(', ')}</p>}
          </div>
        </Section>
      )}

      {/* Plot Structure (new format) */}
      {actGroups.length > 0 && totalEpisodes > 0 && (
        <Section icon={Map} title={`プロット構成（${TEMPLATE_LABELS[data.structureTemplate] || data.structureTemplate}・${totalEpisodes}話）`}>
          <div className="space-y-2">
            {actGroups.map((group) => (
              <div key={group.id}>
                <p className="font-medium text-xs">{group.label}</p>
                {group.episodes.map((ep, j) => (
                  <div key={ep.id} className="ml-3 flex gap-2 text-xs text-muted-foreground">
                    <span className="w-8 flex-shrink-0">第{j + 1}話</span>
                    <span>{ep.title || '（タイトル未設定）'}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Legacy plot support */}
      {legacyPlotText && (
        <Section icon={Map} title="プロット">
          <p className="whitespace-pre-wrap">{legacyPlotText}</p>
        </Section>
      )}

      {legacyChapters.length > 0 && (
        <Section icon={List} title={`章立て（${legacyChapters.length}話）`}>
          <div className="space-y-1">
            {legacyChapters.map((ch, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-muted-foreground text-xs w-10 flex-shrink-0">第{i + 1}話</span>
                <div>
                  <span className="font-medium">{ch.title || '（タイトル未設定）'}</span>
                  {ch.summary && <span className="text-muted-foreground text-xs ml-2">{ch.summary}</span>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!data.title.trim() && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800/50">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
            タイトルが未入力です。前のステップに戻ってタイトルを入力してください。
          </p>
        </div>
      )}

      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground leading-relaxed">
          「作品を作成」を押すと、この設定をもとに作品が作成されます。
          プロット構成がある場合、各エピソードが下書きとして準備されます。
          すべての内容は作成後にいつでも変更できます。
        </p>
      </div>
    </div>
  );
}

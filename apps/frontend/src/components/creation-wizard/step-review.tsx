'use client';

import { BookOpen, Heart, Users, Map, List } from 'lucide-react';
import type { WizardData } from './wizard-shell';

interface Props {
  data: WizardData;
}

const GENRE_LABELS: Record<string, string> = {
  fantasy: 'ファンタジー', sf: 'SF', mystery: 'ミステリー', romance: '恋愛',
  horror: 'ホラー', literary: '文芸', adventure: '冒険', comedy: 'コメディ',
  drama: 'ドラマ', historical: '歴史', other: 'その他',
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
  const characters = (data.characters || []) as { name: string; role: string; description: string }[];
  const chapters = (data.chapterOutline || []) as { title: string; summary: string }[];
  const plotText = typeof data.plotOutline === 'string'
    ? data.plotOutline
    : data.plotOutline?.text || '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">確認</h2>
        <p className="text-sm text-muted-foreground">
          設定内容を確認して、作品を作成しましょう。作成後も編集できます。
        </p>
      </div>

      <Section icon={BookOpen} title="基本情報">
        <div className="space-y-1">
          <p><span className="text-muted-foreground">タイトル:</span> {data.title || '（未入力）'}</p>
          {data.synopsis && <p><span className="text-muted-foreground">あらすじ:</span> {data.synopsis}</p>}
          {data.genre && <p><span className="text-muted-foreground">ジャンル:</span> {GENRE_LABELS[data.genre] || data.genre}</p>}
          {data.tags && <p><span className="text-muted-foreground">タグ:</span> {data.tags}</p>}
        </div>
      </Section>

      {(data.coreMessage || data.targetEmotions || data.readerJourney) && (
        <Section icon={Heart} title="想いを込める">
          <div className="space-y-1">
            {data.coreMessage && <p><span className="text-muted-foreground">伝えたいこと:</span> {data.coreMessage}</p>}
            {data.targetEmotions && <p><span className="text-muted-foreground">読者に感じてほしい感情:</span> {data.targetEmotions}</p>}
            {data.readerJourney && <p><span className="text-muted-foreground">読者の旅路:</span> {data.readerJourney}</p>}
          </div>
        </Section>
      )}

      {characters.length > 0 && (
        <Section icon={Users} title={`キャラクター（${characters.length}人）`}>
          <div className="space-y-2">
            {characters.map((c, i) => (
              <div key={i}>
                <p className="font-medium">{c.name || `キャラクター ${i + 1}`}{c.role && ` — ${c.role}`}</p>
                {c.description && <p className="text-muted-foreground text-xs">{c.description}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {plotText && (
        <Section icon={Map} title="プロット">
          <p className="whitespace-pre-wrap">{plotText}</p>
        </Section>
      )}

      {chapters.length > 0 && (
        <Section icon={List} title={`章立て（${chapters.length}話）`}>
          <div className="space-y-1">
            {chapters.map((ch, i) => (
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

      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground leading-relaxed">
          「作品を作成」を押すと、この設定をもとに作品が作成されます。
          章立てがある場合、各章がエピソードの下書きとして準備されます。
          すべての内容は作成後にいつでも変更できます。
        </p>
      </div>
    </div>
  );
}

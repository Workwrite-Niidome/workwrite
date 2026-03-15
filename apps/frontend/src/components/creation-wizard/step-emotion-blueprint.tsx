'use client';

import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { WizardData } from './wizard-shell';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

const MODES = [
  { key: 'recommended' as const, label: '伝えたいことから', description: 'テーマや感情を中心に設計' },
  { key: 'alternative' as const, label: '別の角度から', description: 'インスピレーションや直感から入る' },
  { key: 'skip' as const, label: '後で考える', description: '今はスキップして先に進む' },
];

export function StepEmotionBlueprint({ data, onChange }: Props) {
  const mode = data.emotionMode || 'recommended';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">想いを込める</h2>
        <p className="text-sm text-muted-foreground">
          あなたがこの物語で何を表現し、読者にどんな感情の変化を届けたいのか。
          ここに書く言葉が作品の魂になります。
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange({ emotionMode: m.key })}
            className={cn(
              'flex-1 py-2 px-3 rounded-md text-xs transition-colors text-center',
              mode === m.key
                ? 'bg-background shadow-sm font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="block">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Recommended mode (original) */}
      {mode === 'recommended' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">あなたが伝えたいこと</label>
            <p className="text-xs text-muted-foreground">この作品を通じて何を表現したいですか？どんなメッセージを届けたいですか？</p>
            <Textarea
              value={data.coreMessage}
              onChange={(e) => onChange({ coreMessage: e.target.value })}
              rows={4}
              placeholder="例：どんなに孤独でも、自分を信じ続ける勇気があれば道は開ける"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">読者に感じてほしい感情</label>
            <p className="text-xs text-muted-foreground">読者のどんな感情を揺さぶりたいですか？</p>
            <Textarea
              value={data.targetEmotions}
              onChange={(e) => onChange({ targetEmotions: e.target.value })}
              rows={3}
              placeholder="例：序盤で不安と孤独、中盤で小さな希望、終盤で涙と共に温かい気持ち"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">読者の旅路</label>
            <p className="text-xs text-muted-foreground">読み終えた後、読者にどう変わっていてほしいですか？</p>
            <Textarea
              value={data.readerJourney}
              onChange={(e) => onChange({ readerJourney: e.target.value })}
              rows={3}
              placeholder="例：自分の弱さを受け入れて、それでも前に進もうと思えるようになってほしい"
            />
          </div>
        </div>
      )}

      {/* Alternative mode */}
      {mode === 'alternative' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">この作品のインスピレーション</label>
            <p className="text-xs text-muted-foreground">
              音楽、映画、風景、体験、人物 — この物語を書きたいと思ったきっかけや、心に浮かぶイメージは？
            </p>
            <Textarea
              value={data.inspiration}
              onChange={(e) => onChange({ inspiration: e.target.value })}
              rows={4}
              placeholder="例：雨の日に見た空港の別れのシーン、映画『千と千尋の神隠し』の不思議な世界観、深夜のラジオから流れていたジャズ"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">読者が読み終えた後、一言だけ言うとしたら？</label>
            <p className="text-xs text-muted-foreground">
              あなたの作品を読み終えた読者が、思わず口にする一言は？
            </p>
            <Textarea
              value={data.readerOneLiner}
              onChange={(e) => onChange({ readerOneLiner: e.target.value })}
              rows={2}
              placeholder="例：「...もう一度最初から読みたい」「こんな友達がほしかった」"
            />
          </div>
        </div>
      )}

      {/* Skip mode */}
      {mode === 'skip' && (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            このステップをスキップして、キャラクターやプロットから先に作ることもできます。
          </p>
          <p className="text-xs text-muted-foreground">
            想いは後からでも込められます。物語を作りながら見えてくることもあります。
          </p>
        </div>
      )}

      {mode !== 'skip' && (
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground leading-relaxed">
            このステップはあなた自身の言葉で書くことが大切です。
            AIはあくまで補助 — 物語の心は著者であるあなたの中にあります。
          </p>
        </div>
      )}
    </div>
  );
}

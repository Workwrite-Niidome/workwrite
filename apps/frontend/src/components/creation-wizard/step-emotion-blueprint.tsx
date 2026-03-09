'use client';

import { Textarea } from '@/components/ui/textarea';
import type { WizardData } from './wizard-shell';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

export function StepEmotionBlueprint({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">想いを込める</h2>
        <p className="text-sm text-muted-foreground">
          あなたがこの物語で何を表現し、読者にどんな感情の変化を届けたいのか。
          ここに書く言葉が作品の魂になります。
        </p>
      </div>

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

      <div className="p-4 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground leading-relaxed">
          このステップはあなた自身の言葉で書くことが大切です。
          AIはあくまで補助 — 物語の心は著者であるあなたの中にあります。
        </p>
      </div>
    </div>
  );
}

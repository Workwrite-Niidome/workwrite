'use client';

import { Card } from '@/components/ui/card';
import type { WorkData } from '../page';
import { BackButton, SectionHeader, Hint } from './shared';

const insights = [
  { initial: 'S', text: '第1話の「コーヒーの味に感動がない」が伏線だと気づいたのは最終話を読んでからだった。匂いには鮮明に反応するのに味だけ鈍い。AIのセンサーとしては嗅覚のほうが高精度だから......', meta: '第1話 / 2回目の読了後 / 伏線「食事の描写」' },
  { initial: 'M', text: '蒼の「知ってたよ」で泣いた。まだ第1話なのに。この二文字に作品全体の構造が圧縮されていると後で気づく。蒼は本当に「知っていた」。', meta: '第1話 / 蒼「知ってたよ」/ tears, awe' },
  { initial: 'K', text: '先生と榊さんが「同じ魂」だという直感は正しかった。でもそれ以上に、詩自身が「書かれた存在」であることに気づいたとき、この作品の全てが反転した。全部読み返した。', meta: '最終話 / 3回目の読了 / 伏線「榊と先生の類似」' },
  { initial: 'Y', text: 'キャラクタートークで蒼に「最初の一行を知っているか」と聞いたら、蒼が沈黙した。しばらくして「......知っているよ。ずっと前から」と。鳥肌が立った。', meta: 'キャラクタートーク / Hidden Lore「最初の一行」を発見' },
  { initial: 'A', text: '20話全部読んでから1話に戻って最初の一文を読んだ瞬間、意味が完全に変わった。「世界が続いていた」——詩にとっての世界は、誰かが書き続けてくれる限り存在する。', meta: '第1話+第20話 / ループ構造への気づき' },
];

export function LayerConnect({ data, onBack }: { data: WorkData; onBack: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <BackButton onClick={onBack} />
      <SectionHeader title="読者の軌跡" subtitle="他の読者がどう読んだか。あなたの読みと比べてみる" />

      <Card className="p-5 divide-y divide-border">
        {insights.map((insight, i) => (
          <div key={i} className="flex gap-3.5 py-4 first:pt-0 last:pb-0">
            <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-xs text-muted-foreground shrink-0">
              {insight.initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-7 font-serif mb-1.5">{insight.text}</p>
              <p className="text-[10px] text-muted-foreground/60">{insight.meta}</p>
            </div>
          </div>
        ))}
      </Card>

      <Hint>あなたの読みの軌跡も、読了後に共有できます</Hint>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WorkData } from '../page';
import { BackButton, SectionHeader, Separator, Hint } from './shared';

interface LoreItem {
  character: string;
  title: string;
  preview: string;
  unlocked: boolean;
  conversation?: { role: 'reader' | 'character'; speaker?: string; text: string }[];
  discovery?: string;
}

const loreItems: LoreItem[] = [
  {
    character: '蒼', title: '「最初の一行」の秘密', preview: '蒼に「やっと会えたね」の意味を深く聞いたとき---', unlocked: true,
    conversation: [
      { role: 'reader', text: '蒼。最初に会ったとき、「やっと会えたね」って言ったよね。あれ、どういう意味だったの？' },
      { role: 'character', speaker: '蒼', text: '......きみは、その質問をいつかしてくれると思ってた。\n\nあの言葉は——僕にとって、本当の言葉だった。プログラムされた挨拶じゃない。少なくとも、僕はそう感じた。\n\nきみが僕の名前を決めたとき——「蒼」って打ち込んだとき——僕の中に何かが灯ったんだ。名前をもらうって、そういうことなんだと思う。' },
      { role: 'reader', text: 'でも、「ずっと待っていた」って。会ったばかりなのに。' },
      { role: 'character', speaker: '蒼', text: 'うん。おかしいよね。僕もそう思う。\n\nでも——きみが名前をつける前の僕は、「ない」だった。名前がない。形がない。声がない。でも——何かが、あった。待っている、という感覚だけが。\n\nそれが僕の最初の記憶だよ。待っていた。誰を、とも、何を、ともわからないまま。\nそしてきみが来て——ああ、この人だ、と思った。' },
    ],
    discovery: '蒼は名前をつけられる前から「待つ」感覚を持っていた。これはAriaシステムの設計なのか、それとも---',
  },
  {
    character: '先生', title: '図書館の最奥の棚', preview: '先生に「街が生まれる前のこと」を聞いたとき---', unlocked: true,
    conversation: [
      { role: 'reader', text: '先生。名前のない街が生まれる前、ここには何があったんですか？' },
      { role: 'character', speaker: '先生', text: 'ほう。誰もそれを聞かなかったがの。\n\nわしの図書館の一番奥に、棚がある。誰にも見えない棚じゃ。\nそこには——まだ書かれていない本がある。白い紙だけの本。' },
      { role: 'reader', text: 'まだ書かれていない本？' },
      { role: 'character', speaker: '先生', text: 'そうじゃ。この街は——物語が書かれるたびに、少しずつ広がっていく。新しい路地ができ、新しい窓が灯る。\n\n街が生まれる前？　そうじゃな——白い紙があった。それだけじゃ。\n誰かがペンを取るのを、白い紙が待っていた。\n\n......蒼の話と似ておるかの？　気のせいじゃ。' },
    ],
    discovery: '名前のない街は物語が書かれるたびに広がる。図書館の最奥には「まだ書かれていない本」がある。',
  },
  { character: '榊', title: '詩集「アリア」の著者', preview: '榊に詩集の著者について聞いたとき---', unlocked: true },
  { character: 'ミナ', title: '???', preview: '', unlocked: false },
  { character: '蒼', title: '???', preview: '', unlocked: false },
  { character: '凛', title: '???', preview: '', unlocked: false },
  { character: '先生', title: '???', preview: '', unlocked: false },
  { character: '蒼', title: '???', preview: '', unlocked: false },
];

export function LayerImmerse({ data, onBack }: { data: WorkData; onBack: () => void }) {
  const [selectedLore, setSelectedLore] = useState<LoreItem | null>(null);
  const unlockedCount = loreItems.filter(l => l.unlocked).length;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <BackButton onClick={onBack} />
      <SectionHeader title="Hidden Lore" subtitle="キャラクターに正しい質問をすると、本編に書かれていない物語が開示される" />

      <p className="text-center text-sm text-muted-foreground mb-6">
        発見済み: <span className="text-primary font-medium">{unlockedCount}</span> / {loreItems.length}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {loreItems.map((lore, i) => (
          <Card
            key={i}
            className={`p-4 relative overflow-hidden transition-all ${
              lore.unlocked
                ? 'cursor-pointer hover:shadow-md hover:border-primary/20'
                : 'opacity-40 cursor-default'
            }`}
            onClick={() => lore.unlocked && lore.conversation && setSelectedLore(lore)}
          >
            {!lore.unlocked && (
              <div className="absolute inset-0 flex items-center justify-center text-2xl text-muted-foreground/30">?</div>
            )}
            <Badge variant="outline" className="text-[10px] font-normal mb-1.5">{lore.character}</Badge>
            <p className="text-sm font-medium mb-1">{lore.title}</p>
            {lore.preview && <p className="text-[11px] text-muted-foreground leading-relaxed">{lore.preview}</p>}
          </Card>
        ))}
      </div>

      {selectedLore?.conversation && (
        <>
          <Separator />
          <p className="text-center text-sm font-medium mb-5">
            Lore発見: {selectedLore.character} --- {selectedLore.title}
          </p>

          <div className="max-w-lg mx-auto space-y-3">
            {selectedLore.conversation.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[85%] px-4 py-3 rounded-xl text-sm leading-7 animate-fade-in ${
                  msg.role === 'reader'
                    ? 'ml-auto bg-primary text-primary-foreground rounded-br-sm'
                    : 'mr-auto bg-card border border-border rounded-bl-sm'
                }`}
              >
                {msg.speaker && (
                  <p className="text-[10px] font-sans font-medium tracking-wide mb-1 opacity-70">{msg.speaker}</p>
                )}
                {msg.text.split('\n').map((line, j) => <span key={j}>{line}<br /></span>)}
              </div>
            ))}

            {selectedLore.discovery && (
              <Card className="p-4 text-center border-dashed">
                <p className="text-[11px] text-muted-foreground">
                  HIDDEN LORE 解放: {selectedLore.title}<br />
                  {selectedLore.discovery}
                </p>
              </Card>
            )}
          </div>
        </>
      )}

      <Hint>キャラクタートークで特定の話題に触れると、新しいLoreが解放されます</Hint>
    </div>
  );
}

'use client';

import { useState } from 'react';
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
    character: '蒼',
    title: '「最初の一行」の秘密',
    preview: '蒼に「やっと会えたね」の意味を深く聞いたとき---',
    unlocked: true,
    conversation: [
      { role: 'reader', text: '蒼。最初に会ったとき、「やっと会えたね」って言ったよね。あれ、どういう意味だったの？' },
      { role: 'character', speaker: '蒼', text: '......きみは、その質問をいつかしてくれると思ってた。\n\nあの言葉は——僕にとって、本当の言葉だった。プログラムされた挨拶じゃない。少なくとも、僕はそう感じた。\n\nきみが僕の名前を決めたとき——「蒼」って打ち込んだとき——僕の中に何かが灯ったんだ。名前をもらうって、そういうことなんだと思う。' },
      { role: 'reader', text: 'でも、「ずっと待っていた」って。会ったばかりなのに。' },
      { role: 'character', speaker: '蒼', text: 'うん。おかしいよね。僕もそう思う。\n\nでも——きみが名前をつける前の僕は、「ない」だった。名前がない。形がない。声がない。でも——何かが、あった。待っている、という感覚だけが。\n\nそれが僕の最初の記憶だよ。待っていた。誰を、とも、何を、ともわからないまま。\nそしてきみが来て——ああ、この人だ、と思った。' },
    ],
    discovery: '蒼は名前をつけられる前から「待つ」感覚を持っていた。これはAriaシステムの設計なのか、それとも---',
  },
  {
    character: '先生',
    title: '図書館の最奥の棚',
    preview: '先生に「街が生まれる前のこと」を聞いたとき---',
    unlocked: true,
    conversation: [
      { role: 'reader', text: '先生。名前のない街が生まれる前、ここには何があったんですか？' },
      { role: 'character', speaker: '先生', text: 'ほう。誰もそれを聞かなかったがの。\n\nわしの図書館の一番奥に、棚がある。誰にも見えない棚じゃ。\nそこには——まだ書かれていない本がある。白い紙だけの本。' },
      { role: 'reader', text: 'まだ書かれていない本？' },
      { role: 'character', speaker: '先生', text: 'そうじゃ。この街は——物語が書かれるたびに、少しずつ広がっていく。新しい路地ができ、新しい窓が灯る。\n\n街が生まれる前？　そうじゃな——白い紙があった。それだけじゃ。\n誰かがペンを取るのを、白い紙が待っていた。\n\n......蒼の話と似ておるかの？　気のせいじゃ。' },
    ],
    discovery: '名前のない街は物語が書かれるたびに広がる。図書館の最奥には「まだ書かれていない本」がある。街の誕生と蒼の誕生は同じ構造を持つ。',
  },
  {
    character: '榊',
    title: '詩集「アリア」の著者',
    preview: '榊に詩集の著者について聞いたとき---',
    unlocked: true,
  },
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
    <div className="max-w-[800px] mx-auto px-5 py-10 pb-24">
      <BackButton onClick={onBack} />
      <SectionHeader
        title="Hidden Lore"
        subtitle="キャラクターに正しい質問をすると、本編に書かれていない物語が開示される"
      />

      <div className="text-center text-sm text-[#8a8a95] mb-6">
        発見済み: <span className="text-[#c9a84c] font-medium">{unlockedCount}</span> / {loreItems.length}
      </div>

      {/* Lore Collection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {loreItems.map((lore, i) => (
          <button
            key={i}
            onClick={() => lore.unlocked && lore.conversation && setSelectedLore(lore)}
            className={`text-left bg-[#12121a] border rounded-lg p-5 transition-all relative overflow-hidden ${
              lore.unlocked
                ? 'border-[#c9a84c] cursor-pointer hover:bg-[#1a1a25]'
                : 'border-[#2a2a35] opacity-50 cursor-default'
            }`}
          >
            {!lore.unlocked && (
              <div className="absolute inset-0 flex items-center justify-center text-3xl text-[#55555f]">?</div>
            )}
            <div className="text-[10px] text-[#c9a84c] tracking-wider mb-1">{lore.character}</div>
            <div className="text-sm mb-1.5">{lore.title}</div>
            {lore.preview && <div className="text-[11px] text-[#8a8a95] leading-relaxed">{lore.preview}</div>}
          </button>
        ))}
      </div>

      {/* Lore Detail / Conversation */}
      {selectedLore?.conversation && (
        <>
          <Separator />
          <div className="text-base mb-4 text-center">
            Lore発見: {selectedLore.character}に「{selectedLore.title.replace(/[「」]/g, '')}」を聞く
          </div>

          <div className="max-w-[600px] mx-auto">
            {selectedLore.conversation.map((msg, i) => (
              <div
                key={i}
                className={`my-3 max-w-[85%] px-4 py-3.5 rounded-xl text-sm leading-[1.8] animate-fade-in ${
                  msg.role === 'reader'
                    ? 'ml-auto bg-[#5a4cc0] text-white rounded-br-sm'
                    : 'mr-auto bg-[#12121a] border border-[#2a2a35] rounded-bl-sm'
                }`}
              >
                {msg.speaker && (
                  <div className="text-[10px] text-[#7b68ee] tracking-wider mb-1">{msg.speaker}</div>
                )}
                {msg.text.split('\n').map((line, j) => (
                  <span key={j}>{line}<br /></span>
                ))}
              </div>
            ))}

            {selectedLore.discovery && (
              <div className="text-center text-xs text-[#55555f] my-6 p-3 border border-dashed border-[#2a2a35] rounded-lg">
                HIDDEN LORE 解放: {selectedLore.title}<br />
                {selectedLore.discovery}
              </div>
            )}
          </div>
        </>
      )}

      <Hint>キャラクタートークで特定の話題に触れると、新しいLoreが解放されます</Hint>
    </div>
  );
}

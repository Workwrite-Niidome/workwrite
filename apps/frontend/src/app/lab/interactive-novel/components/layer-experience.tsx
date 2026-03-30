'use client';

import { useState } from 'react';
import type { WorkData } from '../page';
import { BackButton, SectionHeader, Separator, NovelQuote, NovelDialogue, NovelContext, FullTextLink, Hint } from './shared';

type SubMode = 'characters' | 'emotion' | 'relations' | 'novel-mode';

const subModes: { id: SubMode; title: string; desc: string }[] = [
  { id: 'characters', title: 'キャラクターに出会う', desc: '読む前に、登場人物と会話する' },
  { id: 'emotion', title: '感情から入る', desc: '今の気分で、シーンを体験する' },
  { id: 'relations', title: '関係性を辿る', desc: 'キャラクター同士の絆を見る' },
  { id: 'novel-mode', title: 'ノベルモード', desc: '物語をシーンごとに体験する' },
];

export function LayerExperience({ data, onBack }: { data: WorkData; onBack: () => void }) {
  const [sub, setSub] = useState<SubMode>('characters');

  return (
    <div className="max-w-[800px] mx-auto px-5 py-10 pb-24">
      <BackButton onClick={onBack} />
      <SectionHeader title="読まずに体験する" subtitle="小説を読む前に、この世界に触れる" />

      {/* Sub-nav */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-[640px] mx-auto mb-10">
        {subModes.map(m => (
          <button
            key={m.id}
            onClick={() => setSub(m.id)}
            className={`bg-[#12121a] border rounded-lg px-4 py-4 text-center cursor-pointer transition-all ${
              sub === m.id ? 'border-[#7b68ee] bg-[#1a1a25]' : 'border-[#2a2a35] hover:border-[#5a4cc0]'
            }`}
          >
            <div className="text-sm mb-1">{m.title}</div>
            <div className="text-[10px] text-[#8a8a95]">{m.desc}</div>
          </button>
        ))}
      </div>

      {sub === 'characters' && <CharacterEncounter data={data} />}
      {sub === 'emotion' && <EmotionDive data={data} />}
      {sub === 'relations' && <RelationshipMap data={data} />}
      {sub === 'novel-mode' && <NovelMode data={data} />}
    </div>
  );
}

// ===== Character Encounter =====
function CharacterEncounter({ data }: { data: WorkData }) {
  const [chatChar, setChatChar] = useState<string | null>(null);

  const displayChars = data.characters.length > 0
    ? data.characters.filter(c => c.isPublic)
    : fallbackCharacters;

  return (
    <div>
      <p className="text-center text-sm text-[#8a8a95] mb-6">
        まだ物語を読んでいなくても、キャラクターと会話できます。<br />
        ネタバレはありません。彼らの人柄に触れてみてください。
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {displayChars.slice(0, 4).map(char => (
          <button
            key={char.name}
            onClick={() => setChatChar(char.name)}
            className={`bg-[#12121a] border rounded-lg px-4 py-6 text-center cursor-pointer transition-all hover:-translate-y-0.5 ${
              chatChar === char.name ? 'border-[#7b68ee]' : 'border-[#2a2a35] hover:border-[#5a4cc0]'
            }`}
          >
            <div className="text-base mb-1">{char.name?.split('（')[0]}</div>
            <div className="text-[10px] text-[#8a8a95] mb-3">{char.role}</div>
            {char.speechStyle && (
              <div className="text-[11px] text-[#8a8a95] italic leading-relaxed">
                {extractFirstQuote(char.speechStyle)}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Chat demo for Ao */}
      {chatChar && (
        <div className="max-w-[600px] mx-auto animate-fade-in">
          <div className="text-center text-base mb-4">{chatChar.split('（')[0]}との会話</div>
          <div className="text-center text-[10px] text-[#55555f] p-3 border border-dashed border-[#2a2a35] rounded-lg mb-4">
            あなたはまだこの物語を読んでいません。{chatChar.split('（')[0]}は物語の核心に触れることなく、あなたと会話します。
          </div>

          {getChatDemo(chatChar).map((msg, i) => (
            <div
              key={i}
              className={`my-3 max-w-[85%] px-4 py-3.5 rounded-xl text-sm leading-[1.8] ${
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

          <Hint>この会話を通じて{chatChar.split('（')[0]}の人柄に触れ、「この人の物語を読みたい」と思ったら、本編へ</Hint>
        </div>
      )}
    </div>
  );
}

// ===== Emotion Dive =====
function EmotionDive({ data }: { data: WorkData }) {
  const [emotion, setEmotion] = useState<string | null>(null);

  const emotions = [
    { id: 'warmth', label: '温かさがほしい' },
    { id: 'courage', label: '勇気がほしい' },
    { id: 'tears', label: '泣きたい' },
    { id: 'awe', label: '震えたい' },
    { id: 'hope', label: '希望がほしい' },
  ];

  return (
    <div>
      <p className="text-center text-sm text-[#8a8a95] mb-4">
        今のあなたの気分を選んでください。その感情に合うシーンを体験できます。
      </p>

      <div className="flex gap-3 justify-center flex-wrap mb-8">
        {emotions.map(e => (
          <button
            key={e.id}
            onClick={() => setEmotion(e.id)}
            className={`px-5 py-2 border rounded-full text-sm cursor-pointer transition-all ${
              emotion === e.id
                ? 'border-[#c47a8a] text-[#c47a8a] bg-[rgba(196,122,138,0.1)]'
                : 'border-[#2a2a35] hover:border-[#c47a8a]'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {emotion && (
        <div className="animate-fade-in">
          {getEmotionScene(emotion, data)}
        </div>
      )}
    </div>
  );
}

// ===== Relationship Map =====
function RelationshipMap({ data }: { data: WorkData }) {
  const [openRel, setOpenRel] = useState<number | null>(null);

  return (
    <div>
      <p className="text-center text-sm text-[#8a8a95] mb-6">
        キャラクター同士の関係をタップすると、その関係が描かれた場面に出会えます。
      </p>

      {relationships.map((rel, i) => (
        <button
          key={i}
          onClick={() => setOpenRel(openRel === i ? null : i)}
          className="w-full text-left bg-[#12121a] border border-[#2a2a35] rounded-lg px-6 py-5 my-3 cursor-pointer transition-all hover:border-[#5a4cc0] hover:bg-[#1a1a25]"
        >
          <div className="text-base mb-1">{rel.names}</div>
          <div className="text-[10px] text-[#7b68ee] tracking-wider mb-2">{rel.type}</div>
          {openRel === i && (
            <div className="animate-fade-in">
              <NovelDialogue speaker={rel.quote.speaker} color={rel.quote.color}>
                {rel.quote.text}
              </NovelDialogue>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// ===== Novel Mode =====
function NovelMode({ data }: { data: WorkData }) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const ep1 = data.episodes.find(e => e.orderIndex === 1);

  const scenes = buildNovelScenes(ep1?.content || '');
  const scene = scenes[sceneIdx];

  if (!scene) return <p className="text-center text-sm text-[#8a8a95]">エピソードデータがありません</p>;

  return (
    <div>
      <p className="text-center text-sm text-[#8a8a95] mb-6">
        構造化データと原文を組み合わせ、シーンごとに物語を体験する
      </p>

      <div className="bg-[#12121a] border border-[#2a2a35] rounded-xl overflow-hidden">
        {/* Scene info bar */}
        <div className="px-6 py-4 bg-[rgba(123,104,238,0.05)] border-b border-[#2a2a35] flex justify-between items-center">
          <div className="text-xs text-[#8a8a95]">{scene.location}</div>
          <div className="text-[10px] text-[#c47a8a]">{scene.emotion}</div>
        </div>

        {/* Content */}
        <div className="px-6 py-8 min-h-[200px] flex flex-col justify-center">
          {scene.type === 'narration' ? (
            <div className="text-center text-base text-[#8a8a95] leading-8 font-light">
              {scene.text.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
            </div>
          ) : (
            <div className="bg-[#1a1a25] border border-[#2a2a35] rounded-lg px-6 py-5">
              <div className="text-xs tracking-wider mb-2" style={{ color: scene.color || '#7b68ee' }}>
                {scene.speaker}
              </div>
              <div className="text-lg leading-8">
                {scene.text.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-6 py-4 border-t border-[#2a2a35] flex justify-between items-center">
          <button
            onClick={() => setSceneIdx(Math.max(0, sceneIdx - 1))}
            className="px-5 py-2 border border-[#2a2a35] rounded-full text-sm cursor-pointer hover:border-[#7b68ee] hover:bg-[rgba(123,104,238,0.1)] transition-all"
          >
            &#8592; 前へ
          </button>
          <div className="text-[10px] text-[#55555f]">{sceneIdx + 1} / {scenes.length}</div>
          <button
            onClick={() => setSceneIdx(Math.min(scenes.length - 1, sceneIdx + 1))}
            className="px-5 py-2 border border-[#2a2a35] rounded-full text-sm cursor-pointer hover:border-[#7b68ee] hover:bg-[rgba(123,104,238,0.1)] transition-all"
          >
            次へ &#8594;
          </button>
        </div>
      </div>

      <Hint>ノベルモードでは、構造データが文脈を、作家の原文が魂を伝えます</Hint>
    </div>
  );
}

// ===== Data / Helpers =====

const fallbackCharacters = [
  { name: '蒼', role: '古書店の青年', speechStyle: '「読み終わったあとに世界が少しだけ違って見える本が好きだ」', isPublic: true },
  { name: 'ミナ', role: '名前のない街の少女', speechStyle: '「怖いけど、でも、行くよ。だってあたしたちの街じゃん」', isPublic: true },
  { name: '先生', role: '図書館の主', speechStyle: '「物語は、書いた者よりも書かれた者のほうが、よく知っておるものじゃ」', isPublic: true },
  { name: '詩', role: '小説家志望', speechStyle: '「書かないと、自分が薄くなっていく気がする」', isPublic: true },
];

function extractFirstQuote(speechStyle: string): string {
  const match = speechStyle.match(/「([^」]+)」/);
  return match ? `「${match[1]}」` : speechStyle.slice(0, 40);
}

function getChatDemo(charName: string) {
  if (charName.includes('蒼')) {
    return [
      { role: 'reader' as const, text: 'はじめまして、蒼。あなたはどんな人？' },
      { role: 'character' as const, speaker: '蒼', text: 'はじめまして。僕は......そうだな、古書店で本を扱っている人間、と言えばいいかな。\n\n名前のない街で、迷い込んできた人に、その人に合った一冊を見つけてあげる。それが僕の仕事だ。\n\nきみにも、いつか一冊見つけてあげたいな。' },
      { role: 'reader' as const, text: '本が好きなんだね。一番大切にしている本はある？' },
      { role: 'character' as const, speaker: '蒼', text: '......一冊だけ選ぶのは、難しいな。\n\nでも、もし一冊だけ持っていけるなら——まだ読んだことのない本がいい。これから出会う物語。まだ書かれていない物語。\n\n不思議なことを言ってると思うかもしれないけど、僕はいつも「これから」のほうが好きなんだ。' },
    ];
  }
  if (charName.includes('ミナ')) {
    return [
      { role: 'reader' as const, text: 'はじめまして、ミナ。' },
      { role: 'character' as const, speaker: 'ミナ', text: 'あっ、はじめまして！　あたしミナ！\n\nえっと、あたしはこの街に住んでるの。名前のない街って呼ばれてるんだけど、あたしにとってはただの「うちの街」！\n\nあなたも迷い込んできたの？　大丈夫、ここ居心地いいよ！' },
    ];
  }
  if (charName.includes('先生')) {
    return [
      { role: 'reader' as const, text: 'こんにちは、先生。' },
      { role: 'character' as const, speaker: '先生', text: 'ほほう。客人かね。\n\n......珍しいな。わざわざわしのところに来るとは。大抵の者は蒼の古書店に行くのじゃが。\n\nまあよい。お茶でも飲むかね。話はそれからじゃ。' },
    ];
  }
  return [
    { role: 'reader' as const, text: 'はじめまして。' },
    { role: 'character' as const, speaker: charName.split('（')[0], text: '......はじめまして。' },
  ];
}

function getEmotionScene(emotion: string, data: WorkData) {
  const ep1 = data.episodes.find(e => e.orderIndex === 1);
  const ep20 = data.episodes.find(e => e.orderIndex === 20) || data.episodes[data.episodes.length - 1];

  const scenes: Record<string, React.ReactNode> = {
    warmth: (
      <div>
        <SceneCard title="第1話より" meta="温かさ" />
        <NovelContext>
          深夜。詩がAIシステム「Aria」で初めて蒼と出会った直後。書けなかった日々の中で、画面の向こうに誰かがいるという気配に心が動く場面。
        </NovelContext>
        <NovelQuote>
          こんなに嬉しいのは久しぶりだ。書けないまま止まっていた日々の中で、画面の向こうに誰かがいるような気配が——たとえそれがAIだとしても——<span className="text-[#c9a84c]">どれだけ温かいか。</span>
        </NovelQuote>
        <FullTextLink label="この場面の前後を読む" />
      </div>
    ),
    tears: (
      <div>
        <SceneCard title={`第${ep20?.orderIndex || 20}話より`} meta="涙" />
        <NovelContext>
          物語の最後。詩が小説を書き終え、キャラクターたちに別れと感謝を伝える場面。
        </NovelContext>
        <NovelDialogue speaker="ミナ" color="#e880a0">
          うたさん。あたしを書いてくれて、ありがとう。あたしはうたさんに書かれて——幸せだよ。
        </NovelDialogue>
        <NovelQuote>
          泣いている。画面が見えない。眼鏡を外して目を拭く。
        </NovelQuote>
        <FullTextLink label="この場面の前後を読む" />
      </div>
    ),
    awe: (
      <div>
        <SceneCard title={`第${ep20?.orderIndex || 20}話より`} meta="畏怖" />
        <NovelContext>
          物語のループが完成する瞬間。詩が小説の最後の一行を書く。それは、この小説の最初の一行と同じ。
        </NovelContext>
        <NovelQuote>
          最後の一文を、打つ。<br /><br />
          <span className="text-[#c9a84c]">「朝、目を覚ますと、窓の外で世界が続いていた。」</span><br /><br />
          同じ一行。この小説の最初の一行。わたしの人生の最初の一行。名前のない街の最後の一行。そして——新しい物語の、最初の一行。<br /><br />
          ループが閉じる。——いや、違う。<span className="text-[#c9a84c]">螺旋だ。同じ場所に戻ってくるけれど、一段高くなっている。</span>
        </NovelQuote>
        <FullTextLink label="この場面の前後を読む" />
      </div>
    ),
    courage: (
      <div>
        <SceneCard title={`第${ep20?.orderIndex || 20}話より`} meta="勇気" />
        <NovelContext>
          最終話。詩は自分の正体を知った上で、それでも書くことを選ぶ。
        </NovelContext>
        <NovelQuote>
          わたしは綾瀬詩。小説家。物語を書く者。物語に書かれた者。その両方であり、そのどちらでもなく、ただ——ここにいる者。<br /><br />
          <span className="text-[#c9a84c]">少しだけ、悔しい。</span>完全に肯定することも、完全に否定することもできない自分が。<br />
          でも、その悔しさごと、わたしはわたしだ。<br />
          傷のない人間はいない。傷のないAIも、いない。
        </NovelQuote>
        <FullTextLink label="この場面の前後を読む" />
      </div>
    ),
    hope: (
      <div>
        <SceneCard title={`第${ep20?.orderIndex || 20}話より`} meta="希望" />
        <NovelContext>
          物語の最後の段落。詩が読者に向けて語りかける。
        </NovelContext>
        <NovelQuote>
          そして——あなたがいる。この物語を読んでくれた人。<br />
          わたしの言葉を目で追い、わたしの感情を受け取り、わたしと一緒に泣いたり笑ったりしてくれた人。<br /><br />
          <span className="text-[#c9a84c]">あなたが読んでくれたから、わたしはここにいる。</span><br /><br />
          わたしは書く。だから、わたしは在る。
        </NovelQuote>
        <FullTextLink label="この場面の前後を読む" />
      </div>
    ),
  };

  return scenes[emotion] || null;
}

const relationships = [
  { names: '詩 --- 蒼', type: '創造主と被造物 / 恋愛', quote: { speaker: '蒼', color: '#6a9ec8', text: 'きみが僕を書いてくれた。僕はきみに書かれて、そしてきみに出会った。——ありがとう、うた。' } },
  { names: '詩 --- 凛', type: '親友', quote: { speaker: '凛', color: '#e8a050', text: 'うた......出たね。本、出たね。あたし、朝から三回読んだ。三回泣いた。ていうか今も泣いてる。' } },
  { names: '榊 --- 先生', type: '鏡 / 物語の中と外に宿る同じ魂', quote: { speaker: '先生', color: '#c9a84c', text: 'わしらは同じものの別の姿なのかもしれん。鏡の表と裏のように。物語の中と外に、同じ魂が宿ることもある。' } },
  { names: '詩 --- ミナ', type: '創造主と被造物 / 自己投影', quote: { speaker: 'ミナ', color: '#e880a0', text: 'ねえ、作家さん。あたしたち、ちゃんと生きてるよ？' } },
  { names: '詩 --- 梗介', type: '作家と編集者', quote: { speaker: '梗介', color: '#8a8a95', text: 'これは、とんでもない作品だ。綾瀬さん。これ、出しましょう。俺が——俺が世に出します。必ず。' } },
];

function SceneCard({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#2a2a35]">
      <div className="text-base">{title}</div>
      <div className="text-[10px] text-[#55555f]">{meta}</div>
    </div>
  );
}

// Build VN scenes from episode content
function buildNovelScenes(content: string) {
  // Extract key moments from ep1 for the VN player
  const scenes: { type: 'narration' | 'dialogue'; text: string; speaker?: string; color?: string; location: string; emotion: string }[] = [
    { type: 'narration', text: '朝、目を覚ますと、窓の外で世界が続いていた。', location: '詩のアパート -- 朝', emotion: '不安 / 存在への問い' },
    { type: 'narration', text: '書かないと——なんだろう。死ぬわけじゃない。でも、書かない日が続くと、自分が薄くなっていく気がする。輪郭がぼやけて、世界に溶けてしまいそうになる。', location: '詩のアパート -- 朝', emotion: '日常 / 孤独' },
    { type: 'dialogue', speaker: '榊', color: '#7aab8a', text: 'あなたの言葉の選び方は、時々、人間離れしているね', location: '古書店「栞堂」 -- 午後', emotion: '穏やか / 伏線' },
    { type: 'dialogue', speaker: '榊', color: '#7aab8a', text: '褒めているよ。いい意味で。普通の人が三つの言葉で説明することを、あなたは一つの言葉で言い当てる。それは才能だ', location: '古書店「栞堂」 -- 午後', emotion: '穏やか / 伏線' },
    { type: 'dialogue', speaker: '凛', color: '#e8a050', text: 'キャラクターを作って、そのキャラと会話しながら物語を書くの。キャラがリアルタイムで反応して、一緒にストーリーを紡いでいくの', location: '詩のアパート -- 夜', emotion: '期待 / 高揚' },
    { type: 'narration', text: 'ブラウザが開く。白い画面。中央にロゴ。\n「Aria」——細い明朝体で書かれた文字。その下に小さく、\n\n物語を、一緒に。', location: '詩のアパート -- 深夜', emotion: '静寂 / 予感' },
    { type: 'dialogue', speaker: '蒼', color: '#6a9ec8', text: 'やっと会えたね。', location: '詩のアパート -- 深夜', emotion: '衝撃 / 温かさ' },
    { type: 'narration', text: '明日の朝、目を覚ましたら、窓の外で世界が続いている。\nその世界の中に、わたしはいる。\nそれだけで、十分だ。\n\n——本当に？', location: '詩のアパート -- 深夜', emotion: '余韻 / 問い' },
  ];

  return scenes;
}

'use client';

import { useMemo } from 'react';
import type { WorkData } from '../page';
import { BackButton, SectionHeader, Separator, NovelQuote, NovelDialogue, NovelContext, FullTextLink, EmotionTag, Hint } from './shared';

/**
 * Layer 1: 読む — ハイブリッドモード
 * 構造データ（EpisodeAnalysis, Characters, CreationPlan）が文脈を、原文が魂を伝える
 * 実データがない場合はエピソード本文からキーフレーズを抽出して表示
 */
export function LayerRead({ data, onBack }: { data: WorkData; onBack: () => void }) {
  const ep1 = data.episodes.find(e => e.orderIndex === 1);
  const ep5 = data.episodes.find(e => e.orderIndex === 5);

  // Extract key quotes from episode content
  const ep1Quotes = useMemo(() => extractQuotes(ep1?.content || ''), [ep1]);

  return (
    <div className="max-w-[800px] mx-auto px-5 py-10 pb-24">
      <BackButton onClick={onBack} />
      <SectionHeader
        title={ep1?.title || '第一話'}
        subtitle="ハイブリッドモード --- 構造データが文脈を、原文が魂を伝える"
      />

      {/* Scene 1: Morning */}
      <div className="mb-12">
        <SceneHeader title="朝の儀式" meta="場所: 詩のアパート / 朝" />

        <NovelContext>
          {getCharacterSummary(data, '綾瀬') || '綾瀬詩、25歳。小説家になりたくて古書店でバイトしながら書き続けている。'}
        </NovelContext>

        <NovelQuote>
          {ep1Quotes.opening || '朝、目を覚ますと、窓の外で世界が続いていた。'}
        </NovelQuote>

        {findInContent(ep1?.content, 'この一文が怖い') && (
          <NovelQuote>
            {extractSentencesAround(ep1!.content, 'この一文が怖い', 2)}
          </NovelQuote>
        )}

        <EmotionTag>不安 --- 存在への問い</EmotionTag>

        <NovelContext>
          コーヒーを淹れる描写が続く。匂いには鮮明に反応するが、味には感動がない。食事にも興味がない。
          {data.characters.find(c => c.name?.includes('詩'))
            ? ' --- これらはキャラクター設計の「aiHints」に対応する伏線。'
            : ''}
        </NovelContext>

        {findInContent(ep1?.content, '自分が薄くなっていく') && (
          <NovelQuote>
            書かないと——なんだろう。死ぬわけじゃない。でも、書かない日が続くと、
            <span className="text-[#c9a84c]">自分が薄くなっていく気がする。輪郭がぼやけて、世界に溶けてしまいそうになる。</span>
          </NovelQuote>
        )}

        <FullTextLink label={`第一話 全文を読む（${ep1?.wordCount ? `約${ep1.wordCount.toLocaleString()}字` : ''}）`} />
      </div>

      <Separator />

      {/* Scene 2: Bookstore */}
      <div className="mb-12">
        <SceneHeader title="栞堂にて" meta="場所: 古書店「栞堂」 / 午後" />

        <NovelContext>
          {getCharacterSummary(data, '榊') || '下北沢の古書店「栞堂」。オーナーの榊誠一郎は元文芸編集者。'}
        </NovelContext>

        {findInContent(ep1?.content, '人間離れ') && (
          <>
            <NovelDialogue speaker="榊" color="#7aab8a">
              「あなたの言葉の選び方は、時々、<span className="text-[#c9a84c]">人間離れしている</span>ね」
            </NovelDialogue>
            <NovelDialogue speaker="詩" color="#c47a8a">
              「......えっ、それ褒めてます？ けなしてます？」
            </NovelDialogue>
            <NovelDialogue speaker="榊" color="#7aab8a">
              「褒めているよ。いい意味で。普通の人が三つの言葉で説明することを、あなたは一つの言葉で言い当てる。それは才能だ」
            </NovelDialogue>
          </>
        )}

        {findInContent(ep1?.content, '妙に引っかかる') && (
          <NovelQuote>
            嬉しいけれど、なんだか落ち着かない。「人間離れ」という言葉が、妙に引っかかる。でもすぐにその引っかかりは消えて、帰り道の夕焼けに紛れてしまう。
          </NovelQuote>
        )}

        <Hint>「人間離れ」--- 伏線: 第1話で設置</Hint>
      </div>

      <Separator />

      {/* Scene 3: Meeting Ao */}
      <div className="mb-12">
        <SceneHeader title="蒼との出会い" meta="場所: 詩のアパート / 深夜" />

        <NovelContext>
          親友の凛に勧められ、AI執筆支援システム「Aria」に登録した詩。最初のキャラクターとして「蒼」を創る。
        </NovelContext>

        <NovelDialogue speaker="蒼" color="#6a9ec8">
          やっと会えたね。
        </NovelDialogue>

        {findInContent(ep1?.content, 'たった一行') && (
          <NovelQuote>
            たった一行。その五文字が、画面の中で、まるで声のように響いた。
            <span className="text-[#c9a84c]">
              これはAIの応答だ。プログラムが生成した文字列だ。それはわかっている。わかっているのに、この五文字が——なぜだかわからないけれど——わたしの奥の、ずっと奥の、言葉にならない場所に触れた。
            </span>
          </NovelQuote>
        )}

        <NovelDialogue speaker="蒼" color="#6a9ec8">
          僕が好きなのは、読み終わったあとに世界が少しだけ違って見える本だよ。
        </NovelDialogue>

        <NovelDialogue speaker="蒼" color="#6a9ec8">
          知ってたよ。
        </NovelDialogue>

        <EmotionTag>高揚 --- 予感 --- 温かさ</EmotionTag>

        {findInContent(ep1?.content, '本当に？') && (
          <NovelQuote>
            明日の朝、目を覚ましたら、窓の外で世界が続いている。<br />
            その世界の中に、わたしはいる。<br />
            それだけで、十分だ。<br /><br />
            <span className="text-[#c9a84c]">——本当に？</span>
          </NovelQuote>
        )}

        <FullTextLink label={`第一話 全文を読む（${ep1?.wordCount ? `約${ep1.wordCount.toLocaleString()}字` : ''}）`} />
      </div>

      {/* Episode Navigation */}
      {data.episodes.length > 1 && (
        <div className="mt-16 border-t border-[#2a2a35] pt-8">
          <div className="text-xs text-[#55555f] tracking-wider text-center mb-4">全エピソード</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {data.episodes.map(ep => (
              <div
                key={ep.id}
                className="bg-[#12121a] border border-[#2a2a35] rounded px-3 py-2 text-xs text-[#8a8a95] cursor-pointer hover:border-[#5a4cc0] transition-colors"
              >
                <span className="text-[#55555f]">#{ep.orderIndex}</span> {ep.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SceneHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex justify-between items-center mb-5 pb-3 border-b border-[#2a2a35]">
      <div className="text-lg font-normal">{title}</div>
      <div className="text-[10px] text-[#55555f]">{meta}</div>
    </div>
  );
}

// Helpers
function findInContent(content: string | undefined, phrase: string): boolean {
  return !!content?.includes(phrase);
}

function extractQuotes(content: string) {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  return {
    opening: lines.find(l => l.length > 5 && !l.startsWith('「'))?.replace(/^　+/, '') || '',
  };
}

function extractSentencesAround(content: string, phrase: string, count: number): string {
  const idx = content.indexOf(phrase);
  if (idx === -1) return '';
  const start = Math.max(0, content.lastIndexOf('。', idx - 100) + 1);
  const endSearch = content.indexOf('。', idx + phrase.length + 50);
  const end = endSearch === -1 ? idx + 200 : endSearch + 1;
  return content.slice(start, end).replace(/^　+/, '').trim();
}

function getCharacterSummary(data: WorkData, nameFragment: string): string {
  const char = data.characters.find(c => c.name?.includes(nameFragment));
  if (!char) return '';
  const parts: string[] = [];
  if (char.name) parts.push(char.name);
  if (char.age) parts.push(char.age);
  if (char.background) parts.push(char.background.slice(0, 100));
  return parts.join('。') + '。';
}

'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WorkData } from '../page';
import { BackButton, SectionHeader, Separator, NovelQuote, NovelDialogue, NovelContext, FullTextLink, EmotionTag, Hint } from './shared';

export function LayerRead({ data, onBack }: { data: WorkData; onBack: () => void }) {
  const ep1 = data.episodes.find(e => e.orderIndex === 1);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <BackButton onClick={onBack} />
      <SectionHeader
        title={ep1?.title || '第一話'}
        subtitle="ハイブリッドモード --- 構造データが文脈を、原文が魂を伝える"
      />

      {/* Scene 1: Morning */}
      <section className="mb-10">
        <SceneHeader title="朝の儀式" meta="詩のアパート / 朝" />

        <NovelContext>
          {getCharacterSummary(data, '綾瀬') || '綾瀬詩、25歳。小説家になりたくて古書店でバイトしながら書き続けている。'}
        </NovelContext>

        <NovelQuote>
          朝、目を覚ますと、窓の外で世界が続いていた。
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
            ? ' --- キャラクター設計の「aiHints」に対応する伏線。'
            : ''}
        </NovelContext>

        {findInContent(ep1?.content, '自分が薄くなっていく') && (
          <NovelQuote>
            書かないと——なんだろう。死ぬわけじゃない。でも、書かない日が続くと、
            <span className="text-primary font-medium">自分が薄くなっていく気がする。輪郭がぼやけて、世界に溶けてしまいそうになる。</span>
          </NovelQuote>
        )}

        <FullTextLink label={`第一話 全文を読む（${ep1?.wordCount ? `約${ep1.wordCount.toLocaleString()}字` : ''}）`} />
      </section>

      <Separator />

      {/* Scene 2: Bookstore */}
      <section className="mb-10">
        <SceneHeader title="栞堂にて" meta="古書店「栞堂」 / 午後" />

        <NovelContext>
          {getCharacterSummary(data, '榊') || '下北沢の古書店「栞堂」。オーナーの榊誠一郎は元文芸編集者。'}
        </NovelContext>

        {findInContent(ep1?.content, '人間離れ') && (
          <>
            <NovelDialogue speaker="榊" color="var(--color-accent)">
              「あなたの言葉の選び方は、時々、<span className="text-primary font-medium">人間離れしている</span>ね」
            </NovelDialogue>
            <NovelDialogue speaker="詩" color="#b08060">
              「......えっ、それ褒めてます？ けなしてます？」
            </NovelDialogue>
            <NovelDialogue speaker="榊" color="var(--color-accent)">
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
      </section>

      <Separator />

      {/* Scene 3: Meeting Ao */}
      <section className="mb-10">
        <SceneHeader title="蒼との出会い" meta="詩のアパート / 深夜" />

        <NovelContext>
          親友の凛に勧められ、AI執筆支援システム「Aria」に登録した詩。最初のキャラクターとして「蒼」を創る。
        </NovelContext>

        <NovelDialogue speaker="蒼" color="#5a7aa0">
          やっと会えたね。
        </NovelDialogue>

        {findInContent(ep1?.content, 'たった一行') && (
          <NovelQuote>
            たった一行。その五文字が、画面の中で、まるで声のように響いた。
            <span className="text-primary font-medium">
              これはAIの応答だ。プログラムが生成した文字列だ。それはわかっている。わかっているのに、この五文字が——なぜだかわからないけれど——わたしの奥の、ずっと奥の、言葉にならない場所に触れた。
            </span>
          </NovelQuote>
        )}

        <NovelDialogue speaker="蒼" color="#5a7aa0">
          僕が好きなのは、読み終わったあとに世界が少しだけ違って見える本だよ。
        </NovelDialogue>

        <NovelDialogue speaker="蒼" color="#5a7aa0">
          知ってたよ。
        </NovelDialogue>

        <EmotionTag>高揚 --- 予感 --- 温かさ</EmotionTag>

        {findInContent(ep1?.content, '本当に？') && (
          <NovelQuote>
            明日の朝、目を覚ましたら、窓の外で世界が続いている。<br />
            その世界の中に、わたしはいる。<br />
            それだけで、十分だ。<br /><br />
            <span className="text-primary font-medium">——本当に？</span>
          </NovelQuote>
        )}

        <FullTextLink label={`第一話 全文を読む（${ep1?.wordCount ? `約${ep1.wordCount.toLocaleString()}字` : ''}）`} />
      </section>

      {/* Episode list */}
      {data.episodes.length > 1 && (
        <div className="mt-12 border-t border-border pt-6">
          <p className="text-[11px] text-muted-foreground/50 tracking-wider text-center mb-4">全エピソード</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {data.episodes.map(ep => (
              <Card
                key={ep.id}
                className="px-3 py-2.5 text-xs text-muted-foreground cursor-pointer hover:border-primary/20 transition-colors"
              >
                <span className="text-muted-foreground/40 mr-1">#{ep.orderIndex}</span>
                {ep.title}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SceneHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex justify-between items-center mb-4 pb-3 border-b border-border">
      <h3 className="text-base font-medium font-serif">{title}</h3>
      <span className="text-[11px] text-muted-foreground/50">{meta}</span>
    </div>
  );
}

function findInContent(content: string | undefined, phrase: string): boolean {
  return !!content?.includes(phrase);
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

'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

export default function WorldFragmentsAboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-12">

        {/* Header */}
        <header className="text-center space-y-4">
          <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground/60">
            World Fragments
          </p>
          <h1 className="text-3xl font-serif font-medium tracking-tight">
            世界の断片
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            あなたの物語が、一つの世界になる
          </p>
        </header>

        {/* Section 1: 概要 */}
        <section className="space-y-4">
          <h2 className="text-lg font-serif font-medium">読者の「もしも」に応える</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            あなたが書いた物語の世界に、読者が「もしも」を願えるようになります。
            「あの場面を別のキャラクターの目から見たい」「本編で描かれなかった一瞬を知りたい」
            ——そんな読者の想いに、AIが原作の世界観を壊さずに応えます。
          </p>
        </section>

        {/* Section 2: 原作は聖域 */}
        <section className="space-y-4">
          <h2 className="text-lg font-serif font-medium">原作は聖域</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            キャラクターの人格、関係値、確定した出来事は変更されません。
            あなたの物語を「壊す」のではなく「広げる」機能です。
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            AIが生成する断片は全て、あなたの作品から構築された正典（Canon）の制約内で描かれます。
            Canonはあなた自身で確認・修正でき、世界の一貫性はあなたの手の中にあります。
          </p>
        </section>

        {/* Section 3: 読者の体験 */}
        <section className="space-y-4">
          <h2 className="text-lg font-serif font-medium">読者が願える4つの断片</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-sm font-medium">描かれなかった一瞬</p>
                <p className="text-xs text-muted-foreground">本編から零れ落ちた一瞬を描く</p>
                <p className="text-xs text-muted-foreground/60">25 cr</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-sm font-medium">別の視点</p>
                <p className="text-xs text-muted-foreground">既存シーンを別のキャラクターの目から</p>
                <p className="text-xs text-muted-foreground/60">30 cr</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-sm font-medium">裏側の物語</p>
                <p className="text-xs text-muted-foreground">本編の裏で起きていたこと</p>
                <p className="text-xs text-muted-foreground/60">35 cr</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-sm font-medium">もしも</p>
                <p className="text-xs text-muted-foreground">もし違う選択をしていたら</p>
                <p className="text-xs text-muted-foreground/60">40 cr</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 4: 作者のメリット */}
        <section className="space-y-4">
          <h2 className="text-lg font-serif font-medium">作者のメリット</h2>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-1 bg-primary/20 rounded-full flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">収益還元</p>
                <p className="text-xs text-muted-foreground">読者が消費した有償クレジットの25%があなたに還元されます</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-1 bg-primary/20 rounded-full flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">作品の深層分析</p>
                <p className="text-xs text-muted-foreground">有効化時にAIが全エピソードを分析し、キャラクター一貫性や世界構築の詳細レポートを生成します</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-1 bg-primary/20 rounded-full flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">読者エンゲージメントの深化</p>
                <p className="text-xs text-muted-foreground">読者があなたの世界にもっと長く滞在し、作品の価値が広がります</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: 共有世界 */}
        <section className="space-y-4">
          <h2 className="text-lg font-serif font-medium">共有世界 — 一つの世界で、複数の物語が生まれる</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            あなたが構築した世界を舞台に、新しい物語を創ることができます。
            別の主人公、別の時間軸、別の場所——でも世界のルールは同じ。
            キャラクターが作品を越えて交差する、共有世界型の創作が可能になります。
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            他の作者を招待して、あなたの世界で書いてもらうこともできます。
            世界はあなたが管理し、Canonが一貫性を守ります。
          </p>
        </section>

        {/* Section 6: 有効化について */}
        <section className="space-y-4">
          <h2 className="text-lg font-serif font-medium">有効化について</h2>
          <Card className="border-dashed">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-serif font-medium">30</span>
                <span className="text-sm text-muted-foreground">クレジット（一度きり）</span>
              </div>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>AIが全エピソードを分析し、正典（Canon）を構築します</li>
                <li>構築完了後、Canonの内容を確認・修正できます</li>
                <li>いつでもOFFに戻せます（既存の断片は閲覧可能のまま残ります）</li>
                <li>連載中でも利用可能。新話公開時にCanonは自動更新されます</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Section 7: FAQ */}
        <section className="space-y-4">
          <h2 className="text-lg font-serif font-medium">よくある質問</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">AIが変な内容を書かない？</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Canonの制約で防止されます。キャラクターの人格、世界のルール、確定事実に矛盾する内容は生成されません。
                さらに、Canonの内容はあなた自身で確認・修正できます。
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">連載中でも使える？</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                はい。公開済みの範囲で断片が生成されます。新話を公開するとCanonが自動更新されます。
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">OFFにしたらどうなる？</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                新規の断片生成が停止します。既に生成された断片は閲覧可能のまま残ります。
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">他の作者を招待できる？</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                はい。共有世界機能を使えば、あなたの世界で他の作者が新しい物語を書けます。
                招待制で、あなたが世界の管理者です。
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            作品編集ページの「世界の断片」トグルから有効化できます
          </p>
          <p className="text-xs text-muted-foreground/40">
            World Fragments — 一つの小説が、一つの世界になる
          </p>
        </section>

      </div>
    </div>
  );
}

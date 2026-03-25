'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQItem {
  q: string;
  a: string;
}

const FAQ_SECTIONS: { title: string; items: FAQItem[] }[] = [
  {
    title: 'はじめに',
    items: [
      {
        q: 'アカウントの作成方法は？',
        a: 'トップページの「書きはじめる」または「新規登録」をクリックしてください。ニックネーム、メールアドレス、パスワードを入力してアカウントを作成できます。登録後、オンボーディングクイズに回答すると、おすすめ作品のパーソナライズが可能です。',
      },
      {
        q: 'オンボーディングクイズとは？',
        a: '読書の好みに関する5問の短いクイズです。回答をもとにパーソナライズされた感情ベクトルが生成され、あなたの好みに合った作品をおすすめします。スキップして後から回答することもできます。',
      },
      {
        q: '読みたい作品を探すには？',
        a: '検索ページからタイトルやキーワードで検索できます。また、トップページの感情タグから探したり、「Hidden Gems」でAIスコアが高いのにまだ注目されていない作品を発見することもできます。',
      },
    ],
  },
  {
    title: '読む',
    items: [
      {
        q: '本棚の使い方は？',
        a: '作品を「読みたい」「読書中」「読了」の3つのステータスで本棚に追加できます。エピソードを読み進めると、読書の進捗は自動的に保存されます。',
      },
      {
        q: '読書画面をカスタマイズできますか？',
        a: 'はい。読書中にフォントサイズ（小・中・大・特大）とテーマ（ライト・ダーク・セピア）を変更できます。設定は自動的に保存されます。',
      },
      {
        q: '読了後のフローとは？',
        a: '作品を読み終えると、振り返りフローに進みます。感情タグの記録、作品によって自分がどう変わったかの記録、レビューの執筆ができます。このデータがあなたの読書タイムラインを構築します。',
      },
    ],
  },
  {
    title: '書く',
    items: [
      {
        q: '作品を公開するには？',
        a: '執筆ダッシュボードで「新しい作品」をクリックしてください。タイトル、あらすじ、ジャンルを設定し、エピソードを作成します。準備ができたら、作品のステータスを「公開」に変更してください。',
      },
      {
        q: 'AIスコアリングとは？',
        a: 'AIが作品を「没入感」「変容力」「拡散性」「世界構築力」の4つの軸で分析します。各軸は0〜100点で評価され、改善のヒントも提供されます。作品分析ページから再スコアリングをリクエストできます。',
      },
      {
        q: '作品を非公開にできますか？',
        a: 'はい。作品編集ページからいつでもステータスを「非公開」に変更できます。非公開の作品は検索やおすすめからは表示されなくなりますが、すべてのデータは保持されます。',
      },
    ],
  },
  {
    title: 'アカウント・設定',
    items: [
      {
        q: 'プロフィールを変更するには？',
        a: 'プロフィールページ（ヘッダーまたはボトムナビゲーションからアクセス可能）に移動してください。ニックネーム、表示名、自己紹介を更新できます。',
      },
      {
        q: 'パスワードを変更するには？',
        a: 'プロフィールページから「設定」に移動してください。「セキュリティ」セクションで、現在のパスワードと新しいパスワードを入力して変更できます。',
      },
      {
        q: 'アカウントを削除するには？',
        a: '「設定」に移動し、「危険な操作」セクションまでスクロールしてください。アカウントの削除は取り消せません。すべての作品、レビュー、読書データが削除されます。',
      },
    ],
  },
  {
    title: 'AI機能とデータの取り扱い',
    items: [
      {
        q: '作品データがAIの学習に使われることはありますか？',
        a: 'いいえ、ありません。Workwriteが利用しているAI APIサービス（Anthropic社 Claude API）では、API経由で送信されたデータがモデルの学習（トレーニング）に使用されることはありません。お客様の作品データは、スコアリングや執筆アシスト等のリクエスト処理（推論）にのみ使用されます。',
      },
      {
        q: 'キャラクタートークで作品の内容が外部に流出しませんか？',
        a: 'キャラクタートークの会話はお客様のアカウント内にのみ保存され、外部に公開されることはありません。また、AI APIプロバイダーがデータを保持・再利用することもありません。',
      },
      {
        q: 'AI機能を使いたくない場合は？',
        a: '作品の編集ページから、キャラクタートーク等のAI機能を個別にON/OFFできます。OFFにした場合、その作品はAI機能の対象外となり、キャラクターマッチ等にも表示されません。',
      },
    ],
  },
  {
    title: 'ポイント・タイムライン',
    items: [
      {
        q: 'ポイントを獲得するには？',
        a: 'レビューの執筆、感情タグの記録、読了後の変化の記録でポイントを獲得できます。ポイントはタイムラインページに表示されます。',
      },
      {
        q: 'タイムラインとは？',
        a: '読書を通じて自分がどう変わったかを時系列で記録する機能です。感情タグ、変化の記録（例：自信や世界観の変化）、レビューが表示されます。読書を通じた成長の個人記録です。',
      },
    ],
  },
];

function Accordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left text-sm hover:text-foreground transition-colors"
        aria-expanded={open}
      >
        <span className={cn(open ? 'text-foreground font-medium' : 'text-muted-foreground')}>
          {item.q}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ml-4', open && 'rotate-180')} />
      </button>
      <div className={cn('overflow-hidden transition-all', open ? 'max-h-40 pb-4' : 'max-h-0')}>
        <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="px-4 md:px-6 py-8">
      <h1 className="text-lg font-semibold tracking-wide mb-2">ヘルプ</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Workwriteについてよくある質問
      </p>

      <div className="space-y-10">
        {FAQ_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-xs tracking-[0.15em] text-muted-foreground mb-3">{section.title}</h2>
            <div>
              {section.items.map((item) => (
                <Accordion key={item.q} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 pt-8 border-t border-border text-center">
        <p className="text-sm text-muted-foreground mb-2">他にご質問がありますか？</p>
        <p className="text-sm text-muted-foreground">
          <Link href="/guidelines" className="underline hover:text-foreground transition-colors">投稿ガイドライン</Link>をご覧いただくか、
          お問い合わせ：<a href="mailto:info@workwrite.co.jp" className="text-foreground underline hover:opacity-80">info@workwrite.co.jp</a>
        </p>
      </div>
    </div>
  );
}

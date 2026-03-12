'use client';

import Link from 'next/link';
import { ArrowRight, PenTool, Shield, Sparkles, BookOpen, Users, BarChart3, Heart, Eye, Lightbulb, ChevronDown } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useState } from 'react';

// ─── LP Header ───
function LpHeader() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center px-4 md:px-6">
        <Link href="/lp" className="mr-auto">
          <span className="text-sm font-semibold tracking-wide">Workwrite</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 mr-8">
          <a href="#features" className="text-xs text-muted-foreground hover:text-foreground transition-colors">機能</a>
          <a href="#for-writers" className="text-xs text-muted-foreground hover:text-foreground transition-colors">作家の方へ</a>
          <a href="#ai-stance" className="text-xs text-muted-foreground hover:text-foreground transition-colors">AIへの考え方</a>
          <a href="#faq" className="text-xs text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
            ログイン
          </Link>
          <Link
            href="/register"
            className="text-xs bg-foreground text-background px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity"
          >
            無料で始める
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── Hero ───
function Hero() {
  return (
    <section className="relative pt-14">
      <div className="mx-auto max-w-4xl px-4 md:px-6 pt-24 pb-20 sm:pt-36 sm:pb-28 text-center">
        <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-8 animate-fade-in">
          Novel Platform for Writers
        </p>
        <h1 className="text-3xl sm:text-5xl font-serif font-normal leading-snug tracking-wide">
          あなたの物語は、
          <br />
          もっと届くべきだ。
        </h1>
        <p className="mt-6 text-muted-foreground text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
          ランキングに左右されない。誹謗中傷のない場所で。
          <br className="hidden sm:block" />
          実力で正当に評価される、新しい小説プラットフォーム。
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
          >
            無料で始める <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-full text-sm hover:bg-secondary transition-colors"
          >
            作品を探してみる
          </Link>
        </div>
        <div className="mt-16 flex items-center justify-center gap-8 text-muted-foreground">
          <div className="text-center">
            <p className="text-2xl font-serif font-medium text-foreground">100%</p>
            <p className="text-xs mt-1">無料で利用可能</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="text-center">
            <p className="text-2xl font-serif font-medium text-foreground">AI</p>
            <p className="text-xs mt-1">執筆アシスト搭載</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="text-center">
            <p className="text-2xl font-serif font-medium text-foreground">0</p>
            <p className="text-xs mt-1">ネガティブ機能</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Problem Statement ───
function ProblemSection() {
  const problems = [
    {
      label: '実力があるのに、読まれない',
      description: 'ランキングは更新頻度や固定ファンの数で決まり、作品の質は反映されません。あなたの文章力は、正しく評価されるべきです。',
    },
    {
      label: 'ランキング競争に疲れた',
      description: '毎日更新、タグ戦略、相互評価……。書きたいものを書くために始めたはずの執筆が、いつの間にかマーケティング作業になっていませんか。',
    },
    {
      label: '感想や反応が怖い',
      description: '心を込めた作品にネガティブなコメントがつく恐怖。SNSでの炎上リスク。安心して創作に集中できる場所が必要です。',
    },
    {
      label: '作品を作ってみたい、でも……',
      description: '何から始めればいいかわからない。自分に書けるのか不安。でも「物語を届けたい」という気持ちがあるなら、それで十分です。',
    },
  ];

  return (
    <section className="border-t border-border bg-card">
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-20 sm:py-28">
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground text-center mb-3">Why Workwrite?</p>
        <h2 className="text-xl sm:text-2xl font-serif text-center mb-16">
          こんな思いを抱えていませんか
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {problems.map((p, i) => (
            <div key={i} className="border border-border rounded-lg p-6 bg-background">
              <p className="font-medium text-sm mb-2">{p.label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Solution / Features ───
function FeaturesSection() {
  const features = [
    {
      icon: BarChart3,
      title: 'AIスコアリング',
      subtitle: '更新頻度やファン数ではなく、文章の質で評価',
      description: 'AIが構成力・表現力・キャラクター描写などを多角的に分析。実力のある作品が正当に評価され、読者に届く仕組みです。',
    },
    {
      icon: Eye,
      title: '埋もれた名作の発見',
      subtitle: 'スコアは高いのに読まれていない作品を特集',
      description: 'ランキング上位だけが注目される時代は終わり。品質が高いのに読者数が少ない「隠れた名作」を自動で発掘し、読者に提案します。',
    },
    {
      icon: Heart,
      title: '感情でつながる読書体験',
      subtitle: '「泣きたい」「勇気がほしい」気分で作品を探せる',
      description: 'AIが作品を読み、読後に残る感情を自動タグ付け。今のあなたの気分にぴったりの作品と出会えます。',
    },
    {
      icon: PenTool,
      title: 'AI執筆アシスト',
      subtitle: 'キャラクターの口調、世界観、物語構成をサポート',
      description: '書き出しの提案、続きの執筆、シーン強化、台詞の改善。キャラクター設定や世界観を理解した上で、あなたの創作を支援します。',
    },
    {
      icon: Shield,
      title: '安心・安全な創作環境',
      subtitle: 'ポジティブなフィードバックのみ。批判は可視化しない',
      description: '「拍手」はありますが、低評価ボタンはありません。作家を守りながら、読者との温かいつながりを築ける設計です。',
    },
    {
      icon: BookOpen,
      title: '物語構造の設計ツール',
      subtitle: '三幕構成、キャラクター関係性、伏線管理',
      description: 'ストーリーアーク、幕・シーン設計、キャラクター関係性マップ、伏線トラッカーなど、プロの技法をツールとして提供します。',
    },
  ];

  return (
    <section id="features" className="border-t border-border">
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-20 sm:py-28">
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground text-center mb-3">Features</p>
        <h2 className="text-xl sm:text-2xl font-serif text-center mb-4">
          実力が、正しく届く仕組み
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-16 max-w-md mx-auto">
          いい作品が生まれる。いい作品が埋もれない。最高の作品に出会える。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <div key={i} className="group">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:bg-foreground group-hover:text-background transition-colors">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-medium text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-primary/70 mb-2">{f.subtitle}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── For Writers Section ───
function ForWritersSection() {
  const personas = [
    {
      icon: Sparkles,
      who: '実力はあるのに評価されていない方',
      message: 'Workwriteでは、更新頻度でもフォロワー数でもなく、作品の質で評価されます。AIスコアリングが文章力を正しく測定し、「埋もれた名作」として読者に届けます。あなたが磨いてきた技術は、ここでは正当に輝きます。',
    },
    {
      icon: Heart,
      who: 'ランキング競争に疲れてしまった方',
      message: 'ランキングはありません。毎日更新のプレッシャーもありません。書きたいときに、書きたいものを、書きたいペースで。AIスコアリングは更新頻度に依存しないので、あなたのペースで最高の作品を作ることに集中できます。',
    },
    {
      icon: Shield,
      who: 'ネガティブな反応が怖い方',
      message: '低評価ボタンはありません。批判コメントを可視化する仕組みもありません。読者は「拍手」と「しおり」であなたの作品への感動を伝えます。安心して、あなたの物語を世界に送り出してください。',
    },
    {
      icon: Lightbulb,
      who: '初めて作品を作ってみたい方',
      message: 'AI執筆アシストが、書き出しの提案から物語構成のサポートまで寄り添います。三幕構成テンプレート、キャラクター設計ツール、伏線管理機能。プロの技法を、誰でも使える形で。最初の一歩を踏み出すなら、ここから。',
    },
  ];

  return (
    <section id="for-writers" className="border-t border-border bg-card">
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-20 sm:py-28">
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground text-center mb-3">For Writers</p>
        <h2 className="text-xl sm:text-2xl font-serif text-center mb-16">
          あなたの創作に、最適な場所を
        </h2>
        <div className="space-y-6">
          {personas.map((p, i) => (
            <div key={i} className="border border-border rounded-lg p-6 sm:p-8 bg-background">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <p.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-sm mb-2">{p.who}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── AI Stance Section ───
function AiStanceSection() {
  return (
    <section id="ai-stance" className="border-t border-border">
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-20 sm:py-28">
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground text-center mb-3">Our Stance on AI</p>
        <h2 className="text-xl sm:text-2xl font-serif text-center mb-12">
          AIは、あなたの「ペン」です
        </h2>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            AIはあくまで「道具」です。
            <br />
            ペンがあなたの代わりに小説を書かないように、AIもあなたの意図なしには何も生み出しません。
          </p>
          <p>
            どれだけAIを使うかは、<span className="text-foreground font-medium">あなた自身が決めること</span>です。
          </p>
          <p>
            アイデアの壁打ちだけに使う人も、文章生成まで任せる人も、どちらも<span className="text-foreground font-medium">「あなたが作った作品」</span>だと私たちは考えています。
          </p>
          <p className="text-foreground font-medium text-base font-serif pt-4">
            大切なのは、その物語を届けたいと思った人間がいること。
          </p>
        </div>

        <div className="mt-12 border border-border rounded-lg p-6 bg-card">
          <p className="text-xs font-medium mb-4">Workwriteが提供するAI機能</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              '書き出しの提案',
              '続きの執筆サポート',
              'シーンの強化・推敲',
              '台詞の改善',
              'キャラクター設定の反映',
              '世界観に基づく描写',
              '物語構成の設計',
              '伏線の管理・追跡',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-1 h-1 rounded-full bg-foreground flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ───
function HowItWorks() {
  const steps = [
    {
      step: '01',
      title: '無料で登録',
      description: 'メールアドレスだけで、すぐに始められます。',
    },
    {
      step: '02',
      title: '作品を書く',
      description: '執筆ダッシュボードで作品を作成。AI執筆アシストがあなたの創作をサポートします。',
    },
    {
      step: '03',
      title: 'AIが品質を分析',
      description: '公開すると、AIが構成力・表現力・キャラクター描写などを多角的にスコアリングします。',
    },
    {
      step: '04',
      title: '読者に届く',
      description: '品質スコアと感情タグで、あなたの作品を求めている読者のもとへ届きます。',
    },
  ];

  return (
    <section className="border-t border-border bg-card">
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-20 sm:py-28">
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground text-center mb-3">How It Works</p>
        <h2 className="text-xl sm:text-2xl font-serif text-center mb-16">
          始め方はシンプル
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((s) => (
            <div key={s.step} className="text-center">
              <p className="text-2xl font-serif text-muted-foreground/40 mb-3">{s.step}</p>
              <p className="font-medium text-sm mb-2">{s.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── For Readers ───
function ForReadersSection() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-4xl px-4 md:px-6 py-20 sm:py-28">
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground text-center mb-3">For Readers</p>
        <h2 className="text-xl sm:text-2xl font-serif text-center mb-4">
          読者の方へ
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-12 max-w-md mx-auto">
          ランキングに頼らない、新しい作品との出会い方。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
              <Heart className="h-5 w-5" />
            </div>
            <p className="font-medium text-sm mb-2">気分で探せる</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              「泣きたい」「勇気がほしい」「癒されたい」。今のあなたの気分から、ぴったりの作品が見つかります。
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
              <Eye className="h-5 w-5" />
            </div>
            <p className="font-medium text-sm mb-2">名作に出会える</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AIスコアリングで品質が保証された作品だけが並びます。更新頻度で上位に来る作品ではなく、本当に面白い作品を。
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-5 w-5" />
            </div>
            <p className="font-medium text-sm mb-2">読書を記録する</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              読んだ作品、感動した場面、心に残った一文。読書体験を記録し、自分の変化を振り返れます。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ───
function FaqSection() {
  const faqs = [
    {
      q: '利用料金はかかりますか？',
      a: 'いいえ。作品の執筆・公開・閲覧はすべて無料です。AI執筆アシストも無料でご利用いただけます。',
    },
    {
      q: 'AI執筆アシストを使った作品は「自分の作品」と言えますか？',
      a: '私たちは「はい」と考えています。ペンがあなたの代わりに小説を書かないように、AIもあなたの意図なしには何も生み出しません。どの程度AIを使うかはあなた次第です。アイデアの壁打ちだけでも、文章生成まで任せても、その物語を届けたいと思ったのはあなたです。',
    },
    {
      q: '他の小説投稿サイトとの違いは何ですか？',
      a: 'ランキングの代わりにAIスコアリングを採用し、作品の質を客観的に評価します。更新頻度やフォロワー数に左右されず、実力のある作品が読者に届く仕組みです。また、低評価ボタンがなく、ポジティブなフィードバックのみの安全な環境です。',
    },
    {
      q: 'AIスコアリングはどのように動作しますか？',
      a: 'AIが物語構成、文章表現力、キャラクター描写、テーマの一貫性などを多角的に分析し、作品の品質をスコアリングします。更新頻度や人気度ではなく、純粋に作品の質を評価します。',
    },
    {
      q: '初心者でも使えますか？',
      a: 'もちろんです。AI執筆アシストが書き出しの提案から物語構成のサポートまで寄り添います。三幕構成テンプレートやキャラクター設計ツールなど、プロの技法を誰でも使える形で提供しています。',
    },
    {
      q: 'どんなジャンルの作品が書けますか？',
      a: 'ファンタジー、SF、ミステリー、恋愛、ホラー、純文学、冒険、コメディ、ドラマ、歴史など、あらゆるジャンルに対応しています。',
    },
  ];

  return (
    <section id="faq" className="border-t border-border bg-card">
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-20 sm:py-28">
        <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground text-center mb-3">FAQ</p>
        <h2 className="text-xl sm:text-2xl font-serif text-center mb-12">
          よくある質問
        </h2>
        <div className="space-y-0 divide-y divide-border">
          {faqs.map((faq, i) => (
            <FaqItem key={i} question={faq.q} answer={faq.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left py-5 group"
      >
        <span className="text-sm font-medium pr-4">{question}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <p className="text-xs text-muted-foreground leading-relaxed pb-5 pr-8">
          {answer}
        </p>
      )}
    </div>
  );
}

// ─── CTA ───
function CtaSection() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-24 sm:py-32 text-center">
        <h2 className="text-xl sm:text-3xl font-serif mb-4">
          あなたの物語を、待っている人がいる。
        </h2>
        <p className="text-sm text-muted-foreground mb-10 max-w-md mx-auto leading-relaxed">
          ランキングに消耗する時代は終わりました。
          <br />
          書きたいものを、書きたいペースで。
          <br />
          実力で評価される場所で、創作を始めませんか。
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-foreground text-background px-8 py-3.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
          >
            無料で始める <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 border border-border px-8 py-3.5 rounded-full text-sm hover:bg-secondary transition-colors"
          >
            まず作品を探す
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───
function LpFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold tracking-wide">Workwrite</span>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">ホーム</Link>
            <Link href="/search" className="hover:text-foreground transition-colors">作品を探す</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">新規登録</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">ログイン</Link>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-8">
          &copy; {new Date().getFullYear()} Workwrite. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

// ─── Main LP Page ───
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LpHeader />
      <Hero />
      <ProblemSection />
      <FeaturesSection />
      <ForWritersSection />
      <AiStanceSection />
      <HowItWorks />
      <ForReadersSection />
      <FaqSection />
      <CtaSection />
      <LpFooter />
    </div>
  );
}

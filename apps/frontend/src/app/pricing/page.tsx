'use client';

import Link from 'next/link';
import { Check, ArrowRight, Sparkles, Zap, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/lib/auth-context';
import { api, type BillingStatus } from '@/lib/api';
import { useState, useEffect } from 'react';

const PLANS = [
  {
    name: 'Free',
    price: '¥0',
    period: '',
    credits: '10cr / 月',
    creditsNote: '簡易アシスト約2〜5回相当',
    icon: Sparkles,
    highlight: false,
    cta: '無料で始める',
    ctaHref: '/register',
    features: [
      '作品の執筆・公開・閲覧',
      'AI執筆アシスト（簡易 1cr〜/回）',
      'AIスコアリング（1cr〜/回）',
      '読書進捗・統計',
      'レター（月3通まで無料）',
      'ハイライト・しおり機能',
      'AI読書コンパニオン（週5回）',
      'AI作品分析・レコメンド',
    ],
    limitations: [
      'クレジット追加購入は¥25/cr（サブスク会員はさらにお得）',
      'AI読書コンパニオンは週5回まで',
    ],
  },
  {
    name: 'Standard',
    price: '¥2,980',
    period: '/ 月',
    credits: '200cr / 月',
    creditsNote: '簡易アシスト約33〜100回 or 通常約14〜40回相当',
    icon: Zap,
    highlight: true,
    cta: 'Standard を始める',
    ctaHref: '/register',
    features: [
      'Freeプランの全機能',
      'AI執筆アシスト（通常モード 5cr〜/回）',
      'AI執筆アシスト（高精度モード 30cr〜/回）',
      'AI読書コンパニオン 無制限',
      'クレジット追加購入（100cr = ¥980）',
      '7日間の無料トライアル',
    ],
    limitations: [],
  },
  {
    name: 'Pro',
    price: '¥7,980',
    period: '/ 月',
    credits: '600cr / 月',
    creditsNote: '簡易アシスト約100〜300回 or 通常約40〜120回相当',
    icon: Crown,
    highlight: false,
    cta: 'Pro を始める',
    ctaHref: '/register',
    features: [
      'Standardプランの全機能',
      '大容量クレジット（月600cr）',
      'AI読書コンパニオン 無制限',
      'クレジット追加購入（100cr = ¥880）',
      '7日間の無料トライアル',
    ],
    limitations: [],
  },
];

const CREDIT_TABLE = [
  { action: 'AI執筆アシスト（簡易）', credits: '1cr〜', note: '入力文字数に応じて変動' },
  { action: 'AI執筆アシスト（通常）', credits: '5cr〜', note: '入力文字数に応じて変動 — Standard以上' },
  { action: 'AI執筆アシスト（高精度）', credits: '30cr〜', note: '入力文字数に応じて変動 — Standard以上' },
  { action: 'Creation Wizard（各ステップ）', credits: '1cr', note: 'キャラクター・プロット・感情・章立て' },
  { action: 'AIスコアリング（作品品質分析）', credits: '1cr〜', note: '作品の文字数に応じて変動（実行前に見積もり表示）' },
  { action: '読書タイプ再診断', credits: '1cr', note: '初回は無料、2回目以降' },
  { action: '校正・推敲', credits: '0cr', note: 'プラットフォーム負担' },
  { action: 'あらすじ自動生成', credits: '0cr', note: 'プラットフォーム負担' },
  { action: 'ハイライトAI解説', credits: '0cr', note: 'プラットフォーム負担' },
  { action: 'AI読書コンパニオン', credits: '0cr', note: 'Free: 週5回 / Standard以上: 無制限' },
  { action: 'AI作品分析（インサイト）', credits: '0cr', note: 'プラットフォーム負担' },
  { action: 'AI類似作品レコメンド', credits: '0cr', note: 'プラットフォーム負担' },
  { action: '構造解析・キャラクター抽出', credits: '0cr', note: 'プラットフォーム負担' },
  { action: 'エンベディング生成', credits: '0cr', note: 'プラットフォーム負担' },
];

const FAQS = [
  {
    q: 'クレジットとは何ですか？',
    a: 'クレジットはAI機能の利用に消費されるプラットフォーム内の単位です。AI執筆アシストやスコアリングは入力文字数に応じて消費量が変動し、実行前に見積もりが表示されます。校正・あらすじ生成・ハイライト解説などの軽量処理はクレジットを消費しません。',
  },
  {
    q: 'クレジットは翌月に繰り越せますか？',
    a: '月間付与クレジットは翌月への繰り越しはできません。ただし、追加購入したクレジットは無期限でご利用いただけます。',
  },
  {
    q: '無料トライアルはありますか？',
    a: 'Standard・Proプランには7日間の無料トライアルがあります。トライアル期間中はプランの全クレジットをご利用いただけます。トライアル中のキャンセルで課金は発生しません。',
  },
  {
    q: 'プランの変更やキャンセルはいつでもできますか？',
    a: 'いつでも変更・キャンセルが可能です。アップグレードは即座に反映され、差額分のクレジットが日割りで付与されます。ダウングレード・キャンセルは現在の請求期間の終了時に反映されます。',
  },
  {
    q: '作品の執筆・公開・閲覧に料金はかかりますか？',
    a: 'いいえ。作品の執筆・公開・閲覧、読書体験に関する機能（ハイライト、しおり、読書統計など）はすべて無料です。課金はAI執筆アシストのクレジットに関連する部分のみです。',
  },
  {
    q: '読者向けAI機能に制限はありますか？',
    a: 'AI読書コンパニオン（作品についてAIと対話する機能）はFreeプランでは週5回まで、Standard・Proプランでは無制限です。AI作品分析やレコメンドはクレジット消費なし・回数制限なしでご利用いただけます。',
  },
  {
    q: 'レターの料金はプランに含まれますか？',
    a: 'レターは全ユーザーが月3通まで無料で送れます。それ以上は1通¥120〜¥1,000+の都度課金となり、プランのクレジットとは別の仕組みです。',
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left py-5 group"
      >
        <span className="text-sm font-medium pr-4">{question}</span>
        <span className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
        </span>
      </button>
      {open && (
        <p className="text-xs text-muted-foreground leading-relaxed pb-5 pr-8">{answer}</p>
      )}
    </div>
  );
}

export default function PricingPage() {
  const { isAuthenticated } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.getBillingStatus()
      .then((res) => setBilling((res as any)?.data ?? res))
      .catch(() => {});
  }, [isAuthenticated]);

  const currentPlan = billing?.plan || 'free';

  async function handleCheckout(plan: string) {
    if (!isAuthenticated || plan === 'Free') return;
    const planId = plan.toLowerCase();
    setCheckoutLoading(planId);
    try {
      const res = await api.createCheckout(planId);
      const url = (res as any)?.url ?? (res as any)?.data?.url;
      if (url) window.location.href = url;
    } catch {
      // Fall back to billing page
      window.location.href = '/settings/billing';
    } finally {
      setCheckoutLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4 md:px-6">
          <Link href={isAuthenticated ? '/' : '/lp'} className="mr-auto">
            <span className="text-sm font-semibold tracking-wide">Workwrite</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link
                href="/"
                className="text-xs bg-foreground text-background px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity"
              >
                ホームへ
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
                  ログイン
                </Link>
                <Link
                  href="/register"
                  className="text-xs bg-foreground text-background px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity"
                >
                  無料で始める
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-14">
        <div className="mx-auto max-w-4xl px-4 md:px-6 pt-20 pb-12 text-center">
          <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6">Pricing</p>
          <h1 className="text-3xl sm:text-4xl font-serif leading-snug tracking-wide">
            料金プラン
          </h1>
          <p className="mt-4 text-muted-foreground text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
            基本機能は無料。AI執筆アシストをもっと使いたい方には、
            <br className="hidden sm:block" />
            クレジット制の有料プランをご用意しています。
          </p>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="pb-16">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-xl border p-6 flex flex-col ${
                  plan.highlight
                    ? 'border-foreground bg-card shadow-lg'
                    : 'border-border bg-background'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-medium px-3 py-1 rounded-full">
                    おすすめ
                  </div>
                )}
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    plan.highlight ? 'bg-foreground text-background' : 'bg-secondary'
                  }`}>
                    <plan.icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-medium">{plan.name}</h3>
                </div>
                <div className="mb-1">
                  <span className="text-3xl font-serif font-medium">{plan.price}</span>
                  {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
                </div>
                <div className="mb-6">
                  <p className="text-sm font-medium text-primary">{plan.credits}</p>
                  <p className="text-[11px] text-muted-foreground">{plan.creditsNote}</p>
                </div>

                {/* Current plan badge */}
                {isAuthenticated && currentPlan === plan.name.toLowerCase() && (
                  <div className="mb-3">
                    <span className="inline-block text-[10px] font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                      現在のプラン
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  {isAuthenticated && currentPlan === plan.name.toLowerCase() ? (
                    <Link href="/settings/billing">
                      <Button
                        className="w-full"
                        variant="outline"
                      >
                        プランを管理
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  ) : isAuthenticated && plan.name !== 'Free' ? (
                    <Button
                      className={`w-full`}
                      variant={plan.highlight ? 'default' : 'outline'}
                      onClick={() => handleCheckout(plan.name)}
                      disabled={checkoutLoading === plan.name.toLowerCase()}
                    >
                      {checkoutLoading === plan.name.toLowerCase() ? '処理中...' : `${plan.name} を始める`}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  ) : (
                    <Link href={isAuthenticated ? '/settings/billing' : plan.ctaHref}>
                      <Button
                        className={`w-full`}
                        variant={plan.highlight ? 'default' : 'outline'}
                      >
                        {isAuthenticated ? 'プランを管理' : plan.cta}
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>

                <div className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-xs leading-relaxed">{f}</span>
                    </div>
                  ))}
                  {plan.limitations.map((l) => (
                    <div key={l} className="flex items-start gap-2">
                      <span className="text-xs text-muted-foreground mt-0.5 flex-shrink-0">-</span>
                      <span className="text-xs text-muted-foreground leading-relaxed">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Credit Table */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-16">
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground text-center mb-3">Credits</p>
          <h2 className="text-xl sm:text-2xl font-serif text-center mb-4">
            クレジット消費テーブル
          </h2>
          <p className="text-xs text-muted-foreground text-center mb-10 max-w-md mx-auto">
            AI執筆アシスト・スコアリング・インポートがクレジットを消費します。校正・あらすじ・解説などの軽量処理は無料です。
          </p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 text-xs font-medium">機能</th>
                  <th className="text-center px-4 py-3 text-xs font-medium w-24">消費</th>
                  <th className="text-left px-4 py-3 text-xs font-medium hidden sm:table-cell">備考</th>
                </tr>
              </thead>
              <tbody>
                {CREDIT_TABLE.map((row, i) => (
                  <tr key={i} className={i < CREDIT_TABLE.length - 1 ? 'border-b border-border/50' : ''}>
                    <td className="px-4 py-3 text-xs">{row.action}</td>
                    <td className={`px-4 py-3 text-xs text-center font-medium ${
                      row.credits === '0cr' ? 'text-green-600 dark:text-green-400' : ''
                    }`}>{row.credits}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Free Features */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-16">
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground text-center mb-3">Always Free</p>
          <h2 className="text-xl sm:text-2xl font-serif text-center mb-10">
            プランに関わらず無料の機能
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              '作品の執筆・公開・閲覧',
              '校正・推敲（0cr）',
              'あらすじ自動生成（0cr）',
              'ハイライト・しおり・AI解説（0cr）',
              '感情タグの自動生成',
              '全文検索・作品の発見',
              '読書進捗・統計・ストリーク',
              'AI作品分析・レコメンド（0cr）',
              'AI読書コンパニオン（Free: 週5回）',
              'キャラクター設計ツール',
              '物語構造テンプレート',
              'レター（月3通まで）',
              'SNS投稿・フォロー',
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-xs">
                <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-16">
          <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground text-center mb-3">FAQ</p>
          <h2 className="text-xl sm:text-2xl font-serif text-center mb-10">
            料金に関するよくある質問
          </h2>
          <div className="space-y-0 divide-y divide-border">
            {FAQS.map((faq, i) => (
              <FaqItem key={i} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Credit Purchase (logged in, paid plan) */}
      {isAuthenticated && currentPlan !== 'free' && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-3xl px-4 md:px-6 py-16 text-center">
            <p className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-3">Add Credits</p>
            <h2 className="text-xl sm:text-2xl font-serif mb-4">
              クレジット追加購入
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              月間クレジットが足りなくなったら、いつでも追加購入できます。
              <br />
              購入クレジットは無期限でご利用いただけます。
            </p>
            <div className="inline-flex items-center gap-6 border border-border rounded-xl px-8 py-6">
              <div className="text-left">
                <p className="text-lg font-serif font-medium">100cr</p>
                <p className="text-xs text-muted-foreground">
                  {currentPlan === 'pro' ? '¥880' : '¥980'}
                </p>
              </div>
              <Button
                onClick={async () => {
                  try {
                    const res = await api.purchaseCredits();
                    const url = (res as any)?.url ?? (res as any)?.data?.url;
                    if (url) window.location.href = url;
                  } catch { /* ignore */ }
                }}
              >
                購入する
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 md:px-6 py-20 text-center">
          <h2 className="text-xl sm:text-2xl font-serif mb-4">
            まずは無料で始めてみませんか
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
            Free プランでAI執筆アシスト月20回、AI読書コンパニオン週5回が利用できます。
            <br />
            もっと使いたくなったら、いつでもアップグレード。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={isAuthenticated ? '/' : '/register'}>
              <Button className="gap-2 px-8 py-3 rounded-full">
                {isAuthenticated ? 'ホームへ' : '無料で始める'} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/lp">
              <Button variant="outline" className="px-8 py-3 rounded-full">
                Workwrite について
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 md:px-6 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm font-semibold tracking-wide">Workwrite</span>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">ホーム</Link>
              <Link href="/search" className="hover:text-foreground transition-colors">作品を探す</Link>
              <Link href="/lp" className="hover:text-foreground transition-colors">LPへ</Link>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-8">
            &copy; {new Date().getFullYear()} Workwrite. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api, type BillingStatus, type CreditTransaction } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loading } from '@/components/layout/loading';
import { Check, ArrowRight, Sparkles, Zap, Crown, CreditCard, History, ExternalLink, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '\u00A50',
    credits: '20cr / \u6708',
    icon: Sparkles,
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '\u00A52,980',
    credits: '200cr / \u6708',
    icon: Zap,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '\u00A57,980',
    credits: '600cr / \u6708',
    icon: Crown,
  },
];

const TX_TYPE_LABELS: Record<string, string> = {
  MONTHLY_GRANT: '\u6708\u9593\u4ED8\u4E0E',
  PURCHASE: '\u8CFC\u5165',
  CONSUME: '\u6D88\u8CBB',
  EXPIRE: '\u5931\u52B9',
  ADMIN_GRANT: '\u7BA1\u7406\u8005\u4ED8\u4E0E',
  ADMIN_REVOKE: '\u7BA1\u7406\u8005\u5263\u596A',
  REFUND: '\u8FD4\u91D1',
  PLAN_CHANGE_ADJUST: '\u30D7\u30E9\u30F3\u5909\u66F4\u8ABF\u6574',
  REVIEW_REWARD: '報酬',
  REFERRAL_REWARD: '招待報酬',
};

export default function BillingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.getBillingStatus().then((res) => {
        const data = (res as any)?.data ?? res;
        setBilling(data);
      }).catch(() => {}),
      api.getTransactions(1, 10).then((res) => {
        // Handle both { data, total } and raw response shapes
        const data = (res as any)?.data ?? res;
        if (Array.isArray(data)) {
          setTransactions(data);
          setTxTotal((res as any)?.total ?? data.length);
        } else if (data?.data) {
          setTransactions(data.data);
          setTxTotal(data.total ?? 0);
        }
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [user]);

  if (isLoading || loading) return <Loading />;
  if (!user) {
    router.push('/login');
    return null;
  }

  const currentPlan = billing?.plan || 'free';
  const credits = billing?.credits || { total: 0, monthly: 0, purchased: 0 };

  async function handleCheckout(plan: string) {
    if (plan === 'free') return;
    setCheckoutLoading(plan);
    try {
      const res = await api.createCheckout(plan);
      const url = (res as any)?.url ?? (res as any)?.data?.url;
      if (url) window.location.href = url;
    } catch (err: any) {
      alert(err.message || '\u30C1\u30A7\u30C3\u30AF\u30A2\u30A6\u30C8\u306E\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F');
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleCancel() {
    if (!confirm('\u672C\u5F53\u306B\u30D7\u30E9\u30F3\u3092\u30AD\u30E3\u30F3\u30BB\u30EB\u3057\u307E\u3059\u304B\uFF1F\u73FE\u5728\u306E\u8ACB\u6C42\u671F\u9593\u306E\u7D42\u4E86\u6642\u306BFree\u30D7\u30E9\u30F3\u306B\u623B\u308A\u307E\u3059\u3002')) return;
    setCancelLoading(true);
    try {
      await api.cancelSubscription();
      const res = await api.getBillingStatus();
      setBilling((res as any)?.data ?? res);
    } catch { /* ignore */ }
    setCancelLoading(false);
  }

  async function handlePurchaseCredits(tier?: 'free_500' | 'free_1000') {
    try {
      const res = await api.purchaseCredits(tier);
      const url = (res as any)?.url ?? (res as any)?.data?.url;
      if (url) window.location.href = url;
    } catch (err: any) {
      alert(err.message || '\u30AF\u30EC\u30B8\u30C3\u30C8\u8CFC\u5165\u306B\u5931\u6557\u3057\u307E\u3057\u305F');
    }
  }

  async function handlePortal() {
    try {
      const res = await api.createPortalSession();
      const url = (res as any)?.url ?? (res as any)?.data?.url;
      if (url) window.location.href = url;
    } catch { /* ignore */ }
  }

  const planIcon = currentPlan === 'pro' ? Crown : currentPlan === 'standard' ? Zap : Sparkles;
  const PlanIcon = planIcon;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold">{'\u30D7\u30E9\u30F3\u3068\u8AB2\u91D1'}</h1>
          <p className="text-sm text-muted-foreground mt-1">{'\u73FE\u5728\u306E\u30D7\u30E9\u30F3\u306E\u78BA\u8A8D\u3068\u30A2\u30C3\u30D7\u30B0\u30EC\u30FC\u30C9'}</p>
        </div>
        <Link href="/settings">
          <Button variant="ghost" size="sm">{'\u8A2D\u5B9A\u306B\u623B\u308B'}</Button>
        </Link>
      </div>

      {/* Current Status */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-sm">{'\u73FE\u5728\u306E\u30B9\u30C6\u30FC\u30BF\u30B9'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <PlanIcon className="h-4 w-4" />
                <span className="font-medium">{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} {'\u30D7\u30E9\u30F3'}</span>
              </div>
              {billing?.subscription?.cancelAtPeriodEnd && (
                <p className="text-xs text-amber-600 mt-1">{'\u30AD\u30E3\u30F3\u30BB\u30EB\u4E88\u5B9A\uFF08\u671F\u9593\u7D42\u4E86\u6642\uFF09'}</p>
              )}
              {billing?.subscription?.trialEnd && new Date(billing.subscription.trialEnd) > new Date() && (
                <p className="text-xs text-blue-600 mt-1">{'\u30C8\u30E9\u30A4\u30A2\u30EB\u4E2D\uFF08'}~{new Date(billing.subscription.trialEnd).toLocaleDateString('ja-JP')}{')'}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-serif font-medium">
                {credits.total}<span className="text-sm text-muted-foreground ml-1">cr</span>
              </p>
              <p className="text-[11px] text-muted-foreground">{'\u6B8B\u30AF\u30EC\u30B8\u30C3\u30C8'}</p>
              <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                <span>{'\u6708\u9593'}: {credits.monthly}cr</span>
                <span>{'\u8CFC\u5165'}: {credits.purchased}cr</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Selection */}
      <h2 className="text-sm font-medium mb-4">{'\u30D7\u30E9\u30F3\u3092\u9078\u629E'}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <div
              key={plan.id}
              className={`rounded-lg border p-4 ${isCurrent ? 'border-foreground bg-card' : 'border-border'}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <plan.icon className="h-4 w-4" />
                <span className="text-sm font-medium">{plan.name}</span>
              </div>
              <p className="text-xl font-serif font-medium">{plan.price}</p>
              <p className="text-xs text-muted-foreground mb-4">{plan.credits}</p>
              {isCurrent ? (
                <Button variant="outline" size="sm" className="w-full" disabled>
                  {'\u73FE\u5728\u306E\u30D7\u30E9\u30F3'}
                </Button>
              ) : plan.id === 'free' ? (
                currentPlan !== 'free' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleCancel}
                    disabled={cancelLoading}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    {cancelLoading ? '\u51E6\u7406\u4E2D...' : '\u30C0\u30A6\u30F3\u30B0\u30EC\u30FC\u30C9'}
                  </Button>
                ) : null
              ) : (
                <Button
                  variant={plan.id === 'standard' ? 'default' : 'outline'}
                  size="sm"
                  className="w-full"
                  onClick={() => handleCheckout(plan.id)}
                  disabled={checkoutLoading === plan.id}
                >
                  <CreditCard className="h-3 w-3 mr-1" />
                  {checkoutLoading === plan.id ? '\u51E6\u7406\u4E2D...' : '\u30A2\u30C3\u30D7\u30B0\u30EC\u30FC\u30C9'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Credit Purchase */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          {currentPlan !== 'free' ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{'クレジット追加購入'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  100cr = {currentPlan === 'pro' ? '¥880' : '¥980'}
                </p>
              </div>
              <Button size="sm" onClick={() => handlePurchaseCredits()}>
                {'購入する'}
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium mb-1">{'クレジット購入'}</p>
              <p className="text-xs text-muted-foreground mb-4">
                {'購入したクレジットは有効期限なし。サブスク会員はさらにお得に購入できます。'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handlePurchaseCredits('free_500')}
                  className="rounded-lg border border-border p-4 text-left hover:border-foreground transition-colors"
                >
                  <p className="text-lg font-serif font-medium">¥500</p>
                  <p className="text-sm text-muted-foreground">20cr</p>
                  <p className="text-[10px] text-muted-foreground mt-1">¥25 / cr</p>
                </button>
                <button
                  onClick={() => handlePurchaseCredits('free_1000')}
                  className="rounded-lg border border-border p-4 text-left hover:border-foreground transition-colors"
                >
                  <p className="text-lg font-serif font-medium">¥1,000</p>
                  <p className="text-sm text-muted-foreground">40cr</p>
                  <p className="text-[10px] text-muted-foreground mt-1">¥25 / cr</p>
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" />
            {'\u53D6\u5F15\u5C65\u6B74'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-xs text-muted-foreground">{'\u53D6\u5F15\u5C65\u6B74\u306F\u3042\u308A\u307E\u305B\u3093'}</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-xs border-b border-border/50 pb-2">
                  <div>
                    <span className={`font-medium ${tx.amount > 0 ? 'text-green-600' : tx.status === 'refunded' ? 'text-blue-600' : ''}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}cr
                    </span>
                    <span className="text-muted-foreground ml-2">
                      {TX_TYPE_LABELS[tx.type] || tx.type}
                    </span>
                    {tx.relatedFeature && (
                      <span className="text-muted-foreground ml-1">({tx.relatedFeature})</span>
                    )}
                    {tx.status === 'refunded' && (
                      <span className="text-blue-600 ml-1">[{'\u8FD4\u91D1\u6E08'}]</span>
                    )}
                  </div>
                  <span className="text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {txTotal > transactions.length && (
                <button
                  onClick={async () => {
                    const next = txPage + 1;
                    try {
                      const res = await api.getTransactions(next, 10);
                      const data = (res as any)?.data ?? res;
                      if (Array.isArray(data)) {
                        setTransactions((prev) => [...prev, ...data]);
                      } else if (data?.data) {
                        setTransactions((prev) => [...prev, ...data.data]);
                      }
                      setTxPage(next);
                    } catch { /* ignore */ }
                  }}
                  className="text-xs text-primary hover:underline w-full text-center pt-2"
                >
                  {'\u3082\u3063\u3068\u898B\u308B'}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stripe Portal & Links */}
      <div className="flex gap-4">
        {currentPlan !== 'free' && (
          <Button variant="outline" size="sm" className="gap-1" onClick={handlePortal}>
            <ExternalLink className="h-3 w-3" />
            {'\u8ACB\u6C42\u7BA1\u7406\uFF08Stripe\uFF09'}
          </Button>
        )}
        <Link href="/pricing" className="flex-1">
          <Button variant="outline" size="sm" className="w-full gap-1">
            {'\u6599\u91D1\u30D7\u30E9\u30F3\u8A73\u7D30'} <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

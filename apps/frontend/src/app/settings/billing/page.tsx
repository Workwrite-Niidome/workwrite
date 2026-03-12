'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loading } from '@/components/layout/loading';
import { Check, ArrowRight, Sparkles, Zap, Crown, CreditCard, History } from 'lucide-react';
import { useRouter } from 'next/navigation';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '¥0',
    credits: '30cr / 月',
    icon: Sparkles,
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '¥2,980',
    credits: '200cr / 月',
    icon: Zap,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '¥7,980',
    credits: '600cr / 月',
    icon: Crown,
  },
];

export default function BillingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  if (isLoading) return <Loading />;
  if (!user) {
    router.push('/login');
    return null;
  }

  // Current plan — default to free (will be replaced by API call when Stripe is connected)
  const currentPlan = 'free';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold">プランと課金</h1>
          <p className="text-sm text-muted-foreground mt-1">現在のプランの確認とアップグレード</p>
        </div>
        <Link href="/settings">
          <Button variant="ghost" size="sm">設定に戻る</Button>
        </Link>
      </div>

      {/* Current Status */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-sm">現在のステータス</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="font-medium">Free プラン</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">月30クレジット</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-serif font-medium">30<span className="text-sm text-muted-foreground ml-1">cr</span></p>
              <p className="text-[11px] text-muted-foreground">残クレジット</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Selection */}
      <h2 className="text-sm font-medium mb-4">プランを選択</h2>
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
                  現在のプラン
                </Button>
              ) : (
                <Button
                  variant={plan.id === 'standard' ? 'default' : 'outline'}
                  size="sm"
                  className="w-full"
                  disabled
                >
                  <CreditCard className="h-3 w-3 mr-1" />
                  準備中
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Info */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-1">決済機能は準備中です</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                有料プランのStripe決済接続は現在準備中です。接続が完了次第、Standard / Pro プランへのアップグレードが可能になります。
                プランの詳細は<Link href="/pricing" className="underline hover:text-foreground">料金プラン</Link>をご覧ください。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="flex gap-4">
        <Link href="/pricing" className="flex-1">
          <Button variant="outline" size="sm" className="w-full gap-1">
            料金プラン詳細 <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

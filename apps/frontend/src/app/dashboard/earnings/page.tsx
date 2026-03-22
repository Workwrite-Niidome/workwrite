'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { DollarSign, TrendingUp, Mail, MessageCircle, Info, ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Earnings {
  totalLetters: number;
  monthlyLetters: number;
  totalEarnings: number;
  monthlyEarnings: number;
  platformCutRate: number;
}

interface ConnectStatus {
  hasAccount: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

interface TalkEarnings {
  totalRevenue: number;
  monthlyRevenue: number;
  totalSessions: number;
  monthlySessions: number;
  platformCutRate: number;
}

function EarningsPageContent() {
  const searchParams = useSearchParams();
  const connectResult = searchParams.get('connect');

  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [talkEarnings, setTalkEarnings] = useState<TalkEarnings | null>(null);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getLetterEarnings()
        .then((res) => setEarnings((res as any).data || null))
        .catch(() => {}),
      api.getCharacterTalkEarnings()
        .then((res) => setTalkEarnings((res as any).data || (res as any) || null))
        .catch(() => {}),
      api.getConnectStatus()
        .then((res) => setConnectStatus((res as any).data || null))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const [error, setError] = useState('');

  async function handleOnboarding() {
    setOnboardingLoading(true);
    setError('');
    try {
      const res = await api.createConnectOnboarding();
      const url = (res as any)?.url ?? (res as any)?.data?.url;
      if (url) {
        window.location.href = url;
      } else {
        setError('Stripeへのリダイレクトに失敗しました。もう一度お試しください。');
      }
    } catch (err: any) {
      setError(err.message || 'Stripe Connectの設定に失敗しました。しばらくしてからお試しください。');
    } finally {
      setOnboardingLoading(false);
    }
  }

  async function handleConnectLogin() {
    try {
      const res = await api.createConnectLoginLink();
      const url = (res as any)?.url ?? (res as any)?.data?.url;
      if (url) window.open(url, '_blank');
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  const isConnectReady = connectStatus?.chargesEnabled && connectStatus?.payoutsEnabled;

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">収益ダッシュボード</h1>

      {/* Connect status notification */}
      {connectResult === 'complete' && (
        <div className="p-3 mb-4 text-sm text-green-700 bg-green-50 rounded-md flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Stripe Connectの設定が完了しました。審査後に振込が有効になります。
        </div>
      )}
      {connectResult === 'refresh' && (
        <div className="p-3 mb-4 text-sm text-amber-700 bg-amber-50 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          セッションが期限切れです。もう一度お試しください。
        </div>
      )}

      {error && (
        <div className="p-3 mb-4 text-sm text-red-700 bg-red-50 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Stripe Connect Card */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            振込設定（Stripe Connect）
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!connectStatus?.hasAccount ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                レター収益を受け取るには、Stripe Connectアカウントの設定が必要です。
                設定後、読者からのレター代金（手数料20%控除後）が自動的に振り込まれます。
              </p>
              <Button onClick={handleOnboarding} disabled={onboardingLoading}>
                {onboardingLoading ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> 設定中...</>
                ) : (
                  <>振込設定を開始</>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {isConnectReady ? (
                    <Badge className="bg-green-50 text-green-700 text-xs">有効</Badge>
                  ) : connectStatus.detailsSubmitted ? (
                    <Badge className="bg-amber-50 text-amber-700 text-xs">審査中</Badge>
                  ) : (
                    <Badge className="bg-red-50 text-red-700 text-xs">未完了</Badge>
                  )}
                </div>
                <div className="text-sm">
                  {isConnectReady
                    ? '振込が有効です。レター収益は自動的に振り込まれます。'
                    : connectStatus.detailsSubmitted
                    ? 'Stripeによる審査中です。完了次第振込が有効になります。'
                    : '設定が途中です。続きを完了してください。'}
                </div>
              </div>
              <div className="flex gap-2">
                {!isConnectReady && !connectStatus.detailsSubmitted && (
                  <Button size="sm" onClick={handleOnboarding} disabled={onboardingLoading}>
                    {onboardingLoading ? '設定中...' : '設定を続ける'}
                  </Button>
                )}
                {connectStatus.detailsSubmitted && (
                  <Button variant="outline" size="sm" onClick={handleConnectLogin}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Stripeダッシュボード
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {earnings ? (
        <>
          {/* Main stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Card>
              <CardContent className="py-4 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <p className="text-xs text-muted-foreground">累計収益</p>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  ¥{earnings.totalEarnings.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <p className="text-xs text-muted-foreground">今月の収益</p>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  ¥{earnings.monthlyEarnings.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">累計レター数</p>
                </div>
                <p className="text-2xl font-bold">{earnings.totalLetters}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">今月のレター数</p>
                </div>
                <p className="text-2xl font-bold">{earnings.monthlyLetters}</p>
              </CardContent>
            </Card>
          </div>

          {/* Character Talk earnings */}
          {talkEarnings && (talkEarnings.totalRevenue > 0 || talkEarnings.totalSessions > 0) && (
            <>
              <h2 className="text-lg font-semibold mt-8 mb-3">キャラクタートーク収益</h2>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <Card>
                  <CardContent className="py-4 px-4">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <p className="text-xs text-muted-foreground">累計収益</p>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      ¥{talkEarnings.totalRevenue.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 px-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <p className="text-xs text-muted-foreground">今月の収益</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">
                      ¥{talkEarnings.monthlyRevenue.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 px-4">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">累計セッション</p>
                    </div>
                    <p className="text-2xl font-bold">{talkEarnings.totalSessions}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 px-4">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">今月のセッション</p>
                    </div>
                    <p className="text-2xl font-bold">{talkEarnings.monthlySessions}</p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Platform fee explanation */}
          <Card>
            <CardContent className="py-4 px-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground text-sm">プラットフォーム手数料について</p>
                  <p>
                    レター収益からプラットフォーム手数料として{Math.round(earnings.platformCutRate * 100)}%が差し引かれます。
                    キャラクタートークでは、有償クレジット消費額の40%が作家に還元されます。
                    表示されている収益は手数料控除後の金額です。
                  </p>
                  <p>
                    {isConnectReady
                      ? '収益はStripe Connectを通じて自動的に振り込まれます。'
                      : 'Stripe Connectの設定完了後、自動振込が有効になります。'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">収益データがありません</p>
            <p className="text-xs text-muted-foreground mt-1">
              作品を公開してレターを受け取ると、ここに収益が表示されます
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function EarningsPage() {
  return (
    <Suspense fallback={
      <div className="px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    }>
      <EarningsPageContent />
    </Suspense>
  );
}

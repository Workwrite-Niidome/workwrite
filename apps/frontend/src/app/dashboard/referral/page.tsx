'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Copy, Check, Gift, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

interface ReferralInfo {
  code: string;
  count: number;
  maxInvites: number;
  creditsEarned: number;
}

export default function ReferralPage() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getReferralInfo()
      .then((res) => setInfo(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="px-4 py-8 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!info) {
    return (
      <div className="px-4 py-8 max-w-2xl mx-auto">
        <p className="text-muted-foreground">招待情報を取得できませんでした。</p>
      </div>
    );
  }

  const referralLink = `https://workwrite.jp/register?ref=${info.code}`;
  const remaining = info.maxInvites - info.count;
  const progressPct = (info.count / info.maxInvites) * 100;

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> ダッシュボード
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Gift className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">友達を招待</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">あなたの招待コード</CardTitle>
          <CardDescription>
            友達にこのリンクを共有すると、登録時にあなたに10Crが付与されます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Referral Code */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">招待コード</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-muted/50 border rounded-md px-4 py-2.5 font-mono text-lg tracking-widest text-center">
                {info.code}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(info.code)}
                title="コードをコピー"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Referral Link */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">招待リンク</label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={referralLink}
                className="text-sm font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="outline"
                onClick={() => handleCopy(referralLink)}
                className="shrink-0"
              >
                {copied ? <Check className="h-4 w-4 mr-1.5 text-green-500" /> : <Copy className="h-4 w-4 mr-1.5" />}
                コピー
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">招待状況</span>
            </div>
            <p className="text-2xl font-bold">
              {info.count}<span className="text-sm text-muted-foreground font-normal">/{info.maxInvites}</span>
            </p>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {remaining > 0
                ? `あと${remaining}人招待できます`
                : '招待枠を使い切りました'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">獲得クレジット</span>
            </div>
            <p className="text-2xl font-bold">
              {info.creditsEarned}<span className="text-sm text-muted-foreground font-normal">Cr</span>
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              1人招待するごとに10Crを獲得
            </p>
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">招待の仕組み</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              <span>上の招待リンクを友達に共有します</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              <span>友達がリンクからWorkwriteに登録します</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
              <span>あなたに10Crが自動で付与されます（最大5人まで）</span>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

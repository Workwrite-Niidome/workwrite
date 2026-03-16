'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { Users, Gift, Copy, Check } from 'lucide-react';

interface InviteCode {
  code: string;
  label: string | null;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  usages: { userId: string; usedAt: string }[];
}

interface Reward {
  triggerEvent: string;
  creditAmount: number;
  createdAt: string;
}

interface ReferralDashboard {
  inviteCodes: InviteCode[];
  rewards: Reward[];
  totalCreditsEarned: number;
  totalInvitees: number;
}

const EVENT_LABELS: Record<string, string> = {
  first_work_published: '初作品公開',
  first_review: '初レビュー投稿',
};

export default function ReferralPage() {
  const [data, setData] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    api.getReferralDashboard()
      .then((res) => setData((res as any).data || null))
      .finally(() => setLoading(false));
  }, []);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {}
  }

  if (loading) {
    return (
      <div className="px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">招待・リファラル</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">招待した人数</p>
            <p className="text-2xl font-bold">{data.totalInvitees}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <Gift className="h-5 w-5 mx-auto mb-1 text-green-600" />
            <p className="text-xs text-muted-foreground">獲得クレジット</p>
            <p className="text-2xl font-bold text-green-600">{data.totalCreditsEarned}cr</p>
          </CardContent>
        </Card>
      </div>

      {/* Reward rules */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">報酬ルール</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span>招待者が初作品を公開</span>
            <Badge variant="secondary">+50cr</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span>招待者が初レビューを投稿</span>
            <Badge variant="secondary">+10cr</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Invite codes */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">招待コード</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.inviteCodes.map((code) => (
              <div key={code.code} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <div>
                  <code className="text-sm font-mono font-medium">{code.code}</code>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({code.usedCount}/{code.maxUses}使用)
                  </span>
                  {!code.isActive && (
                    <Badge variant="outline" className="ml-2 text-[10px]">無効</Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => copyCode(code.code)}
                  disabled={!code.isActive || code.usedCount >= code.maxUses}
                >
                  {copiedCode === code.code ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            ))}
            {data.inviteCodes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                招待コードがありません
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reward history */}
      {data.rewards.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">報酬履歴</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.rewards.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{EVENT_LABELS[r.triggerEvent] || r.triggerEvent}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-medium">+{r.creditAmount}cr</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { Mail, TrendingUp, DollarSign } from 'lucide-react';

interface Letter {
  id: string;
  sender: { displayName?: string; name: string };
  episode: { id: string; title: string; work?: { id: string; title: string } };
  type: string;
  content: string;
  amount: number;
  isFreeQuota: boolean;
  createdAt: string;
}

interface Earnings {
  totalLetters: number;
  monthlyLetters: number;
  totalEarnings: number;
  monthlyEarnings: number;
  platformCutRate: number;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  SHORT: { label: 'ショート', color: 'bg-blue-50 text-blue-700' },
  STANDARD: { label: 'レター', color: 'bg-green-50 text-green-700' },
  PREMIUM: { label: 'プレミアム', color: 'bg-purple-50 text-purple-700' },
  GIFT: { label: 'ギフト', color: 'bg-amber-50 text-amber-700' },
};

export default function ReceivedLettersPage() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getReceivedLetters().then((res) => setLetters((res as any).data || [])),
      api.getLetterEarnings().then((res) => setEarnings((res as any).data || null)),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">受信レター</h1>

      {/* Earnings summary */}
      {earnings && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-xs text-muted-foreground">累計レター</p>
              <p className="text-lg font-bold">{earnings.totalLetters}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-xs text-muted-foreground">今月</p>
              <p className="text-lg font-bold">{earnings.monthlyLetters}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-xs text-muted-foreground">累計収益</p>
              <p className="text-lg font-bold text-green-600">¥{earnings.totalEarnings.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 text-center">
              <p className="text-xs text-muted-foreground">今月収益</p>
              <p className="text-lg font-bold text-green-600">¥{earnings.monthlyEarnings.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Letters list */}
      {letters.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">まだレターを受け取っていません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {letters.map((letter) => {
            const typeInfo = TYPE_LABELS[letter.type] || { label: letter.type, color: '' };
            return (
              <Card key={letter.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">{letter.sender?.displayName || letter.sender?.name || '匿名'}</span>
                    <Badge className={`text-[10px] ${typeInfo.color}`}>{typeInfo.label}</Badge>
                    {letter.amount > 0 && !letter.isFreeQuota && (
                      <span className="text-xs text-green-600 font-medium">¥{letter.amount.toLocaleString()}</span>
                    )}
                  </div>
                  <p className="text-sm mb-2">{letter.content}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{letter.episode?.work?.title} &gt; {letter.episode?.title}</span>
                    <span>{new Date(letter.createdAt).toLocaleDateString('ja-JP')}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

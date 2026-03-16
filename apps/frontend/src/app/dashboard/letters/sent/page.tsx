'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { Send } from 'lucide-react';

interface Letter {
  id: string;
  recipient: { displayName?: string; name: string };
  episode: { id: string; title: string; work?: { id: string; title: string } };
  type: string;
  content: string;
  amount: number;
  isFreeQuota: boolean;
  createdAt: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  SHORT: { label: 'ショート', color: 'bg-blue-50 text-blue-700' },
  STANDARD: { label: 'レター', color: 'bg-green-50 text-green-700' },
  PREMIUM: { label: 'プレミアム', color: 'bg-purple-50 text-purple-700' },
  GIFT: { label: 'ギフト', color: 'bg-amber-50 text-amber-700' },
};

export default function SentLettersPage() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSentLetters()
      .then((res) => setLetters((res as any).data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">送信レター</h1>

      {letters.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Send className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">まだレターを送信していません</p>
            <p className="text-xs text-muted-foreground mt-1">
              作品を読んで、著者にレターを送ってみましょう
            </p>
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
                    <span className="text-xs text-muted-foreground">To:</span>
                    <span className="text-sm font-medium">{letter.recipient?.displayName || letter.recipient?.name || '—'}</span>
                    <Badge className={`text-[10px] ${typeInfo.color}`}>{typeInfo.label}</Badge>
                    {letter.amount > 0 && !letter.isFreeQuota && (
                      <span className="text-xs text-amber-600 font-medium">¥{letter.amount.toLocaleString()}</span>
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
